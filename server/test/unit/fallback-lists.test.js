/**
 * Trending / browse / search for TV shows and movies when TMDB cannot answer:
 * TVMaze, TheTVDB, the circuit breaker and the last-good copy. No database; HTTP is mocked.
 */
process.env.NODE_ENV = 'test';
process.env.TMDB_API_READ_ACCESS_TOKEN = 'test-token';
process.env.PROVIDER_CIRCUIT_FORCE = 'true'; // the breaker is off in tests unless forced

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const { searchMedia, getTrendingMedia, cache, resetLastGoodLists } = await import('../../src/services/mediaCatalog.service.js');
const { resetFallbackListCache, PAGE_SIZE } = await import('../../src/services/fallbackLists.service.js');
const { resetProviderHealth, tmdbCircuitOpen, CIRCUIT_OPEN_MS } = await import('../../src/providers/providerHealth.js');
const { resetTvdbState } = await import('../../src/providers/tvdb.provider.js');
const { resetRateLimitState } = await import('../../src/providers/tmdb.provider.js');

const realFetch = globalThis.fetch;
let calls;
let tmdbMode; // 'down' | 'ok' | 'bad-request'
let tvmazeDown;
let tvdbDown;
let schedule;
let webSchedule;
let mazeSearch;
let tvdbMovies;
let tvdbSeries;
let tvdbMovieHits;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const count = (needle) => calls.filter((u) => u.includes(needle)).length;

const show = (id, name, extra = {}) => ({
  id,
  name,
  type: 'Scripted',
  premiered: '2025-01-15',
  weight: 50,
  rating: { average: 7.5 },
  genres: ['Drama'],
  image: { medium: `http://static.tvmaze.com/${id}-m.jpg`, original: `http://static.tvmaze.com/${id}-o.jpg` },
  summary: `<p>${name}</p>`,
  ...extra
});

beforeEach(() => {
  calls = [];
  tmdbMode = 'down';
  tvmazeDown = false;
  tvdbDown = false;
  schedule = [];
  webSchedule = [];
  mazeSearch = [];
  tvdbMovies = [];
  tvdbSeries = [];
  tvdbMovieHits = [];
  process.env.TVDB_API_KEY = 'key';
  resetTvdbState();
  resetProviderHealth();
  resetRateLimitState();
  resetFallbackListCache();
  resetLastGoodLists();
  cache.clear();
  globalThis.fetch = async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('api.themoviedb.org')) {
      if (tmdbMode === 'down') throw new TypeError('fetch failed');
      if (tmdbMode === 'bad-request') return json({}, 422);
      if (u.includes('/genre/')) return json({ genres: [] });
      if (u.includes('/trending/')) return json({ page: 1, total_pages: 1, total_results: 1, results: [{ id: 5, name: 'TMDB Show', title: 'TMDB Movie', poster_path: '/p.jpg', first_air_date: '2025-01-01', release_date: '2025-01-01' }] });
      return json({});
    }
    if (u.includes('api.tvmaze.com')) {
      if (tvmazeDown) throw new TypeError('fetch failed');
      if (u.includes('/schedule/web')) return json(webSchedule);
      if (u.includes('/schedule')) return json(schedule);
      if (u.includes('/search/shows')) return json(mazeSearch.map((s) => ({ score: 1, show: s })));
    }
    if (u.includes('api4.thetvdb.com')) {
      if (tvdbDown) throw new TypeError('fetch failed');
      if (u.endsWith('/login')) return json({ data: { token: 'jwt' } });
      if (u.includes('/movies/filter')) return json({ data: tvdbMovies });
      if (u.includes('/series/filter')) return json({ data: tvdbSeries });
      if (u.includes('/search')) return json({ data: new URL(u).searchParams.get('type') === 'movie' ? tvdbMovieHits : [] });
    }
    throw new Error(`unmocked fetch ${u}`);
  };
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

// -------------------------------------------------------------------- TV (TVMaze) ---

