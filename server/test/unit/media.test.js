/**
 * MOCKED unit tests: globalThis.fetch is replaced, so no network and no database
 * are used. These prove our logic, NOT that AniList/TMDB currently behave this way
 * (see `npm run test:live` for real provider calls).
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.TMDB_API_READ_ACCESS_TOKEN = 'unit-test-token';

const { default: app } = await import('../../src/app.js');
const { cache } = await import('../../src/services/mediaCatalog.service.js');
const anilist = await import('../../src/providers/anilist.provider.js');
const tmdb = await import('../../src/providers/tmdb.provider.js');
const n = await import('../../src/services/mediaNormalizer.js');
const { TTLCache } = await import('../../src/utils/ttlCache.js');

const realFetch = globalThis.fetch;
let calls;
beforeEach(() => {
  calls = [];
  cache.clear();
  anilist.resetRateLimitState();
  tmdb.resetRateLimitState();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/** Install a fetch mock routed by URL substring. */
function mockFetch(routes) {
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    calls.push({ url: u, opts });
    for (const [match, handler] of routes) {
      if (u.includes(match)) return typeof handler === 'function' ? handler(u, opts) : handler;
    }
    throw new Error(`unmocked fetch: ${u}`);
  };
}

const aniMedia = (over = {}) => ({
  id: 16498,
  title: { romaji: 'Shingeki no Kyojin', english: 'Attack on Titan', native: '進撃の巨人' },
  description: 'Humans fight.<br>Giants <i>attack</i>.',
  coverImage: { extraLarge: 'https://img/xl.jpg', large: 'https://img/l.jpg' },
  bannerImage: null,
  startDate: { year: 2013, month: 4, day: 7 },
  format: 'TV',
  status: 'FINISHED',
  episodes: 25,
  genres: ['Action', 'Drama'],
  averageScore: 85,
  popularity: 500000,
  season: 'SPRING',
  seasonYear: 2013,
  siteUrl: 'https://anilist.co/anime/16498',
  ...over
});
const aniPage = (media) => ({
  data: { Page: { pageInfo: { total: 1, currentPage: 1, lastPage: 1, hasNextPage: false, perPage: 20 }, media } }
});
const tmdbPage = (results) => ({ page: 1, total_pages: 1, total_results: results.length, results });
const tmdbMovie = {
  id: 27205, title: 'Inception', original_title: 'Inception', overview: 'Dreams.',
  poster_path: '/p.jpg', backdrop_path: '/b.jpg', release_date: '2010-07-15',
  vote_average: 8.369, vote_count: 35000, popularity: 90.5, genre_ids: [28, 878]
};
const tmdbGenres = { genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }, { id: 18, name: 'Drama' }] };

// ------------------------------------------------------------ normalizer ---

test('normalizer: AniList -> shared shape (score 0-100 -> 0-10, title fallback, html stripped)', () => {
  const m = n.normalizeAniListMedia(aniMedia());
  assert.equal(m.provider, 'ANILIST');
  assert.equal(m.externalId, '16498');
  assert.equal(m.mediaType, 'ANIME');
  assert.equal(m.title, 'Attack on Titan');
  assert.equal(m.originalTitle, '進撃の巨人');
  assert.equal(m.overview, 'Humans fight.\nGiants attack.');
  assert.equal(m.sourceRating, 8.5);
  assert.equal(m.sourceRatingName, 'AniList');
  assert.equal(m.releaseDate, '2013-04-07');
  assert.equal(m.totalEpisodes, 25);
  assert.equal(m.posterUrl, 'https://img/xl.jpg');
});

test('normalizer: missing AniList fields stay null, never invented', () => {
  const m = n.normalizeAniListMedia(
    aniMedia({ title: { romaji: 'Only Romaji', english: null, native: null }, averageScore: null,
      startDate: { year: 2020, month: null, day: null }, episodes: null, description: null, coverImage: null, genres: null })
  );
  assert.equal(m.title, 'Only Romaji');
  assert.equal(m.sourceRating, null);
  assert.equal(m.releaseDate, null); // partial date is not turned into a fake full date
  assert.equal(m.releaseYear, 2020);
  assert.equal(m.totalEpisodes, null);
  assert.equal(m.overview, null);
  assert.equal(m.posterUrl, null);
  assert.deepEqual(m.genres, []);
});

