import * as anilist from '../providers/anilist.provider.js';
import * as tmdb from '../providers/tmdb.provider.js';
import { ProviderError } from '../providers/providerError.js';
import { normalizeAniListMedia, normalizeTmdbMedia, compact } from './mediaNormalizer.js';
import { getFranchiseSummary } from './franchise.service.js';
import { readStoredDetails, isSnapshotFresh } from './catalogSnapshot.service.js';
import {
  isFallbackWorthy,
  loadSourceInfo,
  canFallBack,
  fetchDetailsFallback,
  rememberTitles
} from './fallbackProviders.service.js';
import { linkSource } from './mediaPersistence.service.js';
import { fetchListFallback, listFallbackAvailable } from './fallbackLists.service.js';
import { tmdbCircuitOpen } from '../providers/providerHealth.js';
import * as tvmaze from '../providers/tvmaze.provider.js';
import * as tvdb from '../providers/tvdb.provider.js';
import { normalizeTvMazeShow, normalizeTvDbMedia } from './mediaNormalizer.js';
import { upsertMediaFromDetails } from './mediaPersistence.service.js';
import { TTLCache } from '../utils/ttlCache.js';

/**
 * Chooses the right provider for each media type and shapes provider results
 * into the unified response.
 *
 *   ANIME -> AniList      MOVIE -> TMDB      TV -> TMDB
 *
 * Cached results are short-lived API responses, NOT catalog data. Permanent
 * catalog rows are only written when a details page is opened.
 */
const TTL = {
  trending: 10 * 60 * 1000,
  search: 90 * 1000,
  details: 30 * 60 * 1000,
  genres: 24 * 60 * 60 * 1000
};

// Exported so tests can clear it.
export const cache = new TTLCache({ maxEntries: 500 });

// provider-key -> catalog id of titles already saved to the database (bounded, process-local)
const persistedIds = new Map();
const PERSIST_TTL_MS = 6 * 60 * 60 * 1000;
const FALLBACK_CACHE_MS = 5 * 60 * 1000;

const PROVIDER_FOR_TYPE = { ANIME: 'ANILIST', MOVIE: 'TMDB', TV: 'TMDB' };
const TMDB_PATH = { MOVIE: 'movie', TV: 'tv' };
const ALL_TYPES = ['ANIME', 'MOVIE', 'TV'];

const typesFor = (type) => (type === 'ALL' ? ALL_TYPES : [type]);

const errorSummary = (err) => ({
  code: err.code || 'PROVIDER_ERROR',
  message: err.message,
  provider: err.provider ?? null,
  retryAfterSeconds: err.retryAfterSeconds ?? null
});

/** id -> name map for TMDB genre ids (cached 24h). */
async function getTmdbGenreMap(mediaType, opts) {
  const genres = await cache.getOrLoad(`genres:tmdb:${mediaType}`, TTL.genres, () =>
    tmdb.getGenres(TMDB_PATH[mediaType], opts)
  );
  return new Map(genres.map((g) => [g.id, g.name]));
}

// Last good answer per list, kept in memory (until restart) as the final safety net when every provider fails.
const lastGood = new Map();
const LAST_GOOD_MAX = 200;
const rememberGood = (key, result) => {
  lastGood.delete(key);
  lastGood.set(key, result);
  if (lastGood.size > LAST_GOOD_MAX) lastGood.delete(lastGood.keys().next().value);
  return result;
};
export const resetLastGoodLists = () => lastGood.clear();

/** Failures worth a fallback for LISTS: the transient ones, plus a missing or rejected TMDB token. */
const listFallbackWorthy = (err) => isFallbackWorthy(err) || (err instanceof ProviderError && ['NOT_CONFIGURED', 'AUTH'].includes(err.kind));

/**
 * One TMDB list (trending / browse / search) with the fallback chain behind it:
 *   1. while TMDB is known to be unreachable (circuit open) go straight to the fallback providers
 *   2. otherwise ask TMDB (one short attempt when a fallback exists, so a slow TMDB hands over quickly)
 *   3. on a transient failure: TVMaze / TheTVDB (see fallbackLists.service.js)
 *   4. if those fail too: the last good copy of this exact list (flagged stale), else the original error
 * A real "bad request" or "not found" from TMDB is never second-guessed.
 */