test('TV trending, TMDB down: TVMaze "airing now", most popular first, junk removed, own identity on every item', async () => {
  schedule = [
    { show: show(1, 'Quiet Drama', { weight: 40 }) },
    { show: show(2, 'Big Hit', { weight: 95 }) },
    { show: show(3, 'Evening News', { weight: 99, type: 'News' }) },
    { show: show(4, 'No Poster', { weight: 90, image: null }) },
    { show: show(5, 'Late Night', { weight: 98, type: 'Talk Show' }) },
    { show: show(1, 'Quiet Drama', { weight: 40 }) } // the same show again on another day
  ];
  webSchedule = [{ _embedded: { show: show(6, 'Streaming Gem', { weight: 70 }) } }];
  const res = await getTrendingMedia({ type: 'TV', window: 'week', page: 1 });
  const group = res.groups[0];
  assert.equal(group.mediaType, 'TV');
  assert.equal(group.provider, 'TVMAZE');
  assert.match(group.label, /TVMaze/);
  assert.equal(group.degraded, true);
  assert.deepEqual(group.results.map((m) => m.title), ['Big Hit', 'Streaming Gem', 'Quiet Drama']);
  const first = group.results[0];
  assert.equal(first.provider, 'TVMAZE');
  assert.equal(first.externalId, '2');
  assert.equal(first.mediaType, 'TV');
  assert.equal(first.posterUrl, 'https://static.tvmaze.com/2-o.jpg');
  assert.equal(first.sourceRating, 7.5);
  assert.equal(group.pagination.totalResults, 3);
  assert.equal(group.pagination.hasNextPage, false);
});

test('TV browse: pagination in pages of 20; year and genre filters apply to the fallback list', async () => {
  schedule = Array.from({ length: 45 }, (_, i) => ({ show: show(100 + i, `Show ${i}`, { weight: 100 - i, genres: i % 2 ? ['Comedy'] : ['Drama'], premiered: i < 10 ? '2020-03-01' : '2025-03-01' }) }));
  const p1 = (await searchMedia({ type: 'TV', q: '', page: 1 })).groups[0];
  assert.equal(p1.results.length, PAGE_SIZE);
  assert.deepEqual(p1.pagination, { page: 1, totalPages: 3, totalResults: 45, hasNextPage: true });
  assert.equal(p1.results[0].title, 'Show 0');
  const p3 = (await searchMedia({ type: 'TV', q: '', page: 3 })).groups[0];
  assert.equal(p3.results.length, 5);
  assert.equal(p3.pagination.hasNextPage, false);

  const y2020 = (await searchMedia({ type: 'TV', q: '', page: 1, year: '2020' })).groups[0];
  assert.equal(y2020.results.length, 10);
  assert.ok(y2020.results.every((m) => m.releaseYear === 2020));

  const comedy = (await searchMedia({ type: 'TV', q: '', page: 1, genre: ['comedy'] })).groups[0];
  assert.ok(comedy.results.length > 0 && comedy.results.every((m) => m.genres.includes('Comedy')));
});

test('TV search, TMDB down: TVMaze search results; a genre filter is reported as ignored (as TMDB text search does)', async () => {
  mazeSearch = [show(7, 'Breaking Bad'), show(8, 'Breaking Point')];
  const group = (await searchMedia({ type: 'TV', q: 'breaking', page: 1, genre: ['Drama'] })).groups[0];
  assert.deepEqual(group.results.map((m) => m.title), ['Breaking Bad', 'Breaking Point']);
  assert.equal(group.provider, 'TVMAZE');
  assert.deepEqual(group.ignoredFilters, ['genre']);
  assert.ok(calls.some((u) => u.includes('/search/shows?q=breaking')));
});

