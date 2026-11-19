/**
 * TVMaze and TheTVDB providers, their normalizers, title matching and TMDB's fast mode.
 * No database; every HTTP call is mocked (globalThis.fetch).
 */
process.env.NODE_ENV = 'test';
process.env.TMDB_API_READ_ACCESS_TOKEN = 'test-token';

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const tvmaze = await import('../../src/providers/tvmaze.provider.js');
const tvdb = await import('../../src/providers/tvdb.provider.js');
const tmdb = await import('../../src/providers/tmdb.provider.js');
const { ProviderError } = await import('../../src/providers/providerError.js');
const { normalizeTitle, pickTitleMatch } = await import('../../src/utils/titleMatch.js');
const { normalizeTvMazeShow, normalizeTvDbMedia, buildPlanFromTvMaze, buildPlanFromTvDb, normalizeTmdbMedia } = await import(
  '../../src/services/mediaNormalizer.js'
);
const { isFallbackWorthy } = await import('../../src/services/fallbackProviders.service.js');

const realFetch = globalThis.fetch;
let calls;
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const mockFetch = (handler) => {
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(String(url), init);
  };
};
beforeEach(() => {
  calls = [];
  tvdb.resetTvdbState();
  delete process.env.TVDB_API_KEY;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const SHOW = {
  id: 82,
  name: 'Game of Thrones',
  url: 'https://www.tvmaze.com/shows/82/game-of-thrones',
  premiered: '2011-04-17',
  ended: '2019-05-19',
  status: 'Ended',
  runtime: 60,
  weight: 98,
  rating: { average: 8.9 },
  genres: ['Drama', 'Adventure', 'Fantasy'],
  summary: '<p>Based on the <b>best-selling</b> books.<br>Nine noble families.</p>',
  image: { medium: 'http://static.tvmaze.com/m.jpg', original: 'http://static.tvmaze.com/o.jpg' }
};

// ------------------------------------------------------------ title matching ---

test('title matching: normalized exact matches only; years must agree; ambiguity is rejected', () => {
  assert.equal(normalizeTitle('Doctor Who (2005)'), 'doctor who');
  assert.equal(normalizeTitle('Marvel’s Agents of S.H.I.E.L.D.'), 'marvel s agents of s h i e l d');
  assert.equal(normalizeTitle('Café Society & Co'), 'cafe society and co');

  const cands = [
    { name: 'Shameless', year: 2004, id: 'uk' },
    { name: 'Shameless', year: 2011, id: 'us' },
    { name: 'Shameless: Behind the Scenes', year: 2011, id: 'x' }
  ];
  assert.equal(pickTitleMatch(cands, { title: 'shameless', year: 2011 }).id, 'us');
  assert.equal(pickTitleMatch(cands, { title: 'Shameless', year: 2004 }).id, 'uk');
  assert.equal(pickTitleMatch(cands, { title: 'Shameless', year: 1990 }), null, 'wrong year: no match');
  assert.equal(pickTitleMatch(cands, { title: 'Shameless', year: null }), null, 'two equal titles and no year: ambiguous');
  assert.equal(pickTitleMatch([cands[0]], { title: 'Shameless', year: null }).id, 'uk', 'a single exact match is fine');
  assert.equal(pickTitleMatch(cands, { title: 'Shame', year: 2011 }), null, 'a partial title never matches');
  assert.equal(pickTitleMatch([], { title: 'x', year: 2000 }), null);
});

// ------------------------------------------------------------------- TVMaze ---

test('TVMaze: search, details (with the next episode embedded), lookups and seasons+episodes', async () => {
  mockFetch((url) => {
    if (url.includes('/search/shows')) return json([{ score: 1, show: SHOW }, { score: 0.5, show: { ...SHOW, id: 1, name: 'Game of Thrones: Recap' } }]);
    if (url.includes('/lookup/shows?imdb=tt0944947')) return json(SHOW);
    if (url.includes('/lookup/shows?thetvdb=999')) return json({}, 404);
    if (url.includes('/seasons')) return json([{ number: 1, name: '', episodeOrder: 10 }]);
    if (url.includes('/episodes')) return json([{ id: 1, season: 1, number: 1, name: 'Winter Is Coming' }]);
    if (url.includes('/shows/82')) return json(SHOW);
    throw new Error(`unmocked ${url}`);
  });
  assert.deepEqual((await tvmaze.searchTv('game of thrones')).map((s) => s.id), [82, 1]);
  assert.equal((await tvmaze.getTvDetails(82)).name, 'Game of Thrones');
  assert.ok(calls.at(-1).url.includes('embed=nextepisode'));
  assert.equal((await tvmaze.lookupByExternalId({ imdb: 'tt0944947' })).id, 82);
  assert.equal(await tvmaze.lookupByExternalId({ thetvdb: '999' }), null, 'unknown id is null, not an error');
  assert.equal(await tvmaze.lookupByExternalId({}), null);
  assert.equal((await tvmaze.lookupByTitle('Game of Thrones', 2011)).id, 82);
  assert.equal(await tvmaze.lookupByTitle('Game of', 2011), null);
  const both = await tvmaze.getTvSeasonsAndEpisodes(82);
  assert.equal(both.seasons.length, 1);
  assert.equal(both.episodes.length, 1);
  assert.ok(calls.some((c) => c.url.includes('/episodes?specials=1')));
});

test('TVMaze: errors are mapped (404, 429 with Retry-After, 5xx, network)', async () => {
  mockFetch(() => json({}, 404));
  await assert.rejects(tvmaze.getTvDetails(1), (e) => e instanceof ProviderError && e.kind === 'NOT_FOUND');
  mockFetch(() => json({}, 429, { 'retry-after': '7' }));
  await assert.rejects(tvmaze.getTvDetails(1), (e) => e.kind === 'RATE_LIMITED' && e.retryAfterSeconds === 7);
  mockFetch(() => json({}, 503));
  await assert.rejects(tvmaze.searchTv('x'), (e) => e.kind === 'UNAVAILABLE');
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed');
  };
  await assert.rejects(tvmaze.getTvDetails(1), (e) => e.kind === 'NETWORK');
});

test('normalizeTvMazeShow: unified shape, HTML stripped, https images, status in TMDB wording, rating already 0-10', () => {
  const m = normalizeTvMazeShow({ ...SHOW, _embedded: { nextepisode: { airdate: '2026-12-01', number: 4, season: 2 } }, status: 'Running' });
  assert.equal(m.provider, 'TVMAZE');
  assert.equal(m.externalId, '82');
  assert.equal(m.mediaType, 'TV');
  assert.equal(m.title, 'Game of Thrones');
  assert.equal(m.overview, 'Based on the best-selling books.\nNine noble families.');
  assert.equal(m.posterUrl, 'https://static.tvmaze.com/o.jpg', 'original wins over medium, and is https');
  assert.equal(m.releaseDate, '2011-04-17');
  assert.equal(m.releaseYear, 2011);
  assert.equal(m.sourceRating, 8.9);
  assert.equal(m.sourceRatingName, 'TVMaze');
  assert.equal(m.status, 'Returning Series');
  assert.equal(m.runtimeMinutes, 60);
  assert.deepEqual(m.genres, ['Drama', 'Adventure', 'Fantasy']);
  assert.deepEqual(m.nextEpisode, { airDate: '2026-12-01', episode: 4, season: 2 });
  assert.equal(normalizeTvMazeShow(SHOW).status, 'Ended');
  assert.equal(normalizeTvMazeShow({ ...SHOW, image: { medium: 'http://static.tvmaze.com/m.jpg' } }).posterUrl, 'https://static.tvmaze.com/m.jpg');
  assert.equal(normalizeTvMazeShow({ ...SHOW, rating: { average: null }, image: null }).sourceRating, null);
  assert.equal(normalizeTvMazeShow({ ...SHOW, image: null }).posterUrl, null);
  assert.equal(normalizeTvMazeShow(null), null);
  assert.equal(normalizeTvMazeShow({ id: 1, name: '  ' }), null);
});

test('buildPlanFromTvMaze: seasons and episodes, specials become Season 0, duplicates never double up', () => {
  const plan = buildPlanFromTvMaze({
    seasons: [
      { number: 1, name: '', premiereDate: '2011-04-17', summary: '<p>The first.</p>', image: { medium: 'http://x/s1.jpg' } },
      { number: 2, name: 'The War', premiereDate: '2012-04-01' }
    ],
    episodes: [
      { season: 1, number: 2, name: 'The Kingsroad', airdate: '2011-04-24', runtime: 56, summary: '<p>Ned heads south.</p>' },
      { season: 1, number: 1, name: 'Winter Is Coming', airdate: '2011-04-17', runtime: 62 },
      { season: 1, number: 1, name: 'Duplicate', airdate: '2011-04-17' },
      { season: 2, number: 1, name: '', airdate: '2012-04-01' },
      { season: 1, number: null, name: 'Inside the Episode', airdate: '2011-06-01', type: 'insignificant_special' },
      { season: 2, number: null, name: 'Recap', airdate: '2012-03-30' }
    ]
  });
  assert.deepEqual(plan.map((s) => [s.seasonNumber, s.name, s.episodeCount]), [[0, 'Specials', 2], [1, 'Season 1', 2], [2, 'The War', 1]]);
  const s1 = plan[1];
  assert.deepEqual(s1.episodes.map((e) => e.episodeNumber), [1, 2], 'sorted by number');
  assert.equal(s1.episodes[0].title, 'Winter Is Coming');
  assert.equal(s1.episodes[0].runtimeMinutes, 62);
  assert.equal(s1.episodes[1].overview, 'Ned heads south.');
  assert.equal(s1.airDate, '2011-04-17');
  assert.equal(s1.overview, 'The first.');
  assert.equal(s1.posterUrl, 'https://x/s1.jpg');
  assert.equal(plan[2].episodes[0].title, 'Episode 1', 'a blank title falls back to "Episode N"');
  assert.deepEqual(plan[0].episodes.map((e) => e.episodeNumber), [1, 2], 'specials are numbered in order');
  assert.deepEqual(buildPlanFromTvMaze({}), []);
});

// -------------------------------------------------------------------- TheTVDB ---

test('TheTVDB: without TVDB_API_KEY every call is NOT_CONFIGURED and nothing is requested', async () => {
  mockFetch(() => json({}));
  assert.equal(tvdb.isConfigured(), false);
  await assert.rejects(tvdb.search('x'), (e) => e.kind === 'NOT_CONFIGURED');
  await assert.rejects(tvdb.getSeriesDetails(1), (e) => e.kind === 'NOT_CONFIGURED');
  assert.equal(calls.length, 0);
});

test('TheTVDB: ONE login serves many calls (token cached), Bearer on every request, concurrent logins are shared', async () => {
  process.env.TVDB_API_KEY = 'key-123';
  mockFetch((url) => {
    if (url.endsWith('/login')) return json({ status: 'success', data: { token: 'jwt-1' } });
    if (url.includes('/search')) return json({ data: [{ tvdb_id: '81189', name: 'Breaking Bad', year: '2008' }] });
    if (url.includes('/series/81189/extended')) return json({ data: { id: 81189, name: 'Breaking Bad' } });
    if (url.includes('/movies/603/extended')) return json({ data: { id: 603, name: 'The Matrix' } });
    throw new Error(`unmocked ${url}`);
  });
  await Promise.all([tvdb.search('breaking bad'), tvdb.getSeriesDetails(81189), tvdb.getMovieDetails(603)]);
  await tvdb.search('again', 'movie');
  const logins = calls.filter((c) => c.url.endsWith('/login'));
  assert.equal(logins.length, 1);
  assert.equal(JSON.parse(logins[0].init.body).apikey, 'key-123');
  assert.equal(logins[0].init.method, 'POST');
  for (const c of calls.filter((x) => !x.url.endsWith('/login'))) assert.equal(c.init.headers.Authorization, 'Bearer jwt-1');
  assert.ok(calls.some((c) => c.url.includes('type=movie')));
});

test('TheTVDB: an expired token (401) is refreshed once; a second 401 is an AUTH error', async () => {
  process.env.TVDB_API_KEY = 'key-123';
  let logins = 0;
  mockFetch((url, init) => {
    if (url.endsWith('/login')) return json({ data: { token: `jwt-${++logins}` } });
    return init.headers.Authorization === 'Bearer jwt-2' ? json({ data: { id: 1, name: 'Ok' } }) : json({}, 401);
  });
  assert.equal((await tvdb.getSeriesDetails(1)).name, 'Ok');
  assert.equal(logins, 2);

  tvdb.resetTvdbState();
  mockFetch((url) => (url.endsWith('/login') ? json({ data: { token: 't' } }) : json({}, 401)));
  await assert.rejects(tvdb.getSeriesDetails(1), (e) => e.kind === 'AUTH');
});

test('TheTVDB: a rejected key at login is an AUTH error; 404 / 429 / 5xx map correctly', async () => {
  process.env.TVDB_API_KEY = 'bad';
  mockFetch(() => json({}, 401));
  await assert.rejects(tvdb.search('x'), (e) => e.kind === 'AUTH');

  tvdb.resetTvdbState();
  mockFetch((url) => (url.endsWith('/login') ? json({ data: { token: 't' } }) : json({}, 404)));
  await assert.rejects(tvdb.getSeriesDetails(1), (e) => e.kind === 'NOT_FOUND');
  mockFetch((url) => (url.endsWith('/login') ? json({ data: { token: 't' } }) : json({}, 429, { 'retry-after': '3' })));
  await assert.rejects(tvdb.getSeriesDetails(1), (e) => e.kind === 'RATE_LIMITED' && e.retryAfterSeconds === 3);
  mockFetch((url) => (url.endsWith('/login') ? json({ data: { token: 't' } }) : json({}, 502)));
  await assert.rejects(tvdb.getSeriesDetails(1), (e) => e.kind === 'UNAVAILABLE');
});

test('TheTVDB: episodes follow the pagination', async () => {
  process.env.TVDB_API_KEY = 'key-123';
  mockFetch((url) => {
    if (url.endsWith('/login')) return json({ data: { token: 't' } });
    const page = Number(new URL(url).searchParams.get('page'));
    return json({ data: { episodes: [{ number: page + 1, seasonNumber: 1 }] }, links: { next: page < 2 ? page + 1 : null } });
  });
  const eps = await tvdb.getSeriesEpisodes(7);
  assert.deepEqual(eps.map((e) => e.number), [1, 2, 3]);
});

test('normalizeTvDbMedia: series and movies in the unified shape; TheTVDB has no 0-10 rating so none is invented', () => {
  const series = normalizeTvDbMedia(
    { id: 81189, name: 'Breaking Bad', overview: 'A teacher turns.', image: 'http://artworks/x.jpg', firstAired: '2008-01-20', lastAired: '2013-09-29', status: { name: 'Ended' }, genres: [{ name: 'Drama' }, { name: 'Crime' }], averageRuntime: 47, score: 9999999 },
    'TV'
  );
  assert.equal(series.provider, 'TVDB');
  assert.equal(series.externalId, '81189');
  assert.equal(series.mediaType, 'TV');
  assert.equal(series.posterUrl, 'https://artworks/x.jpg');
  assert.equal(series.status, 'Ended');
  assert.equal(series.sourceRating, null);
  assert.equal(series.sourceRatingName, 'TheTVDB');
  assert.equal(series.releaseYear, 2008);
  assert.equal(series.endDate, '2013-09-29');
  assert.deepEqual(series.genres, ['Drama', 'Crime']);
  assert.equal(series.runtimeMinutes, 47);
  assert.equal(normalizeTvDbMedia({ id: 1, name: 'X', status: { name: 'Continuing' } }, 'TV').status, 'Returning Series');

  const movie = normalizeTvDbMedia({ id: 603, name: 'The Matrix', year: '1999', runtime: 136, translations: { overviewTranslations: [{ language: 'fra', overview: 'Salut' }, { language: 'eng', overview: 'A hacker wakes.' }] } }, 'MOVIE');
  assert.equal(movie.mediaType, 'MOVIE');
  assert.equal(movie.releaseYear, 1999);
  assert.equal(movie.releaseDate, null);
  assert.equal(movie.runtimeMinutes, 136);
  assert.equal(movie.overview, 'A hacker wakes.');
  assert.equal(movie.status, null);
  assert.equal(normalizeTvDbMedia({ name: 'no id' }, 'TV'), null);
  assert.equal(normalizeTvDbMedia(null, 'TV'), null);
});

test('buildPlanFromTvDb: seasons from episodes, season 0 = Specials, entries without a number are skipped', () => {
  const plan = buildPlanFromTvDb([
    { seasonNumber: 1, number: 2, name: 'Cat\'s in the Bag', aired: '2008-01-27', runtime: 48, overview: 'Cleanup.' },
    { seasonNumber: 1, number: 1, name: 'Pilot', aired: '2008-01-20' },
    { seasonNumber: 1, number: 1, name: 'Dup' },
    { seasonNumber: 2, number: 1, name: '' },
    { seasonNumber: 0, number: 1, name: 'Webisode' },
    { seasonNumber: 1, number: null, name: 'Orphan' },
    { number: 3, name: 'No season' }
  ]);
  assert.deepEqual(plan.map((s) => [s.seasonNumber, s.name, s.episodeCount]), [[0, 'Specials', 1], [1, 'Season 1', 2], [2, 'Season 2', 1]]);
  assert.deepEqual(plan[1].episodes.map((e) => e.title), ['Pilot', "Cat's in the Bag"]);
  assert.equal(plan[1].episodes[1].runtimeMinutes, 48);
  assert.equal(plan[2].episodes[0].title, 'Episode 1');
  assert.deepEqual(buildPlanFromTvDb([]), []);
});

// --------------------------------------------------------- TMDB behaviour ---

test('TMDB: external ids are requested and exposed; posters use the lighter w342 size', () => {
  const m = normalizeTmdbMedia({ id: 1399, name: 'GoT', poster_path: '/p.jpg', external_ids: { imdb_id: 'tt0944947', tvdb_id: 121361 } }, 'TV');
  assert.deepEqual(m.externalIds, { imdb: 'tt0944947', tvdb: '121361' });
  assert.equal(m.posterUrl, 'https://image.tmdb.org/t/p/w342/p.jpg');
  assert.equal('externalIds' in normalizeTmdbMedia({ id: 2, name: 'No ids' }, 'TV'), false);
});

test('TMDB: "fast" mode is ONE short attempt; normal mode retries once', async () => {
  globalThis.fetch = async (url) => {
    calls.push({ url: String(url) });
    throw new TypeError('fetch failed');
  };
  await assert.rejects(tmdb.getTvDetails(1, { fast: true }), (e) => e.kind === 'NETWORK');
  assert.equal(calls.length, 1, 'no retry in fast mode');
  assert.ok(calls[0].url.includes('append_to_response=external_ids'));

  calls = [];
  await assert.rejects(tmdb.getTvDetails(1), (e) => e.kind === 'NETWORK');
  assert.equal(calls.length, 2, 'one automatic retry otherwise');
  assert.equal(tmdb.FAST_TIMEOUT_MS, 6000);
});

test('fallback is for transient failures only: timeouts, network, 5xx, rate limits - never a 404', () => {
  for (const kind of ['TIMEOUT', 'NETWORK', 'UNAVAILABLE', 'RATE_LIMITED']) assert.equal(isFallbackWorthy(new ProviderError('TMDB', kind)), true, kind);
  for (const kind of ['NOT_FOUND', 'AUTH', 'NOT_CONFIGURED', 'BAD_REQUEST']) assert.equal(isFallbackWorthy(new ProviderError('TMDB', kind)), false, kind);
  assert.equal(isFallbackWorthy(new Error('boom')), false);
});
