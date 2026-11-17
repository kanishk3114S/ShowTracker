import { ProviderError, fetchWithTimeout, parseRetryAfter } from './providerError.js';

/**
 * AniList GraphQL adapter (public catalog queries, no API key needed).
 * Docs: https://docs.anilist.co/guide/graphql/
 * Rate limits: https://github.com/AniList/docs/blob/master/docs/guide/rate-limiting.md
 *
 * Returns RAW AniList objects. Converting them to ShowTracker's shared shape is
 * the job of services/mediaNormalizer.js.
 */
const PROVIDER = 'AniList';
const ENDPOINT = 'https://graphql.anilist.co';

const LIST_FIELDS = `
  id
  title { romaji english native }
  description(asHtml: false)
  coverImage { extraLarge large }
  bannerImage
  startDate { year month day }
  format
  status
  episodes
  genres
  averageScore
  popularity
  season
  seasonYear
  siteUrl
`;

const DETAIL_FIELDS = `
  ${LIST_FIELDS}
  duration
  endDate { year month day }
  studios(isMain: true) { nodes { name } }
  relations {
    edges {
      relationType(version: 2)
      node { id type format title { romaji english } coverImage { large } }
    }
  }
`;

const PAGE_INFO = 'pageInfo { total currentPage lastPage hasNextPage perPage }';

// Adult content is excluded from discovery on purpose (isAdult: false).
const LIST_QUERY = `
  query ($page: Int, $perPage: Int, $search: String, $sort: [MediaSort], $genre: String, $year: Int) {
    Page(page: $page, perPage: $perPage) {
      ${PAGE_INFO}
      media(type: ANIME, isAdult: false, search: $search, sort: $sort, genre: $genre, seasonYear: $year) {
        ${LIST_FIELDS}
      }
    }
  }
`;

const DETAIL_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      ${DETAIL_FIELDS}
    }
  }
`;

const GENRE_QUERY = 'query { GenreCollection }';

/**
 * Local rate-limit guard. When AniList tells us to back off (HTTP 429, or the
 * remaining quota hits 0) we remember until when, and refuse new calls locally
 * instead of hammering the API. There is NO automatic retry.
 */
const limiter = { blockedUntil: 0, limit: null, remaining: null };

function updateLimiter(headers) {
  const limitHeader = headers.get('x-ratelimit-limit');
  const remainingHeader = headers.get('x-ratelimit-remaining');
  const resetHeader = headers.get('x-ratelimit-reset'); // unix seconds

  if (limitHeader != null && Number.isFinite(Number(limitHeader))) limiter.limit = Number(limitHeader);
  if (remainingHeader != null && Number.isFinite(Number(remainingHeader))) {
    limiter.remaining = Number(remainingHeader);
    const reset = Number(resetHeader);
    if (limiter.remaining <= 0 && Number.isFinite(reset) && reset * 1000 > Date.now()) {
      limiter.blockedUntil = Math.max(limiter.blockedUntil, reset * 1000);
    }
  }
}

export function getRateLimitState() {
  return { ...limiter };
}

export function resetRateLimitState() {
  limiter.blockedUntil = 0;
  limiter.limit = null;
  limiter.remaining = null;
}

async function graphql(query, variables) {
  if (limiter.blockedUntil > Date.now()) {
    const wait = Math.ceil((limiter.blockedUntil - Date.now()) / 1000);
    throw new ProviderError(PROVIDER, 'RATE_LIMITED', { retryAfterSeconds: wait });
  }

  const res = await fetchWithTimeout(PROVIDER, ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables })
  });

  updateLimiter(res.headers);

  if (res.status === 429) {
    // Respect Retry-After; fall back to 60s (one rate-limit window) if it is missing.
    const retry = parseRetryAfter(res.headers.get('retry-after')) ?? 60;
    limiter.blockedUntil = Date.now() + retry * 1000;
    throw new ProviderError(PROVIDER, 'RATE_LIMITED', { retryAfterSeconds: retry, upstreamStatus: 429 });
  }
  if (res.status === 404) throw new ProviderError(PROVIDER, 'NOT_FOUND', { upstreamStatus: 404 });
  if (res.status === 400) throw new ProviderError(PROVIDER, 'BAD_REQUEST', { upstreamStatus: 400 });
  if (!res.ok) throw new ProviderError(PROVIDER, 'UNAVAILABLE', { upstreamStatus: res.status });

  let body;
  try {
    body = await res.json();
  } catch {
    throw new ProviderError(PROVIDER, 'UNAVAILABLE', { upstreamStatus: res.status });
  }
  if (body?.errors?.length && !body.data) {
    const notFound = body.errors.some((e) => e.status === 404);
    throw new ProviderError(PROVIDER, notFound ? 'NOT_FOUND' : 'BAD_REQUEST');
  }
  return body.data;
}

function toPage(data) {
  const page = data?.Page;
  return {
    items: page?.media ?? [],
    pageInfo: {
      page: page?.pageInfo?.currentPage ?? 1,
      totalPages: page?.pageInfo?.lastPage ?? 1,
      totalResults: page?.pageInfo?.total ?? 0,
      hasNextPage: Boolean(page?.pageInfo?.hasNextPage)
    }
  };
}

/** Search anime by title (or browse by popularity when `search` is omitted). */
export async function searchAnime({ search, page = 1, perPage = 20, genre, year } = {}) {
  const data = await graphql(LIST_QUERY, {
    page,
    perPage,
    search: search || undefined,
    genre: genre || undefined,
    year: year || undefined,
    sort: search ? ['SEARCH_MATCH'] : ['POPULARITY_DESC']
  });
  return toPage(data);
}

/**
 * AniList "trending" ranking (TRENDING_DESC). AniList computes this itself and
 * exposes no day/week/month filter, so none is offered here.
 */
export async function getTrendingAnime({ page = 1, perPage = 20 } = {}) {
  const data = await graphql(LIST_QUERY, { page, perPage, sort: ['TRENDING_DESC'] });
  return toPage(data);
}

export async function getAnimeDetails(id) {
  const data = await graphql(DETAIL_QUERY, { id: Number(id) });
  if (!data?.Media) throw new ProviderError(PROVIDER, 'NOT_FOUND');
  return data.Media;
}

/** Genre names supported by AniList's `genre` filter. */
export async function getAnimeGenres() {
  const data = await graphql(GENRE_QUERY, {});
  // "Hentai" is adult-only; discovery excludes adult content.
  return (data?.GenreCollection ?? []).filter((g) => g !== 'Hentai');
}
