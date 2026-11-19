import { pool } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import * as tmdb from '../providers/tmdb.provider.js';
import { normalizeTmdbSeason, normalizeTmdbEpisode } from './mediaNormalizer.js';
import { planAnimeSeasons, SEASON_SOURCE_PREFIX } from './franchise.service.js';
import { isFallbackWorthy, loadSourceInfoByMediaId, canFallBack, fetchPlanFallback } from './fallbackProviders.service.js';
import * as tvmaze from '../providers/tvmaze.provider.js';
import * as tvdb from '../providers/tvdb.provider.js';
import { buildPlanFromTvMaze, buildPlanFromTvDb } from './mediaNormalizer.js';
import { tmdbCircuitOpen } from '../providers/providerHealth.js';
import { ProviderError } from '../providers/providerError.js';

/**
 * Seasons and episodes are shared catalog data. They are loaded from the
 * provider the first time someone needs them and then reused by every user.
 *
 *   TV    -> TMDB seasons + per-season episode lists
 *   ANIME -> AniList has no per-episode data, so episodes 1..N are generated from the
 *            episode count (or episodes already aired). Sequels are linked into ONE
 *            series: the first season of a franchise gets Season 1, 2, 3 ... (one
 *            season per linked AniList entry, see franchise.service.js)
 *   MOVIE -> never has seasons or episodes
 *
 * Syncing is idempotent (UPSERTs) and NEVER deletes: removing an episode would
 * cascade-delete users' watched progress.
 *
 * TV falls back to TVMaze, then TheTVDB, when TMDB is slow or down. A fallback only INSERTS what is missing
 * (whole seasons with no stored episodes): it never rewrites a season or episode that already exists, so
 * episode ids (which user progress points at) and TMDB's data are never disturbed. When TMDB is back, a
 * normal sync takes over (episodes are matched by season + number, so the same rows are updated).
 */
const MAX_SEASONS = 60;
const SEASON_FETCH_CONCURRENCY = 4;
const STALE_AFTER_MS = 12 * 60 * 60 * 1000;
// A finished anime can still gain a new sequel, so its franchise is re-checked now and then.
const ENDED_ANIME_RECHECK_MS = 7 * 24 * 60 * 60 * 1000;
// A finished TV show hardly ever changes: re-check it once a month instead of every 12 hours.
export const ENDED_TV_RECHECK_MS = 30 * 24 * 60 * 60 * 1000;
const DEGRADED_RETRY_MS = 10 * 60 * 1000;
const UPGRADE_RETRY_MS = 10 * 60 * 1000;
const GAP_RETRY_MS = 5 * 60 * 1000;
const failedUpgrades = new Map(); // mediaId -> time a franchise upgrade last failed (bounded below)
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

/** TMDB's plan for a show. With `breaker`, the first transient failure stops the remaining requests. */
async function fetchTmdbTvPlan(source, { fast, breaker }) {
  const tv = await tmdb.getTvDetails(source.external_id, { fast });
  const summaries = (tv.seasons ?? []).map(normalizeTmdbSeason).filter(Boolean).slice(0, MAX_SEASONS);
  let tripped = null;
  let failures = 0;
  let firstError = null;
  const seasons = await mapLimit(summaries, SEASON_FETCH_CONCURRENCY, async (summary) => {
    if (tripped) throw tripped; // the provider is failing: do not queue more slow requests
    try {
      const detail = await tmdb.getTvSeasonDetails(source.external_id, summary.seasonNumber, { fast });
      const episodes = (detail.episodes ?? []).map(normalizeTmdbEpisode).filter(Boolean);
      return { ...summary, episodeCount: episodes.length || summary.episodeCount, episodes };
    } catch (err) {
      if (err?.kind === 'NOT_CONFIGURED' || err?.kind === 'AUTH') throw err; // a broken setup is not a slow season
      failures += 1;
      firstError ??= err;
      if (breaker && isFallbackWorthy(err)) tripped = err;
      console.warn(`[Episodes] Season ${summary.seasonNumber} of TMDB ${source.external_id} failed (${err.message}); keeping its summary.`);
      // One slow or failing season must not abort the whole request: keep the season summary
      // (its episodes are filled in by a later sync) and carry on with the others.
      return { ...summary, episodes: [], failed: true };
    }
  }).catch((err) => {
    if (tripped) throw tripped;
    throw err;
  });
  if (tripped || (failures > 0 && failures === summaries.length)) throw tripped ?? firstError; // TMDB is not answering at all
  return seasons.map(({ failed, ...season }) => season); // eslint-disable-line no-unused-vars
}

