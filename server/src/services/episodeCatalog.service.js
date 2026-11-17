import { pool } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import * as tmdb from '../providers/tmdb.provider.js';
import * as anilist from '../providers/anilist.provider.js';
import {
  normalizeTmdbSeason,
  normalizeTmdbEpisode,
  buildAnimeEpisodes,
  anilistKnownEpisodeCount
} from './mediaNormalizer.js';

/**
 * Seasons and episodes are shared catalog data. They are loaded from the
 * provider the first time someone needs them and then reused by every user.
 *
 *   TV    -> TMDB seasons + per-season episode lists
 *   ANIME -> AniList has no per-episode data, so Season 1 with episodes 1..N is
 *            generated from the episode count (or episodes already aired)
 *   MOVIE -> never has seasons or episodes
 *
 * Syncing is idempotent (UPSERTs) and NEVER deletes: removing an episode would
 * cascade-delete users' watched progress.
 */
const MAX_SEASONS = 60;
const SEASON_FETCH_CONCURRENCY = 4;
const STALE_AFTER_MS = 12 * 60 * 60 * 1000;
const ENDED_STATUSES = new Set(['Ended', 'Canceled', 'FINISHED', 'CANCELLED']);

const EMPTY_RETRY_MS = 10 * 60 * 1000;
const emptySyncs = new Map(); // mediaId -> time of the last sync that found no episodes (bounded below)
const inflight = new Map(); // mediaId -> Promise (one provider sync at a time per title)

async function loadMediaSource(mediaId, db) {
  const { rows } = await db.query(
    `SELECT mi.id, mi.media_type, mi.metadata, ms.provider, ms.external_id
       FROM public.media_items mi
       JOIN public.media_sources ms ON ms.media_id = mi.id
      WHERE mi.id = $1
      ORDER BY ms.created_at ASC
      LIMIT 1`,
    [mediaId]
  );
  if (rows.length === 0) throw new AppError('That title is not in the catalog.', 404, 'MEDIA_NOT_FOUND');
  return rows[0];
}

/** Runs `fn` over `items` with at most `limit` running at once, keeping result order. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Fetches the full season/episode plan from the provider. No database access. */
async function fetchPlan(source) {
  if (source.media_type === 'TV') {
    const tv = await tmdb.getTvDetails(source.external_id);
    const summaries = (tv.seasons ?? []).map(normalizeTmdbSeason).filter(Boolean).slice(0, MAX_SEASONS);
    return mapLimit(summaries, SEASON_FETCH_CONCURRENCY, async (summary) => {
      const detail = await tmdb.getTvSeasonDetails(source.external_id, summary.seasonNumber);
      const episodes = (detail.episodes ?? []).map(normalizeTmdbEpisode).filter(Boolean);
      return { ...summary, episodeCount: episodes.length || summary.episodeCount, episodes };
    });
  }

  // ANIME
  const raw = await anilist.getAnimeDetails(source.external_id);
  const count = anilistKnownEpisodeCount(raw);
  if (!count) return []; // nothing reliable to generate yet
  const episodes = buildAnimeEpisodes(count, raw.duration);
  return [
    {
      seasonNumber: 1,
      name: 'Season 1',
      overview: null,
      posterUrl: null,
      airDate: null,
      episodeCount: episodes.length,
      episodes
    }
  ];
}

async function persistPlan(mediaId, plan, db) {
  const client = await db.connect();
  let episodeTotal = 0;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`episodes:${mediaId}`]);

    for (const season of plan) {
      const { rows } = await client.query(
        `INSERT INTO public.seasons (media_id, season_number, name, overview, poster_path, air_date, episode_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (media_id, season_number) DO UPDATE
           SET name = EXCLUDED.name, overview = EXCLUDED.overview, poster_path = EXCLUDED.poster_path,
               air_date = EXCLUDED.air_date, episode_count = EXCLUDED.episode_count
         RETURNING id`,
        [mediaId, season.seasonNumber, season.name, season.overview, season.posterUrl, season.airDate, season.episodeCount]
      );
      const seasonId = rows[0].id;

      if (season.episodes.length > 0) {
        const eps = season.episodes;
        await client.query(
          `INSERT INTO public.episodes (season_id, episode_number, title, overview, air_date, runtime_minutes)
           SELECT $1, t.n, t.title, t.overview, t.air_date, t.runtime
             FROM unnest($2::int[], $3::text[], $4::text[], $5::date[], $6::int[])
                  AS t(n, title, overview, air_date, runtime)
           ON CONFLICT (season_id, episode_number) DO UPDATE
             SET title = EXCLUDED.title, overview = EXCLUDED.overview,
                 air_date = EXCLUDED.air_date, runtime_minutes = EXCLUDED.runtime_minutes
             WHERE (episodes.title, episodes.overview, episodes.air_date, episodes.runtime_minutes)
                   IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.overview, EXCLUDED.air_date, EXCLUDED.runtime_minutes)`,
          [
            seasonId,
            eps.map((e) => e.episodeNumber),
            eps.map((e) => e.title),
            eps.map((e) => e.overview),
            eps.map((e) => e.airDate),
            eps.map((e) => e.runtimeMinutes)
          ]
        );
        episodeTotal += eps.length;
      }
    }
    await client.query('COMMIT');
    return { seasons: plan.length, episodes: episodeTotal };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Loads seasons/episodes for a catalog title from its provider and upserts them.
 * Safe to call repeatedly. Movies return immediately with nothing to do.
 */
