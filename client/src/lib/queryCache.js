/**
 * Tiny in-memory stale-while-revalidate cache for API data.
 *
 * Going back to a page shows what we already know IMMEDIATELY and refreshes it
 * quietly in the background, so navigation feels instant even though the server
 * and database are far away.
 *
 * Key conventions (they decide what gets invalidated):
 *   'me:...'      private data of the signed-in user (library, stats, shelves)
 *   'profile:...' public profile pages (an owner's own page includes their library)
 *   'media:...'   public catalog data (search, trending, details, genres)
 *
 * Privacy: the whole cache is wiped on sign-out, so another person using the same
 * browser can never see the previous user's data. Nothing is written to disk.
 */
const MAX_ENTRIES = 300;
const HARD_MAX_AGE_MS = 30 * 60 * 1000; // older than this is treated as missing

const store = new Map(); // key -> { data, at, stale }
const inflight = new Map(); // key -> Promise (de-duplicates identical requests)

export function readCache(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > HARD_MAX_AGE_MS) {
    store.delete(key);
    return null;
  }
  // refresh recency (Map keeps insertion order => oldest first)
  store.delete(key);
  store.set(key, entry);
  return entry;
}

export function writeCache(key, data) {
  store.delete(key);
  store.set(key, { data, at: Date.now(), stale: false });
  while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value);
}

export const isFresh = (entry, staleMs) => Boolean(entry) && !entry.stale && Date.now() - entry.at < staleMs;

/** Marks matching entries as stale: they are still shown instantly, but refetched on next use. */
export function markStale(prefixes) {
  const list = Array.isArray(prefixes) ? prefixes : [prefixes];
  for (const [key, entry] of store) {
    if (list.some((p) => key.startsWith(p))) entry.stale = true;
  }
}

/** Removes matching entries entirely (used where even a briefly stale answer would be wrong). */
export function dropPrefix(prefix) {
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * Called after anything that changes the user's library or profile.
 * Lists and counts stay on screen but refresh at once (stale-while-revalidate); the per-title
 * "is it in my library?" answers are dropped, because showing an outdated one would be wrong.
 */
export const invalidateUserData = () => {
  dropPrefix('me:check:');
  markStale(['me:', 'profile:']);
};

export function clearCache() {
  store.clear();
  inflight.clear();
}

/**
 * Warms the cache ahead of a click (hover, focus, touch, idle time).
 * Silent: a failed prefetch is simply ignored and the page loads normally later.
 */
export function prefetch(key, fetcher, staleMs = 60_000) {
  if (isFresh(readCache(key), staleMs) || inflight.has(key)) return;
  const lane = laneFor(key);
  if (!lane.allow()) return; // be polite to the providers: skip instead of queueing
  lane.start();
  const promise = Promise.resolve()
    .then(() => fetcher())
    .then((data) => writeCache(key, data))
    .catch(() => {})
    .finally(() => {
      lane.done();
      inflight.delete(key);
    });
  inflight.set(key, promise);
}

/**
 * Prefetching must never be able to use up an upstream rate limit (AniList allows as few as
 * 30 requests/minute) and make a real click fail. Detail prefetches are capped per minute
 * and in parallel; a skipped prefetch simply means that page loads normally when opened.
 */
function makeLane({ maxPerMinute, maxConcurrent }) {
  const starts = [];
  let running = 0;
  return {
    allow() {
      const cutoff = Date.now() - 60_000;
      while (starts.length && starts[0] < cutoff) starts.shift();
      return running < maxConcurrent && starts.length < maxPerMinute;
    },
    start() {
      starts.push(Date.now());
      running += 1;
    },
    done() {
      running = Math.max(0, running - 1);
    }
  };
}
const detailsLane = makeLane({ maxPerMinute: 8, maxConcurrent: 2 });
const generalLane = makeLane({ maxPerMinute: 60, maxConcurrent: 4 });
const laneFor = (key) => (key.startsWith('media:details:') ? detailsLane : generalLane);

/** Returns fresh cached data, or fetches (and caches) it. For one-off actions that need data right now. */
export async function loadCached(key, fetcher, staleMs = 60_000) {
  const hit = readCache(key);
  if (isFresh(hit, staleMs)) return hit.data;
  const data = await fetcher();
  writeCache(key, data);
  return data;
}
