import { ProviderError, fetchWithTimeout, parseRetryAfter } from './providerError.js';
import { pickTitleMatch } from '../utils/titleMatch.js';

/**
 * TVMaze adapter (first fallback after TMDB). Open REST API, no key needed.
 * Docs: https://www.tvmaze.com/api
 *
 * Returns RAW TVMaze objects; services/mediaNormalizer.js converts them. A whole show's seasons
 * and episodes arrive in two small requests, which is why it makes a good fallback.
 * TVMaze rate limit: at least 20 calls per 10 seconds per IP; a 429 is reported, never retried.
 */
const PROVIDER = 'TVMaze';
const BASE_URL = 'https://api.tvmaze.com';

async function getJson(path, { allowNotFound = false } = {}) {
  const res = await fetchWithTimeout(PROVIDER, `${BASE_URL}${path}`, { headers: { Accept: 'application/json' } });
  if (res.status === 404) {
    if (allowNotFound) return null;
    throw new ProviderError(PROVIDER, 'NOT_FOUND', { upstreamStatus: 404 });
  }
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

const yearOf = (date) => {
  const y = Number(String(date ?? '').slice(0, 4));
  return Number.isInteger(y) && y > 1800 ? y : null;
};

/** GET /search/shows?q= -> the show objects, best match first. */
export async function searchTv(query) {
  const body = await getJson(`/search/shows?q=${encodeURIComponent(query)}`);
  return (Array.isArray(body) ? body : []).map((entry) => entry.show).filter(Boolean);
}

/** GET /shows/:id (with the next episode embedded, for the Release Radar). */
export async function getTvDetails(tvmazeId) {
  return getJson(`/shows/${encodeURIComponent(tvmazeId)}?embed=nextepisode`);
}

/**
 * GET /lookup/shows?imdb=... or ?thetvdb=...: an exact, id-based match (no guessing).
 * Resolves to the show, or null when TVMaze does not know that id.
 */
export async function lookupByExternalId({ imdb, thetvdb } = {}) {
  if (imdb) return getJson(`/lookup/shows?imdb=${encodeURIComponent(imdb)}`, { allowNotFound: true });
  if (thetvdb) return getJson(`/lookup/shows?thetvdb=${encodeURIComponent(thetvdb)}`, { allowNotFound: true });
  return null;
}

/** The TVMaze show whose title matches exactly (and whose premiere year agrees), or null. Never a loose guess. */
export async function lookupByTitle(title, year = null) {
  const shows = await searchTv(title);
  const match = pickTitleMatch(
    shows.map((s) => ({ name: s.name, year: yearOf(s.premiered), show: s })),
    { title, year }
  );
  return match ? match.show : null;
}

/** GET /schedule?country=US&date=: episodes airing that day on US TV (each with its `show`). */
export async function getSchedule(date, country = 'US') {
  const body = await getJson(`/schedule?country=${encodeURIComponent(country)}&date=${encodeURIComponent(date)}`);
  return Array.isArray(body) ? body : [];
}

/** GET /schedule/web?date=: episodes released on streaming services that day (the show is in `_embedded`). */
export async function getWebSchedule(date) {
  const body = await getJson(`/schedule/web?date=${encodeURIComponent(date)}`);
  return Array.isArray(body) ? body : [];
}

export const getTvSeasons = (tvmazeId) => getJson(`/shows/${encodeURIComponent(tvmazeId)}/seasons`);

/** All episodes, specials included (specials have `number: null`). */
export const getTvEpisodes = (tvmazeId) => getJson(`/shows/${encodeURIComponent(tvmazeId)}/episodes?specials=1`);

/** Seasons and episodes of a show together, fetched in parallel. */
export async function getTvSeasonsAndEpisodes(tvmazeId) {
  const [seasons, episodes] = await Promise.all([getTvSeasons(tvmazeId), getTvEpisodes(tvmazeId)]);
  return { seasons: Array.isArray(seasons) ? seasons : [], episodes: Array.isArray(episodes) ? episodes : [] };
}