async function tmdbListWithFallback({ key, mediaType, primary, fallback }) {
  const canFall = listFallbackAvailable(mediaType);
  const tryFallback = async () => {
    try {
      const result = await fallback();
      return result ? rememberGood(key, result) : null;
    } catch (err) {
      console.warn(`[MediaCatalog] Fallback for ${key} failed: ${err.message}`);
      return null;
    }
  };

  if (canFall && tmdbCircuitOpen()) {
    const result = await tryFallback();
    if (result) return result;
  }
  try {
    return rememberGood(key, await primary({ fast: canFall }));
  } catch (err) {
    if (!listFallbackWorthy(err)) throw err;
    console.warn(`[MediaCatalog] TMDB failed for ${key} (${err.message}); trying the fallback providers.`);
    if (canFall) {
      const result = await tryFallback();
      if (result) return result;
    }
    const stale = lastGood.get(key);
    if (stale) return { ...stale, extra: { ...stale.extra, stale: true, label: 'Showing your last results (TMDB is unreachable)' } };
    throw err;
  }
}

/** Runs one provider call for one media type and returns a normalized "group". */
async function buildGroup(mediaType, loader) {
  const { items, pageInfo, extra } = await loader();
  return {
    mediaType,
    provider: PROVIDER_FOR_TYPE[mediaType],
    results: items,
    pagination: pageInfo,
    ...extra
  };
}

/**
 * Runs a group for each requested type concurrently.
 * - single type: errors propagate (so the HTTP status is meaningful)
 * - ALL: a failing provider becomes `group.error`; successful groups are kept
 */
async function runGroups(type, makeGroup) {
  const types = typesFor(type);
  if (types.length === 1) return [await makeGroup(types[0])];

  const settled = await Promise.allSettled(types.map((t) => makeGroup(t)));
  const groups = settled.map((outcome, i) => {
    if (outcome.status === 'fulfilled') return { ...outcome.value, error: null };
    const err = outcome.reason;
    if (!(err instanceof ProviderError)) {
      console.error(`[MediaCatalog] Unexpected failure for ${types[i]}:`, err);
    }
    return {
      mediaType: types[i],
      provider: PROVIDER_FOR_TYPE[types[i]],
      results: [],
      pagination: { page: 1, totalPages: 0, totalResults: 0, hasNextPage: false },
      error: err instanceof ProviderError ? errorSummary(err) : { code: 'INTERNAL_ERROR', message: 'Unexpected error.' }
    };
  });

  // If everything failed there is nothing useful to show: surface the first error normally.
  const firstFailure = settled.find((o) => o.status === 'rejected');
  if (firstFailure && settled.every((o) => o.status === 'rejected')) throw firstFailure.reason;
  return groups;
}

const withNoError = (group) => ({ ...group, error: group.error ?? null });

// ------------------------------------------------------------------ search --

/** Genre names a provider supports for one media type (cached 24h; shared with the genres endpoint). */
function providerGenreNames(mediaType) {
  return cache.getOrLoad(`genres:list:${mediaType}`, TTL.genres, async () => {
    if (mediaType === 'ANIME') return anilist.getAnimeGenres();
    return (await tmdb.getGenres(TMDB_PATH[mediaType])).map((g) => g.name);
  });
}

const EMPTY_PAGE = (page) => ({ page, totalPages: 0, totalResults: 0, hasNextPage: false });