test('TV: TVMaze unreachable too -> TheTVDB series', async () => {
  tvmazeDown = true;
  tvdbSeries = [{ id: 81189, name: 'Breaking Bad', image: 'https://artworks.thetvdb.com/banners/posters/81189-10.jpg', score: 900, firstAired: '2008-01-20', year: '2008', status: { name: 'Ended' } }];
  const group = (await getTrendingMedia({ type: 'TV', window: 'week', page: 1 })).groups[0];
  assert.equal(group.provider, 'TVDB');
  assert.equal(group.results[0].title, 'Breaking Bad');
  assert.equal(group.results[0].provider, 'TVDB');
  assert.equal(group.results[0].externalId, '81189');
});

// ------------------------------------------------------------------ Movies (TVDB) ---

test('Movies trending, TMDB down: TheTVDB catalogue, best score first, unreleased and poster-less records dropped, image paths made absolute', async () => {
  tvdbMovies = [
    { id: 1, name: 'Quiet Film', image: '/banners/v4/movie/1/posters/a.jpg', score: 100, year: '2025', status: { name: 'Released' } },
    { id: 2, name: 'Blockbuster', image: '/banners/v4/movie/2/posters/b.jpg', score: 9000, year: '2025', status: { name: 'Released' } },
    { id: 3, name: 'Still Filming', image: '/banners/v4/movie/3/posters/c.jpg', score: 99999, year: '2026', status: { name: 'Filming / Post-Production' } },
    { id: 4, name: 'No Poster', image: null, score: 5000, year: '2025', status: { name: 'Released' } }
  ];
  const group = (await getTrendingMedia({ type: 'MOVIE', window: 'week', page: 1 })).groups[0];
  assert.equal(group.provider, 'TVDB');
  assert.match(group.label, /TheTVDB/);
  assert.deepEqual(group.results.map((m) => m.title), ['Blockbuster', 'Quiet Film']);
  assert.equal(group.results[0].posterUrl, 'https://artworks.thetvdb.com/banners/v4/movie/2/posters/b.jpg');
  assert.equal(group.results[0].mediaType, 'MOVIE');
  assert.equal(group.results[0].externalId, '2');
  assert.equal(group.results[0].releaseYear, 2025);
  assert.ok(count('/movies/filter') >= 1);
});

test('Movie search, TMDB down: TheTVDB search; "movie-113" style ids become plain numeric ids; year filter applies', async () => {
  tvdbMovieHits = [
    { id: 'movie-113', tvdb_id: '113', name: 'Inception', year: '2010', image_url: 'https://artworks.thetvdb.com/banners/movies/113/posters/x.jpg', overview: 'A thief.', genres: ['Action', 'Science Fiction'], first_air_time: '2010-07-15' },
    { id: 'movie-999', name: 'Inception: The Cobol Job', year: '2010', image_url: 'https://artworks.thetvdb.com/banners/y.jpg' },
    { id: 'movie-5', name: 'Inception Remake', year: '2019', image_url: 'https://artworks.thetvdb.com/banners/z.jpg' }
  ];
  const all = (await searchMedia({ type: 'MOVIE', q: 'inception', page: 1 })).groups[0];
  assert.deepEqual(all.results.map((m) => m.externalId), ['113', '999', '5']);
  assert.equal(all.results[0].overview, 'A thief.');
  assert.deepEqual(all.results[0].genres, ['Action', 'Science Fiction']);
  const y2010 = (await searchMedia({ type: 'MOVIE', q: 'inception', page: 1, year: '2010' })).groups[0];
  assert.deepEqual(y2010.results.map((m) => m.externalId), ['113', '999']);
});

test('Movies without a TVDB key have no fallback: the original TMDB error is reported (no hidden guesses)', async () => {
  delete process.env.TVDB_API_KEY;
  await assert.rejects(getTrendingMedia({ type: 'MOVIE', window: 'week', page: 1 }), (e) => e.provider === 'TMDB' && ['NETWORK', 'TIMEOUT'].includes(e.kind));
  assert.equal(count('thetvdb'), 0);
});

// ----------------------------------------------------------------- the safety nets ---

