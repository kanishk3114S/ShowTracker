import { ProviderError, fetchWithTimeout, parseRetryAfter } from './providerError.js';

/**
 * TheTVDB v4 adapter (second fallback, after TMDB and TVMaze).
 * Docs: https://thetvdb.github.io/v4-api/
 *
 * Needs TVDB_API_KEY. Without it every call reports NOT_CONFIGURED and the fallback chain simply
 * skips this tier. The key is exchanged for a JWT (valid about a month) at POST /login; the token is
 * cached in memory for 24 hours, and refreshed once automatically if TheTVDB answers 401.
 * Returns RAW TheTVDB objects; services/mediaNormalizer.js converts them.
 */
const PROVIDER = 'TheTVDB';
const BASE_URL = 'https://api4.thetvdb.com/v4';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_EPISODE_PAGES = 30; // ~500 episodes per page

let token = null; // { value, expiresAt }
let loginInFlight = null;

export function isConfigured() {
  return Boolean(process.env.TVDB_API_KEY?.trim());
}

/** Forget the cached token (tests, or after a key change). */
export function resetTvdbState() {
  token = null;
  loginInFlight = null;
}

async function login() {
  if (!isConfigured()) throw new ProviderError(PROVIDER, 'NOT_CONFIGURED');
  if (loginInFlight) return loginInFlight; // concurrent callers share one login
  loginInFlight = (async () => {
    const res = await fetchWithTimeout(PROVIDER, `${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ apikey: process.env.TVDB_API_KEY.trim() })
    });
    if (res.status === 401 || res.status === 403) throw new ProviderError(PROVIDER, 'AUTH', { upstreamStatus: res.status });
    if (!res.ok) throw new ProviderError(PROVIDER, 'UNAVAILABLE', { upstreamStatus: res.status });
    let body;
    try {
      body = await res.json();
    } catch {
      throw new ProviderError(PROVIDER, 'UNAVAILABLE', { upstreamStatus: res.status });
    }
    const value = body?.data?.token;
    if (!value) throw new ProviderError(PROVIDER, 'AUTH');
    token = { value, expiresAt: Date.now() + TOKEN_TTL_MS };
    return token;
  })().finally(() => {
    loginInFlight = null;
  });
  return loginInFlight;
}

async function getToken() {
  if (token && token.expiresAt > Date.now()) return token.value;
  return (await login()).value;
}

async function tvdbGet(path, params = {}, { retriedAuth = false } = {}) {
  const bearer = await getToken();
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  const res = await fetchWithTimeout(PROVIDER, url.toString(), {
    headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' }
  });

  if (res.status === 401 && !retriedAuth) {
    token = null; // expired or revoked: log in again, once
    return tvdbGet(path, params, { retriedAuth: true });
  }
  if (res.status === 401 || res.status === 403) throw new ProviderError(PROVIDER, 'AUTH', { upstreamStatus: res.status });
  if (res.status === 404) throw new ProviderError(PROVIDER, 'NOT_FOUND', { upstreamStatus: 404 });
  if (res.status === 429) {
    throw new ProviderError(PROVIDER, 'RATE_LIMITED', {
      retryAfterSeconds: parseRetryAfter(res.headers.get('retry-after')) ?? 10,
      upstreamStatus: 429
    });
  }
  if (!res.ok) throw new ProviderError(PROVIDER, 'UNAVAILABLE', { upstreamStatus: res.status });
  try {
    return await res.json();
  } catch {
    throw new ProviderError(PROVIDER, 'UNAVAILABLE', { upstreamStatus: res.status });
  }
}

/** GET /search?query=&type=movie|series -> result list (each has tvdb_id, name, year, overview, image_url). */
export async function search(query, type = 'series') {
  const body = await tvdbGet('/search', { query, type: type === 'movie' ? 'movie' : 'series' });
  return Array.isArray(body?.data) ? body.data : [];
}

/**
 * GET /movies/filter (or /series/filter): the catalogue sorted by TheTVDB's score, newest year first when
 * `year` is given. One page is up to 500 records (id, name, image path, year, score, status ...).
 */
async function filterRecords(kind, { year, page = 0 } = {}) {
  const body = await tvdbGet(`/${kind}/filter`, { country: 'usa', lang: 'eng', sort: 'score', sortType: 'desc', year, page });
  return Array.isArray(body?.data) ? body.data : [];
}
export const filterMovies = (opts) => filterRecords('movies', opts);
export const filterSeries = (opts) => filterRecords('series', opts);

/** GET /series/:id/extended */
export async function getSeriesDetails(id) {
  const body = await tvdbGet(`/series/${encodeURIComponent(id)}/extended`, { short: 'true' });
  if (!body?.data) throw new ProviderError(PROVIDER, 'NOT_FOUND');
  return body.data;
}

/** GET /movies/:id/extended */
export async function getMovieDetails(id) {
  const body = await tvdbGet(`/movies/${encodeURIComponent(id)}/extended`, { short: 'true' });
  if (!body?.data) throw new ProviderError(PROVIDER, 'NOT_FOUND');
  return body.data;
}

/** GET /series/:id/episodes/default, following the pagination, -> the episode list. */
export async function getSeriesEpisodes(id) {
  const episodes = [];
  for (let page = 0; page < MAX_EPISODE_PAGES; page++) {
    const body = await tvdbGet(`/series/${encodeURIComponent(id)}/episodes/default`, { page });
    episodes.push(...(Array.isArray(body?.data?.episodes) ? body.data.episodes : []));
    if (body?.links?.next === null || body?.links?.next === undefined) break;
  }
  return episodes;
}
