import { ProviderError, fetchWithTimeout, parseRetryAfter } from './providerError.js';
import { recordTmdbFailure, recordTmdbSuccess } from './providerHealth.js';

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

export const FAST_TIMEOUT_MS = 6000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** 500 ms plus up to 250 ms of jitter, so simultaneous retries do not hit TMDB in lockstep. */
const backoffMs = () => 500 + Math.floor(Math.random() * 250);

/**
 * TMDB sometimes answers slowly or drops a connection. One automatic retry (after a short, jittered
 * pause) covers a timeout, a dropped connection or an HTTP 504; anything else (404, 401, 429, ...)
 * is final and is never retried. A second failure is reported as before.
 */
async function fetchTmdb(url, options, { fast = false } = {}) {
  // `fast`: one short attempt, no retry. Used when a fallback provider is ready, so a slow TMDB hands over in
  // about 6 seconds instead of making the visitor wait for two long attempts.
  if (fast) return fetchWithTimeout(PROVIDER, url, options, FAST_TIMEOUT_MS);
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetchWithTimeout(PROVIDER, url, options);
      if (res.status === 504 && attempt === 0) {
        await sleep(backoffMs());
        continue;
      }
      return res;
    } catch (err) {
      const transient = err instanceof ProviderError && (err.kind === 'TIMEOUT' || err.kind === 'NETWORK');
      if (transient && attempt === 0) {
        await sleep(backoffMs());
        continue;
      }
      throw err;
    }
  }
}

export function resetRateLimitState() {
  limiter.blockedUntil = 0;
}

export function isConfigured() {
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
  return Boolean(token) && token !== 'replace_me';
}

async function tmdbGet(path, params = {}, opts = {}) {
  try {
    const body = await tmdbGetOnce(path, params, opts);
    recordTmdbSuccess();
    return body;
  } catch (err) {
    // transport problems open the circuit; an answer of any kind (404, 401, 429 ...) proves TMDB is reachable
    if (err instanceof ProviderError && ['TIMEOUT', 'NETWORK', 'UNAVAILABLE'].includes(err.kind)) recordTmdbFailure();
    else if (err instanceof ProviderError && err.kind !== 'NOT_CONFIGURED') recordTmdbSuccess();
    throw err;
  }
}

async function tmdbGetOnce(path, params = {}, { fast = false } = {}) {
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

  const res = await fetchTmdb(
    url.toString(),
    {
      headers: {
        Authorization: `Bearer ${process.env.TMDB_API_READ_ACCESS_TOKEN}`,
        Accept: 'application/json'
      }
    },
    { fast }
  );

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

export async function searchMovies({ query, page = 1, year } = {}, opts) {
  return toPage(await tmdbGet('/search/movie', { query, page: clampPage(page), year, include_adult: false }, opts));
}

export async function searchTv({ query, page = 1, year } = {}, opts) {
  return toPage(
    await tmdbGet('/search/tv', { query, page: clampPage(page), first_air_date_year: year, include_adult: false }, opts)
  );
}

/** Browse (no text query): popularity-ordered discover, which supports genre and year filters. */
export async function discoverMovies({ page = 1, genreIds, year } = {}, opts) {
  return toPage(
    await tmdbGet(
      '/discover/movie',
      {
        page: clampPage(page),
        sort_by: 'popularity.desc',
        with_genres: genreIds?.length ? genreIds.join('|') : undefined, // '|' = match ANY of the genres
        primary_release_year: year,
        include_adult: false
      },
      opts
    )
  );
}

export async function discoverTv({ page = 1, genreIds, year } = {}, opts) {
  return toPage(
    await tmdbGet(
      '/discover/tv',
      {
        page: clampPage(page),
        sort_by: 'popularity.desc',
        with_genres: genreIds?.length ? genreIds.join('|') : undefined, // '|' = match ANY of the genres
        first_air_date_year: year,
        include_adult: false
      },
      opts
    )
  );
}

export const getMovieDetails = (id, opts) => tmdbGet(`/movie/${encodeURIComponent(id)}`, {}, opts);
// external_ids (IMDb, TheTVDB) let a fallback provider find exactly the same show later
export const getTvDetails = (id, opts) => tmdbGet(`/tv/${encodeURIComponent(id)}`, { append_to_response: 'external_ids' }, opts);

/** One season of a TV show, including its episode list. */
export const getTvSeasonDetails = (tvId, seasonNumber, opts) =>
  tmdbGet(`/tv/${encodeURIComponent(tvId)}/season/${encodeURIComponent(seasonNumber)}`, {}, opts);

/** `mediaType`: 'movie' | 'tv'. `window`: 'day' | 'week'. */
export async function getTrending({ mediaType, window = 'week', page = 1 } = {}, opts) {
  return toPage(await tmdbGet(`/trending/${mediaType}/${window}`, { page: clampPage(page) }, opts));
}

/** Genre list: [{ id, name }] for 'movie' or 'tv'. */
export async function getGenres(mediaType, opts) {
  const body = await tmdbGet(`/genre/${mediaType}/list`, {}, opts);
  return body?.genres ?? [];
}