test('normalizer: TMDB movie + tv map to the same shape; ratings stay 0-10; unrated -> null', () => {
  const genreMap = new Map([[28, 'Action'], [878, 'Science Fiction']]);
  const movie = n.normalizeTmdbMedia(tmdbMovie, 'MOVIE', genreMap);
  assert.equal(movie.provider, 'TMDB');
  assert.equal(movie.mediaType, 'MOVIE');
  assert.equal(movie.sourceRating, 8.4);
  assert.deepEqual(movie.genres, ['Action', 'Science Fiction']);
  assert.equal(movie.posterUrl, 'https://image.tmdb.org/t/p/w500/p.jpg');
  assert.equal(movie.backdropUrl, 'https://image.tmdb.org/t/p/w1280/b.jpg');

  const tv = n.normalizeTmdbMedia(
    { id: 1396, name: 'Breaking Bad', original_name: 'Breaking Bad', first_air_date: '2008-01-20', vote_average: 0, vote_count: 0,
      number_of_seasons: 5, number_of_episodes: 62, poster_path: null, genres: [{ id: 18, name: 'Drama' }] },
    'TV'
  );
  assert.equal(tv.mediaType, 'TV');
  assert.equal(tv.title, 'Breaking Bad');
  assert.equal(tv.sourceRating, null);
  assert.equal(tv.posterUrl, null);
  assert.equal(tv.totalSeasons, 5);
  assert.deepEqual(Object.keys(tv).filter((k) => !(k in movie)), []); // no TV-only keys leak into the base shape
});

test('normalizer: TMDB empty date string -> null', () => {
  assert.equal(n.normalizeIsoDate(''), null);
  assert.equal(n.normalizeIsoDate('2010-07-15'), '2010-07-15');
});

// ------------------------------------------------------------- API: search ---

test('GET /search ANIME returns normalized AniList results (POST GraphQL)', async () => {
  mockFetch([['graphql.anilist.co', json(aniPage([aniMedia()]))]]);
  const res = await request(app).get('/api/media/search?q=attack&type=ANIME');
  assert.equal(res.status, 200);
  const g = res.body.data.groups[0];
  assert.equal(g.provider, 'ANILIST');
  assert.equal(g.results[0].title, 'Attack on Titan');
  assert.equal(calls[0].opts.method, 'POST');
  assert.equal(JSON.parse(calls[0].opts.body).variables.search, 'attack');
});

test('GET /search MOVIE sends bearer token to TMDB and maps genre ids', async () => {
  mockFetch([
    ['/genre/movie/list', json(tmdbGenres)],
    ['/search/movie', json(tmdbPage([tmdbMovie]))]
  ]);
  const res = await request(app).get('/api/media/search?q=inception&type=MOVIE');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.groups[0].results[0].genres, ['Action', 'Science Fiction']);
  const searchCall = calls.find((c) => c.url.includes('/search/movie'));
  assert.equal(searchCall.opts.headers.Authorization, 'Bearer unit-test-token');
});

test('GET /search ALL: one provider failing does not hide the others', async () => {
  mockFetch([
    ['graphql.anilist.co', json(aniPage([aniMedia()]))],
    ['/genre/', json(tmdbGenres)],
    ['/search/movie', json(tmdbPage([tmdbMovie]))],
    ['/search/tv', new Response('boom', { status: 503 })]
  ]);
  const res = await request(app).get('/api/media/search?q=test&type=ALL');
  assert.equal(res.status, 200);
  const by = Object.fromEntries(res.body.data.groups.map((g) => [g.mediaType, g]));
  assert.equal(by.ANIME.results.length, 1);
  assert.equal(by.MOVIE.results.length, 1);
  assert.equal(by.TV.results.length, 0);
  assert.equal(by.TV.error.code, 'PROVIDER_UNAVAILABLE');
});

test('GET /search browse mode (no q) uses discover with genre id; text search ignores genre and says so', async () => {
  mockFetch([
    ['/genre/movie/list', json(tmdbGenres)],
    ['/discover/movie', json(tmdbPage([tmdbMovie]))],
    ['/search/movie', json(tmdbPage([tmdbMovie]))]
  ]);
  let res = await request(app).get('/api/media/search?type=MOVIE&genre=Action');
  assert.equal(res.status, 200);
  assert.ok(calls.find((c) => c.url.includes('/discover/movie')).url.includes('with_genres=28'));

  res = await request(app).get('/api/media/search?type=MOVIE&q=inception&genre=Action');
  assert.deepEqual(res.body.data.groups[0].ignoredFilters, ['genre']);
});

