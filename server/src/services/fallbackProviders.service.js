import { pool } from '../config/database.js';
import { ProviderError } from '../providers/providerError.js';
import * as tvmaze from '../providers/tvmaze.provider.js';
import * as tvdb from '../providers/tvdb.provider.js';
import {
  normalizeTvMazeShow,
  normalizeTvDbMedia,
  buildPlanFromTvMaze,
  buildPlanFromTvDb
} from './mediaNormalizer.js';
import { pickTitleMatch } from '../utils/titleMatch.js';
import { linkSource } from './mediaPersistence.service.js';

/**
 * The fallback chain behind TMDB:  TMDB -> TVMaze -> TheTVDB.
 *
 * It only runs when TMDB is slow or failing (timeout, dropped connection, 5xx, rate limit); a 404 is a real
 * "no such title" and is never second-guessed. Nothing here changes how a title is identified: the
 * title keeps its one internal id (media_items.id), so user libraries, groups and episode progress,
 * which point at that id and at episodes.id, are untouched whichever provider supplied the data.
 *
 * How a fallback finds the same show (best first, never a guess):
 *   1. a TVMaze / TheTVDB id already linked to the title (media_sources)
 *   2. an exact id match from TMDB's external ids (IMDb, TheTVDB)
 *   3. an exact title match (same normalized title, premiere year within one year)
 */
const FALLBACK_KINDS = new Set(['TIMEOUT', 'NETWORK', 'UNAVAILABLE', 'RATE_LIMITED']);

/** Is this the kind of TMDB failure a fallback should cover? */
export const isFallbackWorthy = (err) => err instanceof ProviderError && FALLBACK_KINDS.has(err.kind);

// ---- titles seen in search / trending results, so a title can be matched even before it was ever stored
const titleIndex = new Map(); // `${provider}:${type}:${id}` -> { title, year }
const INDEX_MAX = 5000;

export function rememberTitles(items) {
  for (const m of items ?? []) {
    if (!m?.title || !m.externalId) continue;
    const key = `${m.provider}:${m.mediaType}:${m.externalId}`;
    titleIndex.delete(key);
    titleIndex.set(key, { title: m.title, year: m.releaseYear ?? null });
    if (titleIndex.size > INDEX_MAX) titleIndex.delete(titleIndex.keys().next().value);
  }
}
export const resetTitleIndex = () => titleIndex.clear();

const yearFromDate = (d) => (d ? new Date(d).getUTCFullYear() : null);

function toInfo(row, mediaType, fallbackTitle) {
  const linked = row?.linked ?? {};
  return {
    mediaId: row?.id ?? null,
    mediaType,
    title: row?.title ?? fallbackTitle?.title ?? null,
    year: row?.release_date ? yearFromDate(row.release_date) : fallbackTitle?.year ?? null,
    externalIds: row?.ext ?? {},
    tvmazeId: linked.TVMAZE ?? null,
    tvdbId: linked.TVDB ?? null
  };
}

const INFO_SELECT = `
  SELECT mi.id, mi.title, mi.release_date, mi.metadata->'externalIds' AS ext,
         (SELECT json_object_agg(l.provider, l.external_id)
            FROM public.media_sources l
           WHERE l.media_id = mi.id AND l.provider IN ('TVMAZE', 'TVDB')) AS linked
    FROM public.media_sources ms
    JOIN public.media_items mi ON mi.id = ms.media_id`;

/** What we know about a title, by its provider identity. Works even when the title was never stored. */
export async function loadSourceInfo({ provider, mediaType, externalId }, db = pool) {
  let row = null;
  try {
    const res = await db.query(`${INFO_SELECT} WHERE ms.provider = $1 AND ms.provider_media_type = $2 AND ms.external_id = $3 LIMIT 1`, [
      provider,
      mediaType,
      String(externalId)
    ]);
    row = res.rows[0] ?? null;
  } catch (err) {
    console.warn('[Fallback] Could not read the stored title:', err.message);
  }
  return toInfo(row, mediaType, titleIndex.get(`${provider}:${mediaType}:${externalId}`));
}

/** The same, by internal id (used while syncing episodes). */
export async function loadSourceInfoByMediaId(mediaId, mediaType, db = pool) {
  let row = null;
  try {
    const res = await db.query(`${INFO_SELECT} WHERE mi.id = $1 LIMIT 1`, [mediaId]);
    row = res.rows[0] ?? null;
  } catch (err) {
    console.warn('[Fallback] Could not read the stored title:', err.message);
  }
  return toInfo(row, mediaType, null);
}

/** Is there anything to look the title up by? Decides whether TMDB gets the short "hand over quickly" budget. */
export function canFallBack(info) {
  if (!info) return false;
  const hasHandle = Boolean(info.title || info.tvmazeId || info.tvdbId || info.externalIds?.imdb || info.externalIds?.tvdb);
  return info.mediaType === 'MOVIE' ? tvdb.isConfigured() && hasHandle : hasHandle;
}