async function searchGroup(mediaType, { q, page, genre, year }) {
  // `genre` is an array of names ("match any"); a single string is accepted for backward compatibility.
  const wanted = (Array.isArray(genre) ? genre : genre ? [genre] : []).map((g) => g.trim()).filter(Boolean);
  const genreKey = wanted.map((g) => g.toLowerCase()).sort().join('|');
  const key = `search:${mediaType}:${(q || '').toLowerCase()}:${page}:${genreKey}:${year || ''}`;

  return cache.getOrLoad(key, q ? TTL.search : TTL.trending, () =>
    buildGroup(mediaType, async () => {
      if (mediaType === 'ANIME') {
        let genres;
        if (wanted.length > 0) {
          // Keep only names AniList really has, so one unknown name cannot break the request.
          const known = await providerGenreNames('ANIME');
          genres = wanted.map((w) => known.find((k) => k.toLowerCase() === w.toLowerCase())).filter(Boolean);
          if (genres.length === 0) return { items: [], pageInfo: EMPTY_PAGE(page) };
        }
        const { items, pageInfo } = await anilist.searchAnime({ search: q, page, genres, year });
        return { items: compact(items.map(normalizeAniListMedia)), pageInfo };
      }

      return tmdbListWithFallback({
        key,
        mediaType,
        fallback: () => fetchListFallback(mediaType, { q, page, year, genres: wanted }),
        primary: async (opts) => {
      const genreMap = await getTmdbGenreMap(mediaType, opts);
      const ignoredFilters = [];
      let genreIds;
      if (wanted.length > 0) {
        if (q) {
          // TMDB's text search cannot filter by genre; say so instead of silently mis-filtering.
          ignoredFilters.push('genre');
        } else {
          const byName = new Map([...genreMap.entries()].map(([id, name]) => [name.toLowerCase(), id]));
          genreIds = [...new Set(wanted.map((w) => byName.get(w.toLowerCase())).filter((id) => id !== undefined))];
          if (genreIds.length === 0) {
            // This provider has none of the chosen genres for this type -> honest empty result.
            return { items: [], pageInfo: EMPTY_PAGE(page), extra: { ignoredFilters } };
          }
        }
      }

      let page$;
      if (mediaType === 'MOVIE') {
        page$ = q
          ? await tmdb.searchMovies({ query: q, page, year }, opts)
          : await tmdb.discoverMovies({ page, genreIds, year }, opts);
      } else {
        page$ = q ? await tmdb.searchTv({ query: q, page, year }, opts) : await tmdb.discoverTv({ page, genreIds, year }, opts);
      }
      const items = compact(page$.items.map((raw) => normalizeTmdbMedia(raw, mediaType, genreMap)));
      rememberTitles(items);
      return { items, pageInfo: page$.pageInfo, extra: { ignoredFilters } };
        }
      });
    })
  );
}

export async function searchMedia({ q, type, page, genre, year }) {
  const groups = await runGroups(type, (t) => searchGroup(t, { q, page, genre, year }));
  return {
    type,
    query: q || null,
    mode: q ? 'search' : 'browse',
    page,
    groups: groups.map(withNoError)
  };
}

// ---------------------------------------------------------------- trending --

async function trendingGroup(mediaType, { window, page }) {
  const effectiveWindow = mediaType === 'ANIME' ? 'ranking' : window;
  const key = `trending:${mediaType}:${effectiveWindow}:${page}`;
  return cache.getOrLoad(key, TTL.trending, () =>
    buildGroup(mediaType, async () => {
      if (mediaType === 'ANIME') {
        const { items, pageInfo } = await anilist.getTrendingAnime({ page });
        return {
          items: compact(items.map(normalizeAniListMedia)),
          pageInfo,
          extra: {
            window: null,
            // AniList exposes only its own trending ranking, no day/week/month filter.
            label: 'AniList trending ranking'
          }
        };
      }
      return tmdbListWithFallback({
        key,
        mediaType,
        fallback: async () => {
          const fb = await fetchListFallback(mediaType, { page });
          return fb && { ...fb, extra: { ...fb.extra, window } };
        },
        primary: async (opts) => {
          const genreMap = await getTmdbGenreMap(mediaType, opts);
          const { items, pageInfo } = await tmdb.getTrending({ mediaType: TMDB_PATH[mediaType], window, page }, opts);
          const normalized = compact(items.map((raw) => normalizeTmdbMedia(raw, mediaType, genreMap)));
          rememberTitles(normalized);
          return {
            items: normalized,
            pageInfo,
            extra: { window, label: window === 'day' ? 'Trending today on TMDB' : 'Trending this week on TMDB' }
          };
        }
      });
    })
  );
}

export async function getTrendingMedia({ type, window, page }) {
  const groups = await runGroups(type, (t) => trendingGroup(t, { window, page }));
  return { type, window, page, groups: groups.map(withNoError) };
}

