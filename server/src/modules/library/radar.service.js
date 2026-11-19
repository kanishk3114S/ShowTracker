import { pool } from '../../config/database.js';
import { withUserTransaction } from '../../db/withUserTransaction.js';
import * as anilist from '../../providers/anilist.provider.js';
import * as tmdb from '../../providers/tmdb.provider.js';

/**
 * Release Radar: when does the next episode of each show in the user's library air?
 *
 * Data comes from the shared catalog (`media_items.metadata`):
 *   AniList  nextAiring (unix seconds, exact to the minute)  + nextAiringEpisode
 *   TMDB     nextAirDate ('YYYY-MM-DD', a DATE only)        + nextAirEpisode / nextAirSeason
 * It is saved whenever a title page is opened. Airing data goes stale within days, so
 * this service refreshes titles whose stored airing time has passed (or was never
 * stored) before answering: AniList titles in ONE batched request, TMDB titles one
 * request each (capped). Each title is refreshed at most once per REFRESH_COOLDOWN_MS,
 * and provider failures never break the radar: the stored data is served instead.
 *
 * Titles with no known next episode (finished, on hiatus, not announced) simply do not appear.
 */
export const REFRESH_COOLDOWN_MS = 15 * 60 * 1000;
export const MAX_TMDB_REFRESHES = 6;
const TMDB_CONCURRENCY = 3;
const RECENT_PAST_MS = 3 * 60 * 60 * 1000; // an episode that aired in the last 3 hours still shows as "just aired"
const DAY_MS = 24 * 60 * 60 * 1000;

const AIRING_ANIME = new Set(['RELEASING', 'NOT_YET_RELEASED']);
const AIRING_TV = new Set(['Returning Series', 'In Production', 'Planned', 'Pilot']);

const lastRefresh = new Map(); // mediaId -> ms of the last refresh attempt (bounded below)
export const resetRadarState = () => lastRefresh.clear();
function markRefreshed(mediaId) {
  if (lastRefresh.size >= 2000) lastRefresh.delete(lastRefresh.keys().next().value);
  lastRefresh.set(mediaId, Date.now());
}

const toInt = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Math.trunc(Number(v)));

/** Library titles that could have an upcoming episode. Runs inside the user's transaction (RLS). */
export async function listRadarCandidates(client, userId) {
  const { rows } = await client.query(
    `SELECT ul.id AS entry_id, ul.status AS library_status, ul.media_id,
            mi.title, mi.poster_path, mi.backdrop_path, mi.media_type, mi.metadata,
            src.provider, src.external_id
       FROM public.user_library ul
       JOIN public.media_items mi ON mi.id = ul.media_id
       LEFT JOIN LATERAL (
         SELECT ms.provider, ms.external_id FROM public.media_sources ms
          WHERE ms.media_id = mi.id ORDER BY ms.created_at ASC LIMIT 1
       ) src ON true
      WHERE ul.user_id = $1
        AND ul.status IN ('WATCHING', 'PLAN_TO_WATCH')
        AND mi.media_type IN ('ANIME', 'TV')`,
    [userId]
  );
  return rows;
}

const isAiringStatus = (row) =>
  row.media_type === 'ANIME' ? AIRING_ANIME.has(row.metadata?.status) : AIRING_TV.has(row.metadata?.status);

function needsRefresh(row, now) {
  if (!row.provider || !row.external_id) return false;
  if (Date.now() - (lastRefresh.get(row.media_id) ?? 0) < REFRESH_COOLDOWN_MS) return false;
  const m = row.metadata ?? {};
  if (row.media_type === 'ANIME') {
    if (m.status && !AIRING_ANIME.has(m.status)) return false; // finished / hiatus: nothing to look up
    const at = toInt(m.nextAiring);
    return at === null || at * 1000 <= now;
  }
  if (m.status && !AIRING_TV.has(m.status)) return false;
  const date = m.nextAirDate;
  return !date || Date.parse(`${date}T00:00:00Z`) + DAY_MS <= now; // the whole air day has passed
}

async function saveMetadata(mediaId, patch) {
  await pool.query('UPDATE public.media_items SET metadata = COALESCE(metadata, \'{}\'::jsonb) || $1::jsonb WHERE id = $2', [
    JSON.stringify(patch),
    mediaId
  ]);
}

