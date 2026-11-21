import { pool } from '../../config/database.js';
import { withUserTransaction } from '../../db/withUserTransaction.js';
import * as anilist from '../../providers/anilist.provider.js';
import * as tmdb from '../../providers/tmdb.provider.js';
import * as tvmaze from '../../providers/tvmaze.provider.js';
import { tmdbCircuitOpen } from '../../providers/providerHealth.js';

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
export const UPCOMING_WINDOW_DAYS = 28;
export const UPCOMING_WINDOW_MS = UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const TMDB_CONCURRENCY = 3;
const RECENT_PAST_MS = 3 * 60 * 60 * 1000; // an episode that aired in the last 3 hours still shows as "just aired"
const DAY_MS = 24 * 60 * 60 * 1000;

export function calculateUpcomingStatus(targetMs, nowMs, isDay = false) {
  const dNow = new Date(nowMs);
  const todayStart = new Date(dNow.getFullYear(), dNow.getMonth(), dNow.getDate()).getTime();
  const dTarget = new Date(targetMs);
  const targetStart = isDay ? targetMs : new Date(dTarget.getFullYear(), dTarget.getMonth(), dTarget.getDate()).getTime();
  const diffDays = Math.round((targetStart - todayStart) / DAY_MS);

  if (diffDays <= 0) return 'TODAY';
  if (diffDays === 1) return 'TOMORROW';
  if (diffDays <= 7) return 'THIS_WEEK';
  if (diffDays <= 14) return 'NEXT_WEEK';
  return 'LATER';
}

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
        AND ul.status IN ('WATCHING', 'PLAN_TO_WATCH', 'COMPLETED', 'ON_HOLD', 'REWATCHING', 'DROPPED')
        AND mi.media_type IN ('ANIME', 'TV')`,
    [userId]
  );
  return rows;
}

const isAiringStatus = (row) =>
  row.media_type === 'ANIME' ? AIRING_ANIME.has(row.metadata?.status) : AIRING_TV.has(row.metadata?.status);

function needsRefresh(row, now) {
  if (!row.provider || !row.external_id) return false;
  if (row.provider === 'TVDB') return false; // TheTVDB has no next-episode data we can use
  if (row.provider === 'TMDB' && tmdbCircuitOpen()) return false; // TMDB is known to be unreachable: keep stored data
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

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The metadata patch (status + next episode) for one TV title, from the provider that owns its identity. */
async function nextEpisodePatch(row) {
  if (row.provider === 'TVMAZE') {
    const show = await tvmaze.getTvDetails(row.external_id);
    const next = show?._embedded?.nextepisode;
    const status = { Running: 'Returning Series', Ended: 'Ended', 'To Be Determined': 'In Production', 'In Development': 'Planned' }[show?.status] ?? show?.status;
    return {
      status: status ?? row.metadata?.status ?? null,
      nextAirDate: next?.airdate && ISO_DAY.test(next.airdate) ? next.airdate : null,
      nextAirEpisode: Number.isInteger(next?.number) ? next.number : null,
      nextAirSeason: Number.isInteger(next?.season) ? next.season : null
    };
  }
  const tv = await tmdb.getTvDetails(row.external_id);
  const ep = tv.next_episode_to_air;
  return {
    status: tv.status ?? row.metadata?.status ?? null,
    nextAirDate: ep?.air_date && ISO_DAY.test(ep.air_date) ? ep.air_date : null,
    nextAirEpisode: ep?.episode_number ?? null,
    nextAirSeason: ep?.season_number ?? null
  };
}

async function refreshTv(rows, out) {
  const batch = rows.slice(0, MAX_TMDB_REFRESHES);
  let next = 0;
  const worker = async () => {
    while (next < batch.length) {
      const row = batch[next++];
      try {
        const patch = await nextEpisodePatch(row);
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

  const isCurrentlyAiring = row.media_type === 'ANIME' ? metadata?.status === 'RELEASING' : metadata?.status === 'Returning Series';
  const upcomingStatus = isCurrentlyAiring
    ? 'CURRENTLY_AIRING'
    : metadata?.status === 'HIATUS' || metadata?.status === 'On Hiatus'
      ? 'ON_HIATUS'
      : metadata?.status === 'NOT_YET_RELEASED' || metadata?.status === 'Planned' || metadata?.status === 'In Production'
        ? 'UPCOMING_SEASON'
        : 'CONFIRMED_SCHEDULE';

  if (row.media_type === 'ANIME') {
    const at = toInt(metadata?.nextAiring);
    if (at === null || at * 1000 < now - RECENT_PAST_MS) return null;
    const epNum = toInt(metadata.nextAiringEpisode);
    const airingAt = new Date(at * 1000).toISOString();
    return {
      ...base,
      id: `${row.media_id}:s1e${epNum ?? 1}`,
      nextEpisode: epNum,
      episodeNumber: epNum,
      episodeTitle: epNum ? `Episode ${epNum}` : 'New episode',
      overview: metadata?.overview ?? null,
      seasonNumber: null,
      airingAt,
      airDate: null,
      releaseDate: airingAt.slice(0, 10),
      releaseTime: airingAt.slice(11, 16),
      precision: 'exact',
      upcomingStatus,
      timeUntilAiring: Math.round((at * 1000 - now) / 1000),
      status: calculateUpcomingStatus(at * 1000, now, false)
    };
  }

  const date = metadata?.nextAirDate;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const dayStart = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(dayStart) || dayStart + 2 * DAY_MS <= now) return null; // allow for time zones, then drop
  const epNum = toInt(metadata.nextAirEpisode);
  const seasonNum = toInt(metadata.nextAirSeason);
  return {
    ...base,
    id: `${row.media_id}:s${seasonNum ?? 1}e${epNum ?? 1}`,
    nextEpisode: epNum,
    episodeNumber: epNum,
    episodeTitle: epNum ? `Episode ${epNum}` : 'New episode',
    overview: metadata?.overview ?? null,
    seasonNumber: seasonNum,
    airingAt: new Date(dayStart).toISOString(),
    airDate: date,
    releaseDate: date,
    releaseTime: null,
    precision: 'day', // TMDB only knows the date, not the hour
    upcomingStatus,
    timeUntilAiring: Math.round((dayStart - now) / 1000),
    status: calculateUpcomingStatus(dayStart, now, true)
  };
}

/**
 * The user's upcoming episodes, soonest first.
 * @returns {{ serverTime: string, items: object[] }}
 */
export async function getUpcoming(userId, { now = Date.now(), windowDays = UPCOMING_WINDOW_DAYS, allEpisodes = false } = {}) {
  const rows = await withUserTransaction(userId, (client) => listRadarCandidates(client, userId), { readOnly: true });
  const fresher = await refreshAiringData(rows, now);
  const windowEndMs = now + windowDays * DAY_MS;

  const itemsMap = new Map(); // key -> episode item
  const addEpisode = (item) => {
    if (!item) return;
    const itemAt = Date.parse(item.airingAt);
    if (!Number.isFinite(itemAt)) return;
    if (itemAt < now - RECENT_PAST_MS || itemAt > windowEndMs + DAY_MS) return;
    const key = `${item.mediaId}:s${item.seasonNumber ?? 1}e${item.episodeNumber ?? item.nextEpisode ?? 1}`;
    if (!itemsMap.has(key)) itemsMap.set(key, item);
  };

  // 1. Process custom or stored multi-episode schedules from metadata
  for (const row of rows) {
    const meta = fresher.get(row.media_id) ?? row.metadata ?? {};
    if (Array.isArray(meta.airingSchedule) && meta.airingSchedule.length > 0) {
      for (const s of meta.airingSchedule) {
        if (!s || !s.airingAt) continue;
        const epNum = toInt(s.episode);
        const atMs = s.airingAt * 1000;
        const iso = new Date(atMs).toISOString();
        addEpisode({
          entryId: row.entry_id,
          mediaId: row.media_id,
          title: row.title,
          posterUrl: row.poster_path ?? null,
          backdropUrl: row.backdrop_path ?? null,
          mediaType: row.media_type,
          provider: row.provider ?? 'ANILIST',
          externalId: row.external_id,
          libraryStatus: row.library_status,
          id: `${row.media_id}:s1e${epNum ?? 1}`,
          nextEpisode: epNum,
          episodeNumber: epNum,
          episodeTitle: epNum ? `Episode ${epNum}` : 'New episode',
          overview: null,
          seasonNumber: null,
          airingAt: iso,
          airDate: null,
          releaseDate: iso.slice(0, 10),
          releaseTime: iso.slice(11, 16),
          precision: 'exact',
          timeUntilAiring: Math.round((atMs - now) / 1000),
          status: calculateUpcomingStatus(atMs, now, false)
        });
      }
    }
  }

  // 2. Query stored episodes from public.episodes / public.seasons for candidate shows
  const candidateMediaIds = rows.map((r) => r.media_id);
  if (candidateMediaIds.length > 0) {
    try {
      const todayIso = new Date(now).toISOString().slice(0, 10);
      const endIso = new Date(windowEndMs).toISOString().slice(0, 10);
      const { rows: storedEps } = await pool.query(
        `SELECT e.id AS episode_id, e.episode_number, e.title AS episode_title, e.air_date, e.overview,
                s.season_number, s.media_id
           FROM public.episodes e
           JOIN public.seasons s ON s.id = e.season_id
          WHERE s.media_id = ANY($1::uuid[])
            AND e.air_date >= $2::date
            AND e.air_date <= $3::date
          ORDER BY e.air_date ASC, s.season_number ASC, e.episode_number ASC`,
        [candidateMediaIds, todayIso, endIso]
      );

      if (storedEps.length > 0) {
        const byMediaId = new Map(rows.map((r) => [r.media_id, r]));
        for (const ep of storedEps) {
          const row = byMediaId.get(ep.media_id);
          if (!row || !ep.air_date) continue;
          const dateStr = typeof ep.air_date === 'string' ? ep.air_date.slice(0, 10) : new Date(ep.air_date).toISOString().slice(0, 10);
          const dayStart = Date.parse(`${dateStr}T00:00:00Z`);
          const epNum = toInt(ep.episode_number);
          const seasonNum = toInt(ep.season_number);
          addEpisode({
            entryId: row.entry_id,
            mediaId: row.media_id,
            title: row.title,
            posterUrl: row.poster_path ?? null,
            backdropUrl: row.backdrop_path ?? null,
            mediaType: row.media_type,
            provider: row.provider ?? null,
            externalId: row.external_id ?? null,
            libraryStatus: row.library_status,
            id: `${row.media_id}:s${seasonNum ?? 1}e${epNum ?? 1}`,
            nextEpisode: epNum,
            episodeNumber: epNum,
            episodeTitle: ep.episode_title || (epNum ? `Episode ${epNum}` : 'New episode'),
            overview: ep.overview ?? null,
            seasonNumber: seasonNum,
            airingAt: new Date(dayStart).toISOString(),
            airDate: dateStr,
            releaseDate: dateStr,
            releaseTime: null,
            precision: 'day',
            timeUntilAiring: Math.round((dayStart - now) / 1000),
            status: calculateUpcomingStatus(dayStart, now, true)
          });
        }
      }
    } catch {
      // Ignore database episode query failure, fallback to metadata
    }
  }

  // 3. For any title that did not get multi-episode items, add its next episode and weekly schedule
  for (const row of rows) {
    if (!isAiringStatus(row) && !fresher.has(row.media_id) && !row.metadata?.nextAiring && !row.metadata?.nextAirDate) continue;
    const item = buildRadarItem(row, fresher.get(row.media_id) ?? row.metadata, now);
    if (!item) continue;
    addEpisode(item);

    // If currently airing and allEpisodes requested, project subsequent weekly episodes within the 28-day window
    if (allEpisodes && item.upcomingStatus === 'CURRENTLY_AIRING') {
      const WEEK_MS = 7 * DAY_MS;
      const baseEp = item.episodeNumber || item.nextEpisode || 1;
      if (item.precision === 'exact') {
        const baseAt = Date.parse(item.airingAt);
        for (let w = 1; w <= 3; w++) {
          const nextAt = baseAt + w * WEEK_MS;
          if (nextAt > windowEndMs) break;
          const nextEp = baseEp + w;
          const nextIso = new Date(nextAt).toISOString();
          addEpisode({
            ...item,
            id: `${item.mediaId}:s${item.seasonNumber ?? 1}e${nextEp}`,
            nextEpisode: nextEp,
            episodeNumber: nextEp,
            episodeTitle: `Episode ${nextEp}`,
            airingAt: nextIso,
            releaseDate: nextIso.slice(0, 10),
            releaseTime: nextIso.slice(11, 16),
            timeUntilAiring: Math.round((nextAt - now) / 1000),
            status: calculateUpcomingStatus(nextAt, now, false)
          });
        }
      } else if (item.precision === 'day' && item.airDate) {
        const [y, m, d] = item.airDate.split('-').map(Number);
        const baseAt = new Date(y, m - 1, d).getTime();
        for (let w = 1; w <= 3; w++) {
          const nextAt = baseAt + w * WEEK_MS;
          if (nextAt > windowEndMs) break;
          const nextEp = baseEp + w;
          const nextDate = new Date(nextAt);
          const yStr = nextDate.getUTCFullYear();
          const mStr = String(nextDate.getUTCMonth() + 1).padStart(2, '0');
          const dStr = String(nextDate.getUTCDate()).padStart(2, '0');
          const dateStr = `${yStr}-${mStr}-${dStr}`;
          addEpisode({
            ...item,
            id: `${item.mediaId}:s${item.seasonNumber ?? 1}e${nextEp}`,
            nextEpisode: nextEp,
            episodeNumber: nextEp,
            episodeTitle: `Episode ${nextEp}`,
            airingAt: new Date(nextAt).toISOString(),
            airDate: dateStr,
            releaseDate: dateStr,
            timeUntilAiring: Math.round((nextAt - now) / 1000),
            status: calculateUpcomingStatus(nextAt, now, true)
          });
        }
      }
    }
  }

  const items = Array.from(itemsMap.values());
  items.sort(
    (a, b) =>
      Date.parse(a.airingAt) - Date.parse(b.airingAt) ||
      (a.seasonNumber ?? 0) - (b.seasonNumber ?? 0) ||
      (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0) ||
      a.title.localeCompare(b.title)
  );
  return { serverTime: new Date(now).toISOString(), windowDays: UPCOMING_WINDOW_DAYS, items };
}

export default { getUpcoming, refreshAiringData, buildRadarItem, listRadarCandidates };
