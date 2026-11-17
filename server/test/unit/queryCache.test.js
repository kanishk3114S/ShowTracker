/**
 * Unit tests for the client's stale-while-revalidate cache (client/src/lib/queryCache.js).
 * It is plain JavaScript with no browser APIs, so it runs here under Node.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const cache = await import('../../../client/src/lib/queryCache.js');

beforeEach(() => cache.clearCache());

test('write/read round trip; fresh within the window, not fresh after it', async () => {
  cache.writeCache('media:x', { a: 1 });
  const hit = cache.readCache('media:x');
  assert.deepEqual(hit.data, { a: 1 });
  assert.equal(cache.isFresh(hit, 1000), true);
  assert.equal(cache.isFresh(hit, 0), false);
  assert.equal(cache.readCache('media:missing'), null);
});

test('markStale keeps the data (shown instantly) but is no longer fresh', () => {
  cache.writeCache('me:stats', { n: 5 });
  cache.writeCache('media:trending', { n: 9 });
  cache.markStale(['me:']);
  const stale = cache.readCache('me:stats');
  assert.deepEqual(stale.data, { n: 5 }, 'data survives so the page can render it immediately');
  assert.equal(cache.isFresh(stale, 60_000), false, 'but it will be refetched');
  assert.equal(cache.isFresh(cache.readCache('media:trending'), 60_000), true, 'other prefixes untouched');
});

test('invalidateUserData drops per-title "in my library?" answers and marks lists/profile stale', () => {
  cache.writeCache('me:check:abc', { entry: null });
  cache.writeCache('me:library:|||', [1]);
  cache.writeCache('profile:bob:|||', { p: 1 });
  cache.writeCache('media:details:tmdb|movie|1', { t: 'x' });
  cache.invalidateUserData();
  assert.equal(cache.readCache('me:check:abc'), null, 'a stale "not in library" must never flash');
  assert.equal(cache.isFresh(cache.readCache('me:library:|||'), 60_000), false);
  assert.equal(cache.isFresh(cache.readCache('profile:bob:|||'), 60_000), false);
  assert.equal(cache.isFresh(cache.readCache('media:details:tmdb|movie|1'), 60_000), true, 'public catalog data is unaffected');
});

test('clearCache (sign-out) removes everything, including private data', () => {
  cache.writeCache('me:stats', { secret: true });
  cache.writeCache('media:genres:ALL', ['a']);
  cache.clearCache();
  assert.equal(cache.readCache('me:stats'), null);
  assert.equal(cache.readCache('media:genres:ALL'), null);
});

test('the cache is bounded: oldest entries are evicted', () => {
  for (let i = 0; i < 350; i++) cache.writeCache(`media:k${i}`, i);
  assert.equal(cache.readCache('media:k0'), null);
  assert.equal(cache.readCache('media:k349').data, 349);
});

test('loadCached uses fresh data, otherwise fetches once and stores it', async () => {
  let calls = 0;
  const fetcher = async () => ++calls;
  assert.equal(await cache.loadCached('me:seasons:1', fetcher, 60_000), 1);
  assert.equal(await cache.loadCached('me:seasons:1', fetcher, 60_000), 1, 'second call is served from cache');
  assert.equal(calls, 1);
});

test('prefetch warms the cache, de-duplicates in-flight requests and swallows failures', async () => {
  let calls = 0;
  const fetcher = () => new Promise((r) => setTimeout(() => r(++calls), 10));
  cache.prefetch('media:search:a', fetcher);
  cache.prefetch('media:search:a', fetcher); // duplicate while in flight
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(calls, 1);
  assert.equal(cache.readCache('media:search:a').data, 1);

  cache.prefetch('media:search:bad', async () => {
    throw new Error('network down');
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(cache.readCache('media:search:bad'), null, 'a failed prefetch leaves no entry and throws nothing');
});

test('details prefetching is rate limited so it can never exhaust a provider quota', async () => {
  let started = 0;
  const slow = () => new Promise((r) => setTimeout(() => r(++started), 30));
  // Eight different titles in quick succession: only 2 may run at once.
  for (let i = 0; i < 8; i++) cache.prefetch(`media:details:tmdb|movie|${i}`, slow);
  await new Promise((r) => setTimeout(r, 5));
  assert.ok(started <= 2, 'at most two in flight');
  await new Promise((r) => setTimeout(r, 120));

  // Per-minute budget (8): keep asking for new titles; the total can never exceed it.
  for (let i = 100; i < 140; i++) {
    cache.prefetch(`media:details:tmdb|movie|${i}`, async () => 1);
    await new Promise((r) => setTimeout(r, 2));
  }
  await new Promise((r) => setTimeout(r, 50));
  const stored = [...Array(140).keys()].filter((i) => cache.readCache(`media:details:tmdb|movie|${i}`)).length;
  assert.ok(stored <= 8, `at most 8 detail prefetches per minute, got ${stored}`);
});