// ----------------------------------------------------------------- details --

/**
 * Anime are tracked SERIES-wise: every season is one linked AniList entry, and the whole series lives
 * under its first season. For a sequel this returns where it belongs, so tracking from its page adds
 * (and updates) the one series entry instead of a lone season:
 *   { rootExternalId, rootTitle, rootCatalogId, seasonNumber, totalSeasons }
 * Returns null for the first season, standalone anime, or when the lookup is unavailable (the page
 * then simply tracks the title on its own).
 */
async function resolveSeries(externalId) {
  try {
    const franchise = await getFranchiseSummary(externalId);
    if (!franchise.isFranchise || franchise.isRoot || !franchise.root) return null;
    const root = await getMediaDetails({ provider: 'ANILIST', mediaType: 'ANIME', externalId: franchise.root.externalId });
    if (!root.catalogId) return null;
    return {
      rootExternalId: franchise.root.externalId,
      rootTitle: franchise.root.title,
      rootCatalogId: root.catalogId,
      seasonNumber: franchise.seasonNumber,
      totalSeasons: franchise.totalSeasons
    };
  } catch (err) {
    console.warn(`[MediaCatalog] Series lookup failed for AniList ${externalId}:`, err.message);
    return null;
  }
}

/**
 * One title's details from its provider.
 *
 * TMDB titles are covered by a fallback chain (TMDB -> TVMaze -> TheTVDB; movies: TMDB -> TheTVDB) for the
 * failures a retry cannot fix: timeouts, dropped connections, 5xx, rate limits. A 404 is final.
 * `hasStored`: a stored copy exists and will cover a failure better than a thinner fallback record, so
 * TMDB just gets its short attempt and the caller serves the stored copy.
 *
 * Returns { media, fallback }. `fallback` is set when another provider supplied the data:
 * { existingMediaId } when the title already has a catalog row (that row is left untouched).
 */
async function fetchDetailsFromProvider(provider, mediaType, externalId, { hasStored = false } = {}) {
  if (provider === 'ANILIST') {
    const media = normalizeAniListMedia(await anilist.getAnimeDetails(externalId));
    if (!media) throw new ProviderError('AniList', 'NOT_FOUND');
    return { media, fallback: null };
  }

  if (provider === 'TVMAZE') {
    const media = normalizeTvMazeShow(await tvmaze.getTvDetails(externalId));
    if (!media) throw new ProviderError('TVMaze', 'NOT_FOUND');
    return { media, fallback: null };
  }
  if (provider === 'TVDB') {
    const raw = mediaType === 'MOVIE' ? await tvdb.getMovieDetails(externalId) : await tvdb.getSeriesDetails(externalId);
    const media = normalizeTvDbMedia(raw, mediaType);
    if (!media) throw new ProviderError('TheTVDB', 'NOT_FOUND');
    return { media, fallback: null };
  }

  const info = hasStored ? null : await loadSourceInfo({ provider, mediaType, externalId });
  const fallbackReady = hasStored || canFallBack(info);
  try {
    // TMDB is known to be unreachable and something else can answer: do not wait for it again
    if (fallbackReady && tmdbCircuitOpen()) throw new ProviderError('TMDB', 'NETWORK');
    const opts = { fast: fallbackReady }; // a fallback is ready: hand over after a short attempt
    const raw =
      mediaType === 'MOVIE' ? await tmdb.getMovieDetails(externalId, opts) : await tmdb.getTvDetails(externalId, opts);
    const media = normalizeTmdbMedia(raw, mediaType);
    if (!media) throw new ProviderError('TMDB', 'NOT_FOUND');
    rememberTitles([media]);
    return { media, fallback: null };
  } catch (err) {
    if (hasStored || !isFallbackWorthy(err) || !canFallBack(info)) throw err;
    console.warn(`[MediaCatalog] TMDB failed for ${mediaType} ${externalId} (${err.message}); trying the fallback providers.`);
    const result = await fetchDetailsFallback({ provider, mediaType, externalId }, info);
    if (!result) throw err; // nobody could help: report the original problem
    if (info.mediaId) {
      // the title is already in the catalog: keep its row as it is, just remember the extra provider id
      try {
        await linkSource(info.mediaId, result.source.provider, mediaType, result.source.externalId);
      } catch (linkErr) {
        console.warn('[MediaCatalog] Could not link the fallback source:', linkErr.message);
      }
      return { media: result.media, fallback: { existingMediaId: info.mediaId } };
    }
    return { media: result.media, fallback: { existingMediaId: null } };
  }
}