// ------------------------------------------------------------- id resolution ---

async function resolveTvMazeId(info) {
  if (info.tvmazeId) return String(info.tvmazeId);
  if (info.externalIds?.imdb) {
    const show = await tvmaze.lookupByExternalId({ imdb: info.externalIds.imdb });
    if (show?.id) return String(show.id);
  }
  if (info.externalIds?.tvdb) {
    const show = await tvmaze.lookupByExternalId({ thetvdb: info.externalIds.tvdb });
    if (show?.id) return String(show.id);
  }
  if (info.title) {
    const show = await tvmaze.lookupByTitle(info.title, info.year);
    if (show?.id) return String(show.id);
  }
  return null;
}

async function resolveTvdbId(info) {
  if (info.tvdbId) return String(info.tvdbId);
  if (info.mediaType === 'TV' && info.externalIds?.tvdb) return String(info.externalIds.tvdb);
  if (!info.title) return null;
  const hits = await tvdb.search(info.title, info.mediaType === 'MOVIE' ? 'movie' : 'series');
  const match = pickTitleMatch(
    hits.map((h) => ({ name: h.name, year: Number(h.year) || null, hit: h })),
    { title: info.title, year: info.year }
  );
  const id = match?.hit?.tvdb_id ?? match?.hit?.id;
  return id != null ? String(id).replace(/^(series|movie)-/, '') : null;
}

const quiet = (label, err) => console.warn(`[Fallback] ${label} failed: ${err.message}`);

// ----------------------------------------------------------------- details ---

/**
 * Title details from TVMaze, then TheTVDB (TV) or TheTVDB (movies). Returns
 *   { media, source: { provider, externalId } }  or null when no tier could supply the title.
 * `media` carries the TMDB identity that was asked for, so it is stored under the SAME title.
 */
export async function fetchDetailsFallback({ provider, mediaType, externalId }, info) {
  let media = null;
  let source = null;

  if (mediaType === 'TV') {
    try {
      const id = await resolveTvMazeId(info);
      if (id) {
        media = normalizeTvMazeShow(await tvmaze.getTvDetails(id));
        if (media) source = { provider: 'TVMAZE', externalId: id };
      }
    } catch (err) {
      quiet('TVMaze', err);
    }
  }

  if (!media && tvdb.isConfigured()) {
    try {
      const id = await resolveTvdbId({ ...info, mediaType });
      if (id) {
        const raw = mediaType === 'MOVIE' ? await tvdb.getMovieDetails(id) : await tvdb.getSeriesDetails(id);
        media = normalizeTvDbMedia(raw, mediaType);
        if (media) source = { provider: 'TVDB', externalId: id };
      }
    } catch (err) {
      quiet('TheTVDB', err);
    }
  }

  if (!media) return null;
  return {
    media: {
      ...media,
      provider, // the identity that was requested: user data keeps pointing at the same title
      externalId: String(externalId),
      mediaType,
      dataSource: source.provider,
      alsoKnownAs: [{ provider: source.provider, externalId: source.externalId, mediaType }]
    },
    source
  };
}

// ---------------------------------------------------------------- episodes ---

/**
 * Season/episode plan from TVMaze (one fast payload for the whole show), then TheTVDB.
 * Seasons listed in `skipSeasons` (already stored with episodes) are left out: a fallback only ever fills
 * what is missing. Returns { plan, source: { provider, externalId } } or null.
 */
export async function fetchPlanFallback(info, skipSeasons = new Set()) {
  const keep = (plan) => plan.filter((s) => !skipSeasons.has(s.seasonNumber) && s.episodes.length > 0);

  try {
    const id = await resolveTvMazeId(info);
    if (id) {
      const plan = buildPlanFromTvMaze(await tvmaze.getTvSeasonsAndEpisodes(id));
      if (plan.some((s) => s.episodes.length > 0)) return await withLink(info, { plan: keep(plan), source: { provider: 'TVMAZE', externalId: id } });
    }
  } catch (err) {
    quiet('TVMaze episodes', err);
  }

  if (tvdb.isConfigured()) {
    try {
      const id = await resolveTvdbId({ ...info, mediaType: 'TV' });
      if (id) {
        const plan = buildPlanFromTvDb(await tvdb.getSeriesEpisodes(id));
        if (plan.some((s) => s.episodes.length > 0)) return await withLink(info, { plan: keep(plan), source: { provider: 'TVDB', externalId: id } });
      }
    } catch (err) {
      quiet('TheTVDB episodes', err);
    }
  }
  return null;
}

/** Remember which TVMaze / TheTVDB record this title maps to, so the next lookup is direct. */
async function withLink(info, result) {
  if (info.mediaId) {
    try {
      await linkSource(info.mediaId, result.source.provider, 'TV', result.source.externalId);
    } catch (err) {
      quiet('Linking the source', err);
    }
  }
  return result;
}