test('with ALL types, one failing TMDB section no longer fails the page: movies and TV both fall back', async () => {
  schedule = [{ show: show(1, 'A Show') }];
  tvdbMovies = [{ id: 2, name: 'A Film', image: '/b/x.jpg', score: 1, year: '2025', status: { name: 'Released' } }];
  const res = await getTrendingMedia({ type: 'ALL', window: 'week', page: 1 }).catch((e) => e);
  // ANIME needs AniList (not mocked here), so it may fail; the TMDB-backed groups must succeed regardless
  const groups = res.groups ?? [];
  const tv = groups.find((g) => g.mediaType === 'TV');
  const movie = groups.find((g) => g.mediaType === 'MOVIE');
  assert.equal(tv?.error, null);
  assert.equal(movie?.error, null);
  assert.equal(tv.results[0].title, 'A Show');
  assert.equal(movie.results[0].title, 'A Film');
});

test('every provider failing: the last good copy of that exact list is served and marked stale', async () => {
  tmdbMode = 'ok';
  const fresh = (await getTrendingMedia({ type: 'TV', window: 'week', page: 1 })).groups[0];
  assert.equal(fresh.results[0].title, 'TMDB Show');
  assert.equal(fresh.stale, undefined);

  cache.clear(); // the short-lived response cache expired
  resetProviderHealth();
  tmdbMode = 'down';
  tvmazeDown = true;
  tvdbDown = true;
  const stale = (await getTrendingMedia({ type: 'TV', window: 'week', page: 1 })).groups[0];
  assert.equal(stale.results[0].title, 'TMDB Show');
  assert.equal(stale.stale, true);
  assert.match(stale.label, /last results/);

  // a list that was never loaded has no copy: the original error
  await assert.rejects(getTrendingMedia({ type: 'TV', window: 'day', page: 1 }), (e) => e.provider === 'TMDB');
});

test('circuit breaker: after TMDB fails once, the next lists skip it entirely (instant); after the pause it is probed again', async () => {
  schedule = [{ show: show(1, 'A Show') }];
  assert.equal(tmdbCircuitOpen(), false);
  await getTrendingMedia({ type: 'TV', window: 'week', page: 1 });
  assert.equal(tmdbCircuitOpen(), true, 'a transport failure opens the circuit');
  assert.ok(count('api.themoviedb.org') >= 1);

  calls = [];
  const second = (await getTrendingMedia({ type: 'TV', window: 'day', page: 1 })).groups[0];
  assert.equal(second.results[0].title, 'A Show');
  assert.equal(count('api.themoviedb.org'), 0, 'TMDB was not even asked while the circuit is open');

  // time passes: make the circuit expire, TMDB is back
  resetProviderHealth();
  tmdbMode = 'ok';
  calls = [];
  const probe = (await getTrendingMedia({ type: 'TV', window: 'week', page: 2 })).groups[0];
  assert.equal(probe.results[0].title, 'TMDB Show', 'TMDB is used again as soon as it answers');
  assert.equal(tmdbCircuitOpen(), false);
  assert.ok(CIRCUIT_OPEN_MS >= 60_000);
});

test('a real error from TMDB (not a transport failure) is never second-guessed and does not open the circuit', async () => {
  tmdbMode = 'bad-request';
  await assert.rejects(getTrendingMedia({ type: 'TV', window: 'week', page: 1 }));
  assert.equal(count('api.tvmaze.com'), 0);
  assert.equal(tmdbCircuitOpen(), false);
});

test('TMDB answering normally never touches the fallback providers', async () => {
  tmdbMode = 'ok';
  const group = (await getTrendingMedia({ type: 'TV', window: 'week', page: 1 })).groups[0];
  assert.equal(group.provider, 'TMDB');
  assert.equal(group.results[0].provider, 'TMDB');
  assert.equal(count('api.tvmaze.com'), 0);
  assert.equal(count('thetvdb'), 0);
});
