import * as anilist from '../providers/anilist.provider.js';
import * as tmdb from '../providers/tmdb.provider.js';
import { ProviderError } from '../providers/providerError.js';
import { normalizeAniListMedia, normalizeTmdbMedia, compact } from './mediaNormalizer.js';
import { getFranchiseSummary } from './franchise.service.js';
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
async function getTmdbGenreMap(mediaType) {
  const genres = await cache.getOrLoad(`genres:tmdb:${mediaType}`, TTL.genres, () =>
    tmdb.getGenres(TMDB_PATH[mediaType])
  );
  return new Map(genres.map((g) => [g.id, g.name]));
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

      const genreMap = await getTmdbGenreMap(mediaType);
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
          ? await tmdb.searchMovies({ query: q, page, year })
          : await tmdb.discoverMovies({ page, genreIds, year });
      } else {
        page$ = q ? await tmdb.searchTv({ query: q, page, year }) : await tmdb.discoverTv({ page, genreIds, year });
      }
      return {
        items: compact(page$.items.map((raw) => normalizeTmdbMedia(raw, mediaType, genreMap))),
        pageInfo: page$.pageInfo,
        extra: { ignoredFilters }
      };
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
      const genreMap = await getTmdbGenreMap(mediaType);
      const { items, pageInfo } = await tmdb.getTrending({ mediaType: TMDB_PATH[mediaType], window, page });
      return {
        items: compact(items.map((raw) => normalizeTmdbMedia(raw, mediaType, genreMap))),
        pageInfo,
        extra: { window, label: window === 'day' ? 'Trending today on TMDB' : 'Trending this week on TMDB' }
      };
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

export async function getMediaDetails({ provider, mediaType, externalId, refresh = false }) {
  const key = `details:${provider}:${mediaType}:${externalId}`;
  return cache.getOrLoad(
    key,
    TTL.details,
    async () => {
      let media;
      if (provider === 'ANILIST') {
        media = normalizeAniListMedia(await anilist.getAnimeDetails(externalId));
      } else {
        const raw =
          mediaType === 'MOVIE' ? await tmdb.getMovieDetails(externalId) : await tmdb.getTvDetails(externalId);
        media = normalizeTmdbMedia(raw, mediaType);
      }
      if (!media) throw new ProviderError(provider === 'ANILIST' ? 'AniList' : 'TMDB', 'NOT_FOUND');

      // Opening a details page adds the title to the shared catalog (idempotent upsert).
      // A database problem must not break browsing, so it is logged and the page still renders.
      // A title saved recently is not saved again (the database is remote: ~10 round trips per save).
      // `refresh` forces a re-save.
      let catalogId = null;
      const known = persistedIds.get(key);
      if (known && !refresh && Date.now() - known.at < PERSIST_TTL_MS) {
        catalogId = known.id;
      } else {
        try {
          catalogId = await upsertMediaFromDetails(media);
          if (persistedIds.size >= 2000) persistedIds.delete(persistedIds.keys().next().value);
          persistedIds.set(key, { id: catalogId, at: Date.now() });
        } catch (err) {
          console.error('[MediaCatalog] Could not persist media to catalog:', err.message);
        }
      }
      const series = provider === 'ANILIST' && mediaType === 'ANIME' ? await resolveSeries(externalId) : null;
      return series ? { ...media, catalogId, series } : { ...media, catalogId };
    },
    { refresh }
  );
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