async function refreshAnime(rows, out) {
  if (rows.length === 0) return;
  const byExternal = new Map(rows.map((r) => [String(r.external_id), r]));
  let media;
  try {
    media = await anilist.getAnimeAiringBatch([...byExternal.keys()]);
  } catch (err) {
    console.warn('[Radar] AniList refresh failed, serving stored data:', err.message);
    return;
  }
  for (const item of media) {
    const row = byExternal.get(String(item.id));
    if (!row) continue;
    const next = item.nextAiringEpisode;
    const patch = {
      status: item.status ?? row.metadata?.status ?? null,
      nextAiring: next?.airingAt ?? null,
      nextAiringEpisode: next?.episode ?? null
    };
    try {
      await saveMetadata(row.media_id, patch);
    } catch (err) {
      console.warn('[Radar] Could not save airing data:', err.message);
    }
    out.set(row.media_id, { ...row.metadata, ...patch });
    markRefreshed(row.media_id);
  }
}

async function refreshTv(rows, out) {
  const batch = rows.slice(0, MAX_TMDB_REFRESHES);
  let next = 0;
  const worker = async () => {
    while (next < batch.length) {
      const row = batch[next++];
      try {
        const tv = await tmdb.getTvDetails(row.external_id);
        const ep = tv.next_episode_to_air;
        const patch = {
          status: tv.status ?? row.metadata?.status ?? null,
          nextAirDate: ep?.air_date && /^\d{4}-\d{2}-\d{2}$/.test(ep.air_date) ? ep.air_date : null,
          nextAirEpisode: ep?.episode_number ?? null,
          nextAirSeason: ep?.season_number ?? null
        };
        await saveMetadata(row.media_id, patch);
        out.set(row.media_id, { ...row.metadata, ...patch });
        markRefreshed(row.media_id);
      } catch (err) {
        console.warn(`[Radar] TMDB refresh failed for ${row.external_id}, serving stored data:`, err.message);
        markRefreshed(row.media_id); // do not retry a failing title on every request
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(TMDB_CONCURRENCY, batch.length) }, worker));
}

/** Refreshes stale airing data. Returns mediaId -> fresher metadata for the titles that were updated. */
export async function refreshAiringData(rows, now = Date.now()) {
  const out = new Map();
  const stale = rows.filter((r) => needsRefresh(r, now));
  await Promise.all([
    refreshAnime(stale.filter((r) => r.media_type === 'ANIME'), out),
    refreshTv(stale.filter((r) => r.media_type === 'TV'), out)
  ]);
  return out;
}

/** Turns one candidate (+ its current metadata) into a radar item, or null when nothing is upcoming. */
export function buildRadarItem(row, metadata, now) {
  const base = {
    entryId: row.entry_id,
    mediaId: row.media_id,
    title: row.title,
    posterUrl: row.poster_path ?? null,
    backdropUrl: row.backdrop_path ?? null,
    mediaType: row.media_type,
    provider: row.provider ?? null,
    externalId: row.external_id ?? null,
    libraryStatus: row.library_status
  };

  if (row.media_type === 'ANIME') {
    const at = toInt(metadata?.nextAiring);
    if (at === null || at * 1000 < now - RECENT_PAST_MS) return null;
    return {
      ...base,
      nextEpisode: toInt(metadata.nextAiringEpisode),
      seasonNumber: null,
      airingAt: new Date(at * 1000).toISOString(),
      airDate: null,
      precision: 'exact',
      timeUntilAiring: Math.round((at * 1000 - now) / 1000)
    };
  }

  const date = metadata?.nextAirDate;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const dayStart = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(dayStart) || dayStart + 2 * DAY_MS <= now) return null; // allow for time zones, then drop
  return {
    ...base,
    nextEpisode: toInt(metadata.nextAirEpisode),
    seasonNumber: toInt(metadata.nextAirSeason),
    airingAt: new Date(dayStart).toISOString(),
    airDate: date,
    precision: 'day', // TMDB only knows the date, not the hour
    timeUntilAiring: Math.round((dayStart - now) / 1000)
  };
}

/**
 * The user's upcoming episodes, soonest first.
 * @returns {{ serverTime: string, items: object[] }}
 */
export async function getUpcoming(userId, { now = Date.now() } = {}) {
  const rows = await withUserTransaction(userId, (client) => listRadarCandidates(client, userId), { readOnly: true });
  const fresher = await refreshAiringData(rows, now);

  const items = [];
  for (const row of rows) {
    if (!isAiringStatus(row) && !fresher.has(row.media_id) && !row.metadata?.nextAiring && !row.metadata?.nextAirDate) continue;
    const item = buildRadarItem(row, fresher.get(row.media_id) ?? row.metadata, now);
    if (item) items.push(item);
  }
  items.sort((a, b) => Date.parse(a.airingAt) - Date.parse(b.airingAt) || a.title.localeCompare(b.title));
  return { serverTime: new Date(now).toISOString(), items };
}

export default { getUpcoming, refreshAiringData, buildRadarItem, listRadarCandidates };