export function syncSeasonsAndEpisodes(mediaId, db = pool) {
  if (inflight.has(mediaId)) return inflight.get(mediaId);
  const promise = (async () => {
    const source = await loadMediaSource(mediaId, db);
    if (source.media_type === 'MOVIE') return { seasons: 0, episodes: 0 };
    const plan = await fetchPlan(source);
    return persistPlan(mediaId, plan, db);
  })().finally(() => inflight.delete(mediaId));
  inflight.set(mediaId, promise);
  return promise;
}

async function readSeasons(mediaId, db) {
  const { rows } = await db.query(
    `SELECT s.id AS season_id, s.season_number, s.name AS season_name, s.overview AS season_overview,
            s.poster_path, s.air_date AS season_air_date, s.episode_count, s.updated_at AS season_updated_at,
            e.id AS episode_id, e.episode_number, e.title, e.overview, e.air_date, e.runtime_minutes
       FROM public.seasons s
       LEFT JOIN public.episodes e ON e.season_id = s.id
      WHERE s.media_id = $1
      ORDER BY s.season_number ASC, e.episode_number ASC`,
    [mediaId]
  );

  const seasons = new Map();
  let newestUpdate = 0;
  for (const r of rows) {
    if (!seasons.has(r.season_id)) {
      seasons.set(r.season_id, {
        id: r.season_id,
        seasonNumber: r.season_number,
        name: r.season_name,
        overview: r.season_overview,
        posterUrl: r.poster_path,
        airDate: r.season_air_date ? toDateString(r.season_air_date) : null,
        episodeCount: r.episode_count,
        episodes: []
      });
      newestUpdate = Math.max(newestUpdate, new Date(r.season_updated_at).getTime());
    }
    if (r.episode_id) {
      seasons.get(r.season_id).episodes.push({
        id: r.episode_id,
        episodeNumber: r.episode_number,
        title: r.title,
        overview: r.overview,
        airDate: r.air_date ? toDateString(r.air_date) : null,
        runtimeMinutes: r.runtime_minutes
      });
    }
  }
  return { seasons: [...seasons.values()], newestUpdate };
}

// pg returns DATE columns as local-midnight JS Dates; format without a timezone shift.
function toDateString(date) {
  const d = new Date(date);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Seasons + episodes for a title (syncing from the provider when missing or
 * stale). If a refresh of already-stored data fails, the stored data is served.
 */
export async function getSeasonsForMedia(mediaId, db = pool) {
  const source = await loadMediaSource(mediaId, db);
  if (source.media_type === 'MOVIE') {
    return { mediaId, mediaType: 'MOVIE', supportsEpisodes: false, seasons: [] };
  }

  let { seasons, newestUpdate } = await readSeasons(mediaId, db);
  const status = source.metadata?.status;
  const stale = seasons.length > 0 && Date.now() - newestUpdate > STALE_AFTER_MS && !ENDED_STATUSES.has(status);

  // A title the provider has no episode data for yet is not re-requested on every page view.
  const recentlyEmpty = Date.now() - (emptySyncs.get(mediaId) ?? 0) < EMPTY_RETRY_MS;

  if ((seasons.length === 0 && !recentlyEmpty) || stale) {
    try {
      await syncSeasonsAndEpisodes(mediaId, db);
      ({ seasons } = await readSeasons(mediaId, db));
      if (seasons.length === 0) {
        if (emptySyncs.size >= 1000) emptySyncs.delete(emptySyncs.keys().next().value);
        emptySyncs.set(mediaId, Date.now());
      }
    } catch (err) {
      if (seasons.length === 0) throw err;
      console.warn(`[Episodes] Refresh failed for ${mediaId}, serving stored data:`, err.message);
    }
  }
  return { mediaId, mediaType: source.media_type, supportsEpisodes: true, seasons };
}

export default { syncSeasonsAndEpisodes, getSeasonsForMedia };