/**
 * Fetches the season/episode plan. No writes.
 * Returns { plan, provider, insertOnly }: `insertOnly` marks a plan from a fallback provider.
 * `filled` is the set of season numbers that already have episodes stored.
 */
async function fetchPlan(source, { filled = new Set() } = {}) {
  // Titles whose own identity is TVMaze or TheTVDB (they came from a fallback list) use that provider directly.
  if (source.media_type === 'TV' && source.provider === 'TVMAZE') {
    return { plan: buildPlanFromTvMaze(await tvmaze.getTvSeasonsAndEpisodes(source.external_id)), provider: 'TVMAZE', insertOnly: false };
  }
  if (source.media_type === 'TV' && source.provider === 'TVDB') {
    return { plan: buildPlanFromTvDb(await tvdb.getSeriesEpisodes(source.external_id)), provider: 'TVDB', insertOnly: false };
  }

  if (source.media_type === 'TV') {
    const info = await loadSourceInfoByMediaId(source.id, 'TV');
    const fallbackReady = canFallBack(info);
    try {
      // TMDB is known to be unreachable and a fallback can answer: do not wait for it again
      if (fallbackReady && tmdbCircuitOpen()) throw new ProviderError('TMDB', 'NETWORK');
      const plan = await fetchTmdbTvPlan(source, { fast: fallbackReady, breaker: fallbackReady });
      return { plan, provider: 'TMDB', insertOnly: false };
    } catch (err) {
      if (!isFallbackWorthy(err) || !fallbackReady) throw err;
      console.warn(`[Episodes] TMDB failed for ${source.external_id} (${err.message}); trying TVMaze / TheTVDB.`);
      const fallback = await fetchPlanFallback(info, filled);
      if (!fallback) throw err; // nobody could help: report the original problem
      return { plan: fallback.plan, provider: fallback.source.provider, insertOnly: true };
    }
  }

  // ANIME: Season 1..N from the franchise chain (a single season for a standalone title or a lone sequel)
  return { plan: await planAnimeSeasons(source.external_id), provider: 'ANILIST', insertOnly: false }; // plan is [] while no episode count is reliable yet
}