test('GET /search validation: short q, bad type, bad page, bad genre -> 400', async () => {
  for (const qs of ['q=a', 'q=ab&type=BOOK', 'q=ab&page=0', 'q=ab&page=abc', 'q=ab&genre=%3Bdrop%20table']) {
    const res = await request(app).get(`/api/media/search?${qs}`);
    assert.equal(res.status, 400, qs);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
});

test('identical searches are served from cache (one provider call)', async () => {
  mockFetch([['graphql.anilist.co', json(aniPage([aniMedia()]))]]);
  await request(app).get('/api/media/search?q=cached&type=ANIME');
  await request(app).get('/api/media/search?q=cached&type=ANIME');
  assert.equal(calls.length, 1);
});

// ---------------------------------------------------------- API: trending ---

test('GET /trending: TMDB uses day/week endpoints; AniList label is honest (no window)', async () => {
  mockFetch([
    ['/genre/', json(tmdbGenres)],
    ['/trending/movie/day', json(tmdbPage([tmdbMovie]))],
    ['/trending/tv/day', json(tmdbPage([]))],
    ['graphql.anilist.co', json(aniPage([aniMedia()]))]
  ]);
  const res = await request(app).get('/api/media/trending?type=ALL&window=day');
  assert.equal(res.status, 200);
  const by = Object.fromEntries(res.body.data.groups.map((g) => [g.mediaType, g]));
  assert.equal(by.MOVIE.label, 'Trending today on TMDB');
  assert.equal(by.ANIME.window, null);
  assert.equal(by.ANIME.label, 'AniList trending ranking');
  assert.equal((await request(app).get('/api/media/trending?window=month')).status, 400);
});

// ------------------------------------------------------------ error paths ---

test('AniList 429: Retry-After respected, Retry-After header returned, NO tight retry loop', async () => {
  mockFetch([['graphql.anilist.co', new Response('{}', { status: 429, headers: { 'retry-after': '42' } })]]);
  const first = await request(app).get('/api/media/search?q=rate&type=ANIME');
  assert.equal(first.status, 429);
  assert.equal(first.body.error.code, 'PROVIDER_RATE_LIMITED');
  assert.equal(first.headers['retry-after'], '42');
  const second = await request(app).get('/api/media/search?q=other&type=ANIME');
  assert.equal(second.status, 429);
  assert.equal(calls.length, 1, 'second request must be refused locally without calling AniList again');
});

test('TMDB errors: 401 -> AUTH, 404 -> MEDIA_NOT_FOUND, 429, 500, network failure, timeout', async () => {
  const cases = [
    [new Response('{}', { status: 401 }), 502, 'PROVIDER_AUTH_ERROR'],
    [new Response('{}', { status: 404 }), 404, 'MEDIA_NOT_FOUND'],
    [new Response('{}', { status: 429, headers: { 'retry-after': '5' } }), 429, 'PROVIDER_RATE_LIMITED'],
    [new Response('{}', { status: 500 }), 502, 'PROVIDER_UNAVAILABLE']
  ];
  for (const [response, status, code] of cases) {
    tmdb.resetRateLimitState();
    cache.clear();
    mockFetch([['/movie/1', response]]);
    const res = await request(app).get('/api/media/details/TMDB/MOVIE/1');
    assert.equal(res.status, status, code);
    assert.equal(res.body.error.code, code);
  }
  cache.clear();
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  let res = await request(app).get('/api/media/details/TMDB/MOVIE/2');
  assert.equal(res.body.error.code, 'PROVIDER_UNREACHABLE');

  cache.clear();
  globalThis.fetch = async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };
  res = await request(app).get('/api/media/details/TMDB/MOVIE/3');
  assert.equal(res.status, 504);
  assert.equal(res.body.error.code, 'PROVIDER_TIMEOUT');
});

test('missing TMDB token -> 503 PROVIDER_NOT_CONFIGURED (no network call)', async () => {
  const saved = process.env.TMDB_API_READ_ACCESS_TOKEN;
  delete process.env.TMDB_API_READ_ACCESS_TOKEN;
  try {
    mockFetch([]);
    const res = await request(app).get('/api/media/details/TMDB/TV/1396');
    assert.equal(res.status, 503);
    assert.equal(res.body.error.code, 'PROVIDER_NOT_CONFIGURED');
    assert.equal(calls.length, 0);
  } finally {
    process.env.TMDB_API_READ_ACCESS_TOKEN = saved;
  }
});

test('AniList missing media -> 404; details param validation', async () => {
  mockFetch([['graphql.anilist.co', json({ errors: [{ status: 404, message: 'Not Found.' }], data: { Media: null } }, 404)]]);
  assert.equal((await request(app).get('/api/media/details/ANILIST/ANIME/999')).status, 404);
  for (const p of ['ANILIST/MOVIE/1', 'TMDB/ANIME/1', 'NETFLIX/TV/1', 'TMDB/TV/abc', 'TMDB/TV/1;drop']) {
    assert.equal((await request(app).get(`/api/media/details/${p}`)).status, 400, p);
  }
});

// ------------------------------------------------------------------ cache ---

test('TTLCache: expiry, size cap, in-flight de-duplication, failures not cached', async () => {
  const c = new TTLCache({ maxEntries: 2 });
  c.set('a', 1, 1000); c.set('b', 2, 1000); c.set('c', 3, 1000);
  assert.equal(c.get('a'), undefined);
  assert.equal(c.size, 2);
  c.set('x', 1, -1);
  assert.equal(c.get('x'), undefined);

  let loads = 0;
  const slow = () => new Promise((r) => setTimeout(() => r(++loads), 20));
  const [v1, v2] = await Promise.all([c.getOrLoad('k', 1000, slow), c.getOrLoad('k', 1000, slow)]);
  assert.equal(v1, v2);
  assert.equal(loads, 1);

  await assert.rejects(c.getOrLoad('bad', 1000, async () => { throw new Error('x'); }));
  assert.equal(c.get('bad'), undefined);
});

