import { ProviderError, fetchWithTimeout, parseRetryAfter } from './providerError.js';

/**
 * TMDB v3 adapter. Auth: bearer "API Read Access Token" from the backend env.
 * The token is never sent to the browser.
 * Docs: https://developer.themoviedb.org/docs
 *
 * Returns RAW TMDB objects; services/mediaNormalizer.js converts them.
 */
const PROVIDER = 'TMDB';
const BASE_URL = 'https://api.themoviedb.org/3';

const limiter = { blockedUntil: 0 };

export function resetRateLimitState() {
  limiter.blockedUntil = 0;
}

export function isConfigured() {
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
  return Boolean(token) && token !== 'replace_me';
}

async function tmdbGet(path, params = {}) {
  if (!isConfigured()) throw new ProviderError(PROVIDER, 'NOT_CONFIGURED');

  if (limiter.blockedUntil > Date.now()) {
    const wait = Math.ceil((limiter.blockedUntil - Date.now()) / 1000);
    throw new ProviderError(PROVIDER, 'RATE_LIMITED', { retryAfterSeconds: wait });
  }

  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('language', 'en-US');
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  const res = await fetchWithTimeout(PROVIDER, url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.TMDB_API_READ_ACCESS_TOKEN}`,
      Accept: 'application/json'
    }
  });

  if (res.status === 429) {
    const retry = parseRetryAfter(res.headers.get('retry-after')) ?? 10;
    limiter.blockedUntil = Date.now() + retry * 1000;
    throw new ProviderError(PROVIDER, 'RATE_LIMITED', { retryAfterSeconds: retry, upstreamStatus: 429 });
  }
  if (res.status === 401 || res.status === 403) {
    throw new ProviderError(PROVIDER, 'AUTH', { upstreamStatus: res.status });
  }
  if (res.status === 404) throw new ProviderError(PROVIDER, 'NOT_FOUND', { upstreamStatus: 404 });
  if (res.status === 400 || res.status === 422) {
    throw new ProviderError(PROVIDER, 'BAD_REQUEST', { upstreamStatus: res.status });
  }
  if (!res.ok) throw new ProviderError(PROVIDER, 'UNAVAILABLE', { upstreamStatus: res.status });

  try {
    return await res.json();
  } catch {
    throw new ProviderError(PROVIDER, 'UNAVAILABLE', { upstreamStatus: res.status });
  }
}

// TMDB caps pagination at 500 pages.
const clampPage = (page) => Math.min(Math.max(Number(page) || 1, 1), 500);

function toPage(body) {
  const page = body?.page ?? 1;
  const totalPages = Math.min(body?.total_pages ?? 1, 500);
  return {
    items: body?.results ?? [],
    pageInfo: {
      page,
      totalPages,
      totalResults: body?.total_results ?? 0,
      hasNextPage: page < totalPages
    }
  };
}

export async function searchMovies({ query, page = 1, year } = {}) {
  return toPage(await tmdbGet('/search/movie', { query, page: clampPage(page), year, include_adult: false }));
}

export async function searchTv({ query, page = 1, year } = {}) {
  return toPage(
    await tmdbGet('/search/tv', { query, page: clampPage(page), first_air_date_year: year, include_adult: false })
  );
}

/** Browse (no text query): popularity-ordered discover, which supports genre and year filters. */
export async function discoverMovies({ page = 1, genreIds, year } = {}) {
  return toPage(
    await tmdbGet('/discover/movie', {
      page: clampPage(page),
      sort_by: 'popularity.desc',
      with_genres: genreIds?.length ? genreIds.join('|') : undefined, // '|' = match ANY of the genres
      primary_release_year: year,
      include_adult: false
    })
  );
}

export async function discoverTv({ page = 1, genreIds, year } = {}) {
  return toPage(
    await tmdbGet('/discover/tv', {
      page: clampPage(page),
      sort_by: 'popularity.desc',
      with_genres: genreIds?.length ? genreIds.join('|') : undefined, // '|' = match ANY of the genres
      first_air_date_year: year,
      include_adult: false
    })
  );
}

export const getMovieDetails = (id) => tmdbGet(`/movie/${encodeURIComponent(id)}`);
export const getTvDetails = (id) => tmdbGet(`/tv/${encodeURIComponent(id)}`);

/** One season of a TV show, including its episode list. */
export const getTvSeasonDetails = (tvId, seasonNumber) =>
  tmdbGet(`/tv/${encodeURIComponent(tvId)}/season/${encodeURIComponent(seasonNumber)}`);

/** `mediaType`: 'movie' | 'tv'. `window`: 'day' | 'week'. */
export async function getTrending({ mediaType, window = 'week', page = 1 } = {}) {
  return toPage(await tmdbGet(`/trending/${mediaType}/${window}`, { page: clampPage(page) }));
}

/** Genre list: [{ id, name }] for 'movie' or 'tv'. */
export async function getGenres(mediaType) {
  const body = await tmdbGet(`/genre/${mediaType}/list`);
  return body?.genres ?? [];
}
