/**
 * Titles that come from TVMaze / TheTVDB (shown when TMDB cannot serve lists) are real titles:
 * they can be opened, tracked and followed, and they never become a second copy of a title the app
 * already knows from TMDB.
 *
 * REAL: routes, persistence, identity matching, episode sync, the Release Radar, SQL and RLS.
 * SUBSTITUTED: provider HTTP (globalThis.fetch) and authentication (`x-test-user`).
 */
import dotenv from 'dotenv';
dotenv.config();
process.env.NODE_ENV = 'test';
process.env.TMDB_API_READ_ACCESS_TOKEN ||= 'test-token';

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import request from 'supertest';

const { migrationPool, closePool } = await import('../src/config/database.js');
const { createLibraryRouter } = await import('../src/modules/library/library.routes.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const { getMediaDetails, cache } = await import('../src/services/mediaCatalog.service.js');
const { getSeasonsForMedia } = await import('../src/services/episodeCatalog.service.js');
const { getUpcoming, resetRadarState } = await import('../src/modules/library/radar.service.js');
const { resetTvdbState } = await import('../src/providers/tvdb.provider.js');
const { default: realApp } = await import('../src/app.js');

const admin = migrationPool;
const user = crypto.randomUUID();
const realFetch = globalThis.fetch;

const fakeAuth = (req, res, next) => {
  req.user = { id: req.headers['x-test-user'] };
  next();
};
const app = express();
app.use(express.json());
app.use('/api/library', createLibraryRouter({ auth: fakeAuth }));
app.use(errorHandler);
const api = (method, path, body) => {
  let r = request(app)[method](`/api/library${path}`).set('x-test-user', user);
  if (body !== undefined) r = r.send(body);
  return r;
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let calls;
let maze; // id -> show
let mazeEpisodes; // id -> episodes
let mazeSeasons;
let tvdbSeries;
let tvdbMovies;

function installFetch() {
  globalThis.fetch = async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('api.themoviedb.org')) throw new TypeError('TMDB must not be called for these titles');
    if (u.includes('api.tvmaze.com')) {
      const sub = u.match(/\/shows\/(\d+)\/(seasons|episodes)/);
      if (sub) return json((sub[2] === 'seasons' ? mazeSeasons : mazeEpisodes)[sub[1]] ?? []);
      const one = u.match(/\/shows\/(\d+)/);
      if (one) return maze[one[1]] ? json(maze[one[1]]) : json({}, 404);
    }
    if (u.includes('api4.thetvdb.com')) {
      if (u.endsWith('/login')) return json({ data: { token: 'jwt' } });
      const series = u.match(/\/series\/(\d+)\/extended/);
      if (series) return tvdbSeries[series[1]] ? json({ data: tvdbSeries[series[1]] }) : json({}, 404);
      const movie = u.match(/\/movies\/(\d+)\/extended/);
      if (movie) return tvdbMovies[movie[1]] ? json({ data: tvdbMovies[movie[1]] }) : json({}, 404);
    }
    throw new Error(`unmocked fetch ${u}`);
  };
}

const mazeShow = (id, name, extra = {}) => ({
  id,
  name,
  premiered: '2021-06-01',
  status: 'Running',
  summary: `<p>${name} (TVMaze)</p>`,
  genres: ['Drama'],
  rating: { average: 8.2 },
  image: { original: 'http://static.tvmaze.com/o.jpg' },
  externals: { imdb: null, thetvdb: null },
  ...extra
});