async function persistPlan(mediaId, plan, db, { provider = null, insertOnly = false } = {}) {
  const client = await db.connect();
  let episodeTotal = 0;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`episodes:${mediaId}`]);

    for (const season of plan) {
      // A fallback provider only adds what is missing; it never rewrites an existing season.
      const { rows } = await client.query(
        `INSERT INTO public.seasons (media_id, season_number, name, overview, poster_path, air_date, episode_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (media_id, season_number) DO UPDATE
           SET name = EXCLUDED.name, overview = EXCLUDED.overview, poster_path = EXCLUDED.poster_path,
               air_date = EXCLUDED.air_date, episode_count = EXCLUDED.episode_count
         ${insertOnly ? 'WHERE false' : ''}
         RETURNING id`,
        [mediaId, season.seasonNumber, season.name, season.overview, season.posterUrl, season.airDate, season.episodeCount]
      );
      const seasonId =
        rows[0]?.id ??
        (await client.query('SELECT id FROM public.seasons WHERE media_id = $1 AND season_number = $2', [mediaId, season.seasonNumber])).rows[0].id;

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
             WHERE ${insertOnly ? 'false' : `(episodes.title, episodes.overview, episodes.air_date, episodes.runtime_minutes)
                   IS DISTINCT FROM (EXCLUDED.title, EXCLUDED.overview, EXCLUDED.air_date, EXCLUDED.runtime_minutes)`}`,
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
    if (provider && plan.length > 0) {
      // remember who supplied the episodes: anything other than TMDB / AniList is retried against TMDB soon
      await client.query(
        `UPDATE public.media_items SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('episodesSource', $2::text) WHERE id = $1`,
        [mediaId, provider]
      );
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

/** Season numbers that already have at least one stored episode. */
async function seasonsWithEpisodes(mediaId, db) {
  const { rows } = await db.query(
    `SELECT s.season_number FROM public.seasons s
      WHERE s.media_id = $1 AND EXISTS (SELECT 1 FROM public.episodes e WHERE e.season_id = s.id)`,
    [mediaId]
  );
  return new Set(rows.map((r) => r.season_number));
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
    const filled = await seasonsWithEpisodes(mediaId, db);
    const { plan, provider, insertOnly } = await fetchPlan(source, { filled });
    return persistPlan(mediaId, plan, db, { provider, insertOnly });
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
        // Anime seasons keep the AniList id of their entry in `overview` (internal marker, never shown)
        overview: r.season_overview?.startsWith(SEASON_SOURCE_PREFIX) ? null : r.season_overview,
        externalId: r.season_overview?.startsWith(SEASON_SOURCE_PREFIX) ? r.season_overview.slice(SEASON_SOURCE_PREFIX.length) : null,
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

/** Anime stored before franchise linking have no AniList marker on their seasons: sync them once more. */
const isLegacyAnime = (source, seasons) =>
  source.media_type === 'ANIME' && source.provider === 'ANILIST' && seasons.length > 0 && seasons.every((s) => !s.externalId);

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
  const age = Date.now() - newestUpdate;
  const ended = ENDED_STATUSES.has(status);
  const isAnilistAnime = source.media_type === 'ANIME' && source.provider === 'ANILIST';
  const isTmdbTv = source.media_type === 'TV' && source.provider === 'TMDB';
  const endedRecheck = isAnilistAnime ? ENDED_ANIME_RECHECK_MS : source.media_type === 'TV' ? ENDED_TV_RECHECK_MS : Infinity;
  const stale = seasons.length > 0 && (ended ? age > endedRecheck : age > STALE_AFTER_MS);
  // Episodes that a fallback provider supplied are checked against TMDB again soon (at most every few minutes)
  const degraded =
    isTmdbTv &&
    !['TMDB', undefined, null].includes(source.metadata?.episodesSource) &&
    Date.now() - (failedUpgrades.get(`degraded:${mediaId}`) ?? 0) > DEGRADED_RETRY_MS;
  const legacy = isLegacyAnime(source, seasons) && Date.now() - (failedUpgrades.get(mediaId) ?? 0) > UPGRADE_RETRY_MS;
  // A season that is known to have episodes but has none stored (its fetch failed earlier) is filled in again soon
  const gaps =
    seasons.some((s) => s.seasonNumber > 0 && s.episodeCount > 0 && s.episodes.length === 0) &&
    Date.now() - (failedUpgrades.get(`gaps:${mediaId}`) ?? 0) > GAP_RETRY_MS;

  // A title the provider has no episode data for yet is not re-requested on every page view.
  const recentlyEmpty = Date.now() - (emptySyncs.get(mediaId) ?? 0) < EMPTY_RETRY_MS;

  if ((seasons.length === 0 && !recentlyEmpty) || stale || legacy || gaps || degraded) {
    if (degraded) failedUpgrades.set(`degraded:${mediaId}`, Date.now());
    if (gaps) failedUpgrades.set(`gaps:${mediaId}`, Date.now()); // at most one gap-fill attempt per cool-down
    try {
      await syncSeasonsAndEpisodes(mediaId, db);
      ({ seasons } = await readSeasons(mediaId, db));
      if (seasons.length === 0) {
        if (emptySyncs.size >= 1000) emptySyncs.delete(emptySyncs.keys().next().value);
        emptySyncs.set(mediaId, Date.now());
      }
    } catch (err) {
      if (legacy) {
        if (failedUpgrades.size >= 1000) failedUpgrades.delete(failedUpgrades.keys().next().value);
        failedUpgrades.set(mediaId, Date.now());
      }
      if (seasons.length === 0) throw err;
      console.warn(`[Episodes] Refresh failed for ${mediaId}, serving stored data:`, err.message);
    }
  }
  return { mediaId, mediaType: source.media_type, supportsEpisodes: true, seasons };
}

export default { syncSeasonsAndEpisodes, getSeasonsForMedia };