export async function getMediaDetails({ provider, mediaType, externalId, refresh = false }) {
  const key = `details:${provider}:${mediaType}:${externalId}`;
  const result = await cache.getOrLoad(
    key,
    TTL.details,
    async () => {
      // 1. The database first: a title we already know is not blocked on a live provider call.
      const stored = await readStoredDetails(provider, mediaType, externalId);
      let media;
      let catalogId = null;
      let fromStore = false;
      if (stored && !refresh && isSnapshotFresh(stored)) {
        media = stored.media;
        catalogId = stored.id;
        fromStore = true;
      } else {
        try {
          const fetched = await fetchDetailsFromProvider(provider, mediaType, externalId, { hasStored: Boolean(stored) });
          media = fetched.media;
          if (fetched.fallback?.existingMediaId) {
            catalogId = fetched.fallback.existingMediaId;
            fromStore = true; // existing row: nothing is written over it
          }
        } catch (err) {
          // 2. The provider is slow or down: a stale stored copy beats an error page.
          if (stored && err instanceof ProviderError && err.kind !== 'NOT_FOUND') {
            console.warn(`[MediaCatalog] ${provider} failed (${err.message}); serving the stored copy of ${externalId}.`);
            media = stored.media;
            catalogId = stored.id;
            fromStore = true;
          } else {
            throw err;
          }
        }
      }

      // Opening a details page adds the title to the shared catalog (idempotent upsert).
      // A database problem must not break browsing, so it is logged and the page still renders.
      // A title saved recently is not saved again (the database is remote: ~10 round trips per save).
      // `refresh` forces a re-save.
      if (!fromStore) {
        const known = persistedIds.get(key);
        if (known && !refresh && Date.now() - known.at < PERSIST_TTL_MS) {
          catalogId = known.id;
        } else {
          try {
            catalogId = await upsertMediaFromDetails(media);
            if (persistedIds.size >= 2000) persistedIds.delete(persistedIds.keys().next().value);
            // data from a fallback provider must not block the richer TMDB copy from being saved later
            if (!media.dataSource) persistedIds.set(key, { id: catalogId, at: Date.now() });
          } catch (err) {
            console.error('[MediaCatalog] Could not persist media to catalog:', err.message);
          }
        }
      }
      const series = provider === 'ANILIST' && mediaType === 'ANIME' ? await resolveSeries(externalId) : null;
      return series ? { ...media, catalogId, series } : { ...media, catalogId };
    },
    { refresh }
  );
  // A record that came from a fallback provider is only kept briefly, so TMDB is asked again soon.
  if (result.dataSource && result.dataSource !== result.provider) cache.set(key, result, FALLBACK_CACHE_MS);
  return result;
}

// ------------------------------------------------------------------ genres --

export async function getGenreOptions({ type }) {
  const types = typesFor(type);
  const settled = await Promise.allSettled(
    types.map((t) =>
      providerGenreNames(t)
    )
  );

  if (types.length === 1 && settled[0].status === 'rejected') throw settled[0].reason;
  if (settled.every((o) => o.status === 'rejected')) throw settled[0].reason;

  const names = new Map(); // lowercase -> display name (case-insensitive union)
  const errors = [];
  settled.forEach((outcome, i) => {
    if (outcome.status === 'fulfilled') {
      outcome.value.forEach((name) => {
        if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
      });
    } else if (outcome.reason instanceof ProviderError) {
      errors.push({ mediaType: types[i], ...errorSummary(outcome.reason) });
    }
  });

  return {
    type,
    genres: [...names.values()].sort((a, b) => a.localeCompare(b)),
    errors
  };
}

export default { searchMedia, getTrendingMedia, getMediaDetails, getGenreOptions, cache };