// ------------------------------------------------- seasons and episodes ---

test('normalizer: TMDB season and episode mapping (blank names get safe fallbacks)', () => {
  const s0 = n.normalizeTmdbSeason({ season_number: 0, name: '', episode_count: 3 });
  assert.equal(s0.name, 'Specials');
  const s2 = n.normalizeTmdbSeason({ season_number: 2, name: ' ', poster_path: '/s.jpg', air_date: '', episodes: [{}, {}] });
  assert.equal(s2.name, 'Season 2');
  assert.equal(s2.airDate, null);
  assert.equal(s2.episodeCount, 2);
  assert.equal(s2.posterUrl, 'https://image.tmdb.org/t/p/w500/s.jpg');
  assert.equal(n.normalizeTmdbSeason({ season_number: -1 }), null);

  const ep = n.normalizeTmdbEpisode({ episode_number: 4, name: '', runtime: 0, air_date: '2021-02-03' });
  assert.deepEqual(ep, { episodeNumber: 4, title: 'Episode 4', overview: null, airDate: '2021-02-03', runtimeMinutes: null });
  assert.equal(n.normalizeTmdbEpisode({ episode_number: 0 }), null);
});

test('normalizer: anime episodes are generated 1..N, capped, and aired count is used when total is unknown', () => {
  const eps = n.buildAnimeEpisodes(3, 24);
  assert.deepEqual(eps.map((e) => e.title), ['Episode 1', 'Episode 2', 'Episode 3']);
  assert.equal(eps[0].runtimeMinutes, 24);
  assert.equal(n.buildAnimeEpisodes(null).length, 0);
  assert.equal(n.buildAnimeEpisodes(999999).length, n.MAX_GENERATED_EPISODES);

  assert.equal(n.anilistKnownEpisodeCount({ episodes: 12 }), 12);
  assert.equal(n.anilistKnownEpisodeCount({ episodes: null, nextAiringEpisode: { episode: 8 } }), 7);
  assert.equal(n.anilistKnownEpisodeCount({ episodes: null, nextAiringEpisode: { episode: 1 } }), null);
  assert.equal(n.anilistKnownEpisodeCount({}), null);
});

// ------------------------------------------------------- multi-genre filter ---

test('multi-genre: TMDB browse uses "|" (match any), unknown names are dropped, none known -> empty', async () => {
  mockFetch([
    ['/genre/movie/list', json(tmdbGenres)],
    ['/discover/movie', json(tmdbPage([tmdbMovie]))]
  ]);
  let res = await request(app).get('/api/media/search?type=MOVIE&genre=Action,Drama,Nonsense');
  assert.equal(res.status, 200);
  const url = decodeURIComponent(calls.find((c) => c.url.includes('/discover/movie')).url);
  assert.ok(url.includes('with_genres=28|18'), url);

  cache.clear();
  calls.length = 0;
  mockFetch([['/genre/movie/list', json(tmdbGenres)]]); // fresh Response objects (a body can be read once)
  res = await request(app).get('/api/media/search?type=MOVIE&genre=Nonsense');
  assert.equal(res.body.data.groups[0].results.length, 0);
  assert.ok(!calls.some((c) => c.url.includes('/discover/movie')), 'no provider call when no genre is known');
});

test('multi-genre: AniList receives genre_in with only genres AniList supports', async () => {
  mockFetch([
    [
      'graphql.anilist.co',
      (url, opts) => {
        const body = JSON.parse(opts.body);
        if (body.query.includes('GenreCollection')) return json({ data: { GenreCollection: ['Action', 'Comedy', 'Drama'] } });
        return json(aniPage([aniMedia()]));
      }
    ]
  ]);
  const res = await request(app).get('/api/media/search?type=ANIME&genre=action,Comedy,Science%20Fiction');
  assert.equal(res.status, 200);
  const listCall = calls.map((c) => JSON.parse(c.opts.body)).find((b) => b.query.includes('genre_in'));
  assert.deepEqual(listCall.variables.genres, ['Action', 'Comedy']);
});

test('multi-genre: validation limits and rejects bad names', async () => {
  assert.equal((await request(app).get('/api/media/search?genre=a,b,c,d,e,f')).status, 400);
  assert.equal((await request(app).get('/api/media/search?genre=Action;DROP')).status, 400);
  assert.equal((await request(app).get('/api/media/search?genre=%2C%2C')).status, 400);
});