async function insertMedia(title, mediaType, provider, externalId, { metadata = {}, releaseDate = '2021-06-01', poster = null } = {}) {
  const { rows } = await admin.query(
    `INSERT INTO public.media_items (media_type, title, release_date, poster_path, metadata) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
    [mediaType, title, releaseDate, poster, JSON.stringify(metadata)]
  );
  await admin.query(`INSERT INTO public.media_sources (media_id, provider, provider_media_type, external_id) VALUES ($1, $2, $3, $4)`, [rows[0].id, provider, mediaType, String(externalId)]);
  return rows[0].id;
}
const sourcesOf = async (mediaId) =>
  Object.fromEntries((await admin.query('SELECT provider, external_id FROM public.media_sources WHERE media_id = $1', [mediaId])).rows.map((r) => [r.provider, r.external_id]));
const rowOf = async (mediaId) => (await admin.query('SELECT title, poster_path, metadata FROM public.media_items WHERE id = $1', [mediaId])).rows[0];
const countTitles = async (title) => (await admin.query('SELECT COUNT(*)::int AS n FROM public.media_items WHERE title = $1', [title])).rows[0].n;

async function cleanup() {
  await admin.query(`DELETE FROM auth.users WHERE id = $1 OR email LIKE 'zztest-idn-%@example.invalid'`, [user]);
  await admin.query(`DELETE FROM public.media_items WHERE title LIKE 'ZZTEST I %'`);
}

before(async () => {
  await cleanup();
  await admin.query(`INSERT INTO auth.users (id, aud, role, email) VALUES ($1, 'authenticated', 'authenticated', $2)`, [user, `zztest-idn-${user.slice(0, 8)}@example.invalid`]);
});
beforeEach(() => {
  calls = [];
  maze = {};
  mazeEpisodes = {};
  mazeSeasons = {};
  tvdbSeries = {};
  tvdbMovies = {};
  process.env.TVDB_API_KEY = 'key';
  resetTvdbState();
  resetRadarState();
  cache.clear();
  installFetch();
});
after(async () => {
  globalThis.fetch = realFetch;
  await cleanup();
  await closePool();
});

const detail = (provider, mediaType, externalId) => getMediaDetails({ provider, mediaType, externalId: String(externalId) });

// ------------------------------------------------------------------ routes ---

test('route: TVMAZE and TVDB are valid providers for their media types; other combinations are rejected', async () => {
  maze['994000001'] = mazeShow(994000001, 'ZZTEST I Route');
  const ok = await request(realApp).get('/api/media/details/tvmaze/tv/994000001');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.provider, 'TVMAZE');
  assert.equal(ok.body.data.title, 'ZZTEST I Route');
  assert.equal((await request(realApp).get('/api/media/details/TVMAZE/MOVIE/1')).status, 400, 'TVMaze has no movies');
  assert.equal((await request(realApp).get('/api/media/details/TVDB/ANIME/1')).status, 400);
  assert.equal((await request(realApp).get('/api/media/details/NOPE/TV/1')).status, 400);
});

// ------------------------------------------------------- tracking such a title ---

test('a TVMaze title can be tracked: its own episodes load from TVMaze (never TMDB) and progress works', async () => {
  maze['994000002'] = mazeShow(994000002, 'ZZTEST I Tracked');
  mazeSeasons['994000002'] = [{ number: 1 }];
  mazeEpisodes['994000002'] = [1, 2, 3].map((n) => ({ id: n, season: 1, number: n, name: `Ep ${n}`, airdate: '2021-06-0' + n, runtime: 30 }));
  const page = await detail('TVMAZE', 'TV', 994000002);
  assert.ok(page.catalogId);
  assert.deepEqual(await sourcesOf(page.catalogId), { TVMAZE: '994000002' });

  const entry = (await api('post', '', { mediaId: page.catalogId, status: 'WATCHING' })).body.data;
  const { seasons } = await getSeasonsForMedia(page.catalogId);
  assert.deepEqual(seasons.map((s) => s.episodes.length), [3]);
  assert.equal(calls.filter((u) => u.includes('themoviedb')).length, 0);

  const watched = await api('post', `/${entry.id}/episodes/${seasons[0].episodes[0].id}/watched`);
  assert.equal(watched.body.data.watchedEpisodesCount, 1);
  assert.equal(watched.body.data.totalEpisodes, 3);
  assert.equal(watched.body.data.media?.provider ?? 'TVMAZE', 'TVMAZE');
  const row = (await api('get', `/check/${page.catalogId}`)).body.data.entry;
  assert.equal(row.media.provider, 'TVMAZE');
  assert.equal(row.media.externalId, '994000002');
});

test('a TheTVDB movie title can be opened and tracked', async () => {
  tvdbMovies['994100001'] = { id: 994100001, name: 'ZZTEST I Film', year: '2022', runtime: 100, image: '/banners/v4/movie/1/posters/a.jpg', genres: [{ name: 'Drama' }] };
  const page = await detail('TVDB', 'MOVIE', 994100001);
  assert.equal(page.mediaType, 'MOVIE');
  assert.equal(page.posterUrl, 'https://artworks.thetvdb.com/banners/v4/movie/1/posters/a.jpg');
  assert.deepEqual(await sourcesOf(page.catalogId), { TVDB: '994100001' });
  const added = await api('post', '', { mediaId: page.catalogId, status: 'COMPLETED' });
  assert.equal(added.status, 201);
});

// ---------------------------------------------------------- identity matching ---

test('SAME TITLE, DIFFERENT PROVIDER: a TVMaze record with the same IMDb id joins the existing TMDB title (no duplicate, library entry shared, richer data kept)', async () => {
  const tmdbRow = await insertMedia('ZZTEST I Imdb Show', 'TV', 'TMDB', '994200001', { metadata: { externalIds: { imdb: 'tt9942', tvdb: null } }, poster: 'https://image.tmdb.org/t/p/w342/tmdb.jpg' });
  const entry = (await api('post', '', { mediaId: tmdbRow, status: 'WATCHING', rating: 8 })).body.data;

  maze['994200002'] = mazeShow(994200002, 'ZZTEST I Imdb Show (as TVMaze names it)', { externals: { imdb: 'tt9942', thetvdb: null } });
  const page = await detail('TVMAZE', 'TV', 994200002);

  assert.equal(page.catalogId, tmdbRow, 'the same title row');
  assert.deepEqual(await sourcesOf(tmdbRow), { TMDB: '994200001', TVMAZE: '994200002' });
  const row = await rowOf(tmdbRow);
  assert.equal(row.title, 'ZZTEST I Imdb Show', 'the richer TMDB data is not overwritten by a fallback record');
  assert.equal(row.poster_path, 'https://image.tmdb.org/t/p/w342/tmdb.jpg');
  const mine = (await api('get', `/check/${page.catalogId}`)).body.data.entry;
  assert.equal(mine.id, entry.id, 'the user is already tracking it');
  assert.equal(mine.rating, 8);
  assert.equal((await admin.query(`SELECT COUNT(*)::int AS n FROM public.media_sources WHERE provider = 'TVMAZE' AND external_id = '994200002'`)).rows[0].n, 1);
});

test('SAME TITLE by exact name and year (no IMDb id): joined; a different year or an ambiguous match creates a separate title', async () => {
  const row = await insertMedia('ZZTEST I Twin Show', 'TV', 'TMDB', '994300001', { releaseDate: '2021-06-01' });
  maze['994300002'] = mazeShow(994300002, 'zztest i twin show', { premiered: '2021-09-09' }); // same name (case-insensitive), same year
  assert.equal((await detail('TVMAZE', 'TV', 994300002)).catalogId, row);

  maze['994300003'] = mazeShow(994300003, 'ZZTEST I Twin Show', { premiered: '1999-01-01' }); // a different show of the same name
  const other = await detail('TVMAZE', 'TV', 994300003);
  assert.notEqual(other.catalogId, row, 'different year: a separate title');
  assert.equal(await countTitles('ZZTEST I Twin Show'), 2);

  // two existing titles that both fit: never guess
  await insertMedia('ZZTEST I Ambiguous', 'TV', 'TMDB', '994300010', { releaseDate: '2020-01-01' });
  await insertMedia('ZZTEST I Ambiguous', 'TV', 'TMDB', '994300011', { releaseDate: '2020-05-05' });
  maze['994300012'] = mazeShow(994300012, 'ZZTEST I Ambiguous', { premiered: '2020-03-03' });
  const amb = await detail('TVMAZE', 'TV', 994300012);
  assert.deepEqual(await sourcesOf(amb.catalogId), { TVMAZE: '994300012' }, 'a new title, linked to neither');
  assert.equal(await countTitles('ZZTEST I Ambiguous'), 3);
});

test('two DIFFERENT TMDB entries with the same name and year stay two titles', async () => {
  const first = await insertMedia('ZZTEST I Remake', 'TV', 'TMDB', '994400001', { releaseDate: '2021-01-01' });
  globalThis.fetch = async (url) => {
    if (/api\.themoviedb\.org\/3\/tv\/994400002/.test(String(url))) {
      return json({ id: 994400002, name: 'ZZTEST I Remake', first_air_date: '2021-03-03', status: 'Ended', genres: [], seasons: [] });
    }
    throw new Error(`unmocked ${url}`);
  };
  const second = await getMediaDetails({ provider: 'TMDB', mediaType: 'TV', externalId: '994400002' });
  assert.notEqual(second.catalogId, first, 'a second TMDB record is a second title, whatever its name and year');
  assert.deepEqual(await sourcesOf(first), { TMDB: '994400001' });
  assert.deepEqual(await sourcesOf(second.catalogId), { TMDB: '994400002' });
  assert.equal(await countTitles('ZZTEST I Remake'), 2);
});

test('TMDB arriving later for a title first seen through TVMaze: the SAME row is upgraded, the library entry survives', async () => {
  maze['994500001'] = mazeShow(994500001, 'ZZTEST I Late TMDB', { externals: { imdb: 'tt9945', thetvdb: null } });
  const viaMaze = await detail('TVMAZE', 'TV', 994500001);
  const entry = (await api('post', '', { mediaId: viaMaze.catalogId, status: 'WATCHING', rating: 9 })).body.data;

  // TMDB recovers and the same show is opened under its TMDB id
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('api.themoviedb.org') && /\/tv\/994500002/.test(u)) {
      return json({ id: 994500002, name: 'ZZTEST I Late TMDB', overview: 'Full TMDB record.', first_air_date: '2021-06-01', status: 'Returning Series', poster_path: '/full.jpg', genres: [{ name: 'Drama' }], seasons: [], external_ids: { imdb_id: 'tt9945', tvdb_id: 1 } });
    }
    throw new Error(`unmocked ${u}`);
  };
  cache.clear();
  const viaTmdb = await detail('TMDB', 'TV', 994500002);
  assert.equal(viaTmdb.catalogId, viaMaze.catalogId, 'one title');
  assert.deepEqual(await sourcesOf(viaMaze.catalogId), { TVMAZE: '994500001', TMDB: '994500002' });
  const row = await rowOf(viaMaze.catalogId);
  assert.equal(row.poster_path, 'https://image.tmdb.org/t/p/w342/full.jpg', 'primary data took over');
  const mine = (await api('get', `/check/${viaMaze.catalogId}`)).body.data.entry;
  assert.equal(mine.id, entry.id);
  assert.equal(mine.rating, 9);
});

// ----------------------------------------------------------------- the radar ---

test('Release Radar: a TVMaze title is refreshed from TVMaze (not TMDB)', async () => {
  const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  maze['994600001'] = mazeShow(994600001, 'ZZTEST I Radar', { _embedded: { nextepisode: { airdate: day, number: 5, season: 2 } } });
  const mediaId = (await detail('TVMAZE', 'TV', 994600001)).catalogId;
  await admin.query(`UPDATE public.media_items SET metadata = metadata || '{"status":"Returning Series","nextAirDate":"2020-01-01"}'::jsonb WHERE id = $1`, [mediaId]);
  await api('post', '', { mediaId, status: 'WATCHING' });
  calls = [];

  const { items } = await getUpcoming(user);
  const item = items.find((i) => i.mediaId === mediaId);
  assert.ok(item, 'on the radar');
  assert.equal(item.provider, 'TVMAZE');
  assert.equal(item.airDate, day);
  assert.equal(item.nextEpisode, 5);
  assert.equal(item.seasonNumber, 2);
  assert.ok(!calls.some((u) => u.includes('/tv/994600001')), 'TMDB is not asked about a TVMaze title');
  assert.ok(calls.some((u) => u.includes('api.tvmaze.com/shows/994600001')));
});
