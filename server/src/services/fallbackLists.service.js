import * as tvmaze from '../providers/tvmaze.provider.js';
import * as tvdb from '../providers/tvdb.provider.js';
import { normalizeTvMazeShow, normalizeTvDbMedia } from './mediaNormalizer.js';
import { TTLCache } from '../utils/ttlCache.js';

/**
 * Lists (trending, browse, search) for TV shows and movies when TMDB cannot serve them.
 *
 *   TV      TVMaze (no key): what is airing right now, ranked by TVMaze's own popularity weight; its search.
 *           then TheTVDB (key): the catalogue ranked by score, its search.
 *   Movies  TheTVDB (key): the catalogue ranked by score for this and last year, its search.
 *           TVMaze has no movies.
 *
 * Items keep the identity of the provider that supplied them (provider 'TVMAZE' / 'TVDB'), so opening one
 * shows its details and episodes from that same provider. Nothing here touches the database.
 * Returns the same { items, pageInfo, extra } shape as the TMDB code, or null when no fallback can help.
 */
export const PAGE_SIZE = 20;
const SCHEDULE_DAYS = 3;
const LIST_TTL_MS = 10 * 60 * 1000;
const EXCLUDED_SHOW_TYPES = new Set(['News', 'Sports', 'Talk Show', 'Game Show', 'Variety']);
const UNRELEASED = /announced|pre-?production|filming|post-?production|in production|planned|upcoming|cancel/i;

const cache = new TTLCache({ maxEntries: 60 });
export const resetFallbackListCache = () => cache.clear();

const isoDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
const thisYear = () => new Date().getUTCFullYear();

function paginate(all, page) {
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const current = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  return {
    items: all.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    pageInfo: { page: current, totalPages: all.length === 0 ? 0 : totalPages, totalResults: all.length, hasNextPage: current < totalPages }
  };
}

const quiet = (label, err) => console.warn(`[FallbackLists] ${label} failed: ${err.message}`);

const matchesGenres = (media, wanted) =>
  wanted.length === 0 || media.genres.some((g) => wanted.some((w) => w.toLowerCase() === g.toLowerCase()));
const matchesYear = (media, year) => !year || media.releaseYear === Number(year);

// -------------------------------------------------------------------- TVMaze ---

/** Shows airing in the next few days (US schedule + streaming), most popular first. Cached 10 minutes. */
function tvMazePopularShows() {
  return cache.getOrLoad('tvmaze:popular', LIST_TTL_MS, async () => {
    const requests = [];
    for (let d = 0; d < SCHEDULE_DAYS; d++) {
      requests.push(tvmaze.getSchedule(isoDay(d)), tvmaze.getWebSchedule(isoDay(d)));
    }
    const settled = await Promise.allSettled(requests);
    if (settled.every((s) => s.status === 'rejected')) throw settled[0].reason;

    const byId = new Map();
    for (const outcome of settled) {
      if (outcome.status !== 'fulfilled') continue;
      for (const episode of outcome.value) {
        const show = episode?.show ?? episode?._embedded?.show;
        if (!show?.id || !(show.image?.original || show.image?.medium)) continue;
        if (EXCLUDED_SHOW_TYPES.has(show.type)) continue;
        if (!byId.has(show.id)) byId.set(show.id, show);
      }
    }
    return [...byId.values()].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0) || (b.rating?.average ?? 0) - (a.rating?.average ?? 0));
  });
}

async function tvMazeList({ q, page, year, genres }) {
  const shows = q ? await tvmaze.searchTv(q) : await tvMazePopularShows();
  const media = shows.map(normalizeTvMazeShow).filter(Boolean);
  const filtered = media.filter((m) => matchesYear(m, year) && (q ? true : matchesGenres(m, genres)));
  const { items, pageInfo } = paginate(filtered, page);
  return {
    items,
    pageInfo,
    extra: {
      ignoredFilters: q && genres.length ? ['genre'] : [],
      label: q ? 'Results from TVMaze (TMDB is unavailable)' : 'Airing now on TVMaze (TMDB is unavailable)',
      source: 'TVMAZE',
      provider: 'TVMAZE',
      degraded: true
    }
  };
}

// ------------------------------------------------------------------ TheTVDB ---

/** Catalogue records for this and last year, best score first. Cached 10 minutes. */
function tvdbCatalogue(kind, year) {
  return cache.getOrLoad(`tvdb:${kind}:${year ?? 'recent'}`, LIST_TTL_MS, async () => {
    const years = year ? [Number(year)] : [thisYear(), thisYear() - 1];
    const fetchOne = (y) => (kind === 'movie' ? tvdb.filterMovies({ year: y }) : tvdb.filterSeries({ year: y }));
    const lists = await Promise.all(years.map(fetchOne));
    const unique = new Map();
    for (const r of lists.flat()) if (r?.id != null && !unique.has(r.id)) unique.set(r.id, r);
    return [...unique.values()]
      .filter((r) => r.image && !UNRELEASED.test(r.status?.name ?? ''))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  });
}

async function tvdbList(kind, { q, page, year, genres }) {
  const mediaType = kind === 'movie' ? 'MOVIE' : 'TV';
  const records = q ? await tvdb.search(q, kind === 'movie' ? 'movie' : 'series') : await tvdbCatalogue(kind, year);
  const media = records.map((r) => normalizeTvDbMedia(r, mediaType)).filter(Boolean);
  const filtered = media.filter((m) => matchesYear(m, year) && (q ? true : matchesGenres(m, genres)));
  const { items, pageInfo } = paginate(filtered, page);
  return {
    items,
    pageInfo,
    extra: {
      ignoredFilters: genres.length && !q ? [] : genres.length ? ['genre'] : [],
      label: q ? 'Results from TheTVDB (TMDB is unavailable)' : 'Popular on TheTVDB (TMDB is unavailable)',
      source: 'TVDB',
      provider: 'TVDB',
      degraded: true
    }
  };
}

// ---------------------------------------------------------------- the chain ---

/** True when some fallback could serve lists for this media type. */
export const listFallbackAvailable = (mediaType) => (mediaType === 'MOVIE' ? tvdb.isConfigured() : true);

/**
 * @param {'TV'|'MOVIE'} mediaType
 * @param {{ q?: string, page?: number, year?: string|number, genres?: string[] }} params
 */
export async function fetchListFallback(mediaType, { q = '', page = 1, year = '', genres = [] } = {}) {
  const params = { q: q.trim(), page, year, genres };
  if (mediaType === 'TV') {
    try {
      return await tvMazeList(params);
    } catch (err) {
      quiet('TVMaze', err);
    }
    if (tvdb.isConfigured()) {
      try {
        return await tvdbList('series', params);
      } catch (err) {
        quiet('TheTVDB series', err);
      }
    }
    return null;
  }
  if (tvdb.isConfigured()) {
    try {
      return await tvdbList('movie', params);
    } catch (err) {
      quiet('TheTVDB movies', err);
    }
  }
  return null;
}
