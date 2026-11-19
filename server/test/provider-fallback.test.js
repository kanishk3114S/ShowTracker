/**
 * Multi-tier provider fallback (TMDB -> TVMaze -> TheTVDB) against the real database.
 *
 * REAL: orchestration, persistence, episode sync, the library API, SQL and RLS (as `showtracker_app`).
 * SUBSTITUTED: every provider's HTTP (globalThis.fetch) and authentication (`x-test-user`).
 *
 * The point being proven: whichever provider supplies the data, a title keeps ONE internal id, and user
 * library rows and watched episodes keep pointing at it (and at the same episode ids).
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
const { syncSeasonsAndEpisodes, getSeasonsForMedia, ENDED_TV_RECHECK_MS } = await import('../src/services/episodeCatalog.service.js');
const { rememberTitles, resetTitleIndex } = await import('../src/services/fallbackProviders.service.js');
const { resetTvdbState } = await import('../src/providers/tvdb.provider.js');
const { DEFAULT_PROVIDER_TIMEOUT_MS } = await import('../src/providers/providerError.js');

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

// ---------------------------------------------------------------- mock world ---

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let calls; // every URL requested
let tmdbDown;
let tmdbTv; // id -> tv details body
let tmdbSeasons; // `${id}:${n}` -> season body
let tmdbMovies; // id -> movie body
let tmdbStatus; // id -> forced HTTP status (e.g. 404)
let maze; // { shows: [], seasons: {id: []}, episodes: {id: []}, byImdb: {imdb: show} }
let mazeDown;
let tvdbData; // { series: {id: body}, movies: {id: body}, episodes: {id: []}, hits: {series: [], movie: []} }
const count = (needle) => calls.filter((u) => u.includes(needle)).length;

function installFetch() {
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    calls.push(u);
    if (u.includes('api.themoviedb.org')) {
      if (tmdbDown) throw new TypeError('fetch failed');
      const tv = u.match(/\/tv\/(\d+)(?:\/season\/(\d+))?/);
      const movie = u.match(/\/movie\/(\d+)/);
      const id = tv?.[1] ?? movie?.[1];
      if (tmdbStatus[id]) return json({}, tmdbStatus[id]);
      if (tv?.[2] !== undefined) return tmdbSeasons[`${tv[1]}:${tv[2]}`] ? json(tmdbSeasons[`${tv[1]}:${tv[2]}`]) : json({}, 404);
      if (tv) return tmdbTv[tv[1]] ? json(tmdbTv[tv[1]]) : json({}, 404);
      if (movie) return tmdbMovies[movie[1]] ? json(tmdbMovies[movie[1]]) : json({}, 404);
    }
    if (u.includes('api.tvmaze.com')) {
      if (mazeDown) throw new TypeError('fetch failed');
      if (u.includes('/search/shows')) {
        const q = decodeURIComponent(new URL(u).searchParams.get('q')).toLowerCase();
        return json(maze.shows.filter((s) => s.name.toLowerCase().includes(q)).map((show) => ({ score: 1, show })));
      }
      const imdb = u.match(/lookup\/shows\?imdb=([^&]+)/);
      if (imdb) return maze.byImdb[imdb[1]] ? json(maze.byImdb[imdb[1]]) : json({}, 404);
      if (u.includes('/lookup/shows')) return json({}, 404);
      const sub = u.match(/\/shows\/(\d+)\/(seasons|episodes)/);
      if (sub) return json((sub[2] === 'seasons' ? maze.seasons : maze.episodes)[sub[1]] ?? []);
      const one = u.match(/\/shows\/(\d+)/);
      if (one) {
        const show = maze.shows.find((s) => String(s.id) === one[1]);
        return show ? json(show) : json({}, 404);
      }
    }
    if (u.includes('api4.thetvdb.com')) {
      if (u.endsWith('/login')) return json({ data: { token: 'jwt' } });
      if (u.includes('/search')) return json({ data: tvdbData.hits[new URL(u).searchParams.get('type')] ?? [] });
      const ep = u.match(/\/series\/(\d+)\/episodes\/default/);
      if (ep) return json({ data: { episodes: tvdbData.episodes[ep[1]] ?? [] }, links: { next: null } });
      const series = u.match(/\/series\/(\d+)\/extended/);
      if (series) return tvdbData.series[series[1]] ? json({ data: tvdbData.series[series[1]] }) : json({}, 404);
      const movie = u.match(/\/movies\/(\d+)\/extended/);
      if (movie) return tvdbData.movies[movie[1]] ? json({ data: tvdbData.movies[movie[1]] }) : json({}, 404);
    }
    throw new Error(`unmocked fetch ${u}`);
  };
}

const tmdbShow = (id, name, extra = {}) => ({
  id,
  name,
  overview: `${name} (TMDB)`,
  first_air_date: '2015-05-05',
  status: 'Ended',
  poster_path: '/tmdb.jpg',
  genres: [{ name: 'Drama' }],
  tagline: 'The TMDB tagline',
  seasons: [{ season_number: 1, name: 'Season 1', episode_count: 3 }],
  external_ids: { imdb_id: `tt${id}`, tvdb_id: 5000 + id },
  ...extra
});
const tmdbSeason = (n, titles) => ({ season_number: n, name: `Season ${n}`, episodes: titles.map((t, i) => ({ episode_number: i + 1, name: t, air_date: '2015-05-05' })) });
const mazeShow = (id, name, extra = {}) => ({ id, name, premiered: '2015-04-30', status: 'Ended', summary: `<p>${name} (TVMaze)</p>`, genres: ['Drama'], rating: { average: 8 }, image: { original: 'http://static.tvmaze.com/o.jpg' }, ...extra });
const mazeEpisodes = (n, titles) => titles.map((name, i) => ({ id: n * 100 + i, season: n, number: i + 1, name, airdate: '2015-05-05', runtime: 45 }));

async function insertMedia(title, mediaType, externalId, metadata = {}, releaseDate = '2015-05-05') {
  const { rows } = await admin.query(
    `INSERT INTO public.media_items (media_type, title, release_date, metadata) VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
    [mediaType, title, releaseDate, JSON.stringify(metadata)]
  );
  await admin.query(`INSERT INTO public.media_sources (media_id, provider, provider_media_type, external_id) VALUES ($1, 'TMDB', $2, $3)`, [rows[0].id, mediaType, String(externalId)]);
  return rows[0].id;
}
const sourcesOf = async (mediaId) =>
  Object.fromEntries((await admin.query('SELECT provider, external_id FROM public.media_sources WHERE media_id = $1', [mediaId])).rows.map((r) => [r.provider, r.external_id]));
const metaOf = async (mediaId) => (await admin.query('SELECT metadata FROM public.media_items WHERE id = $1', [mediaId])).rows[0].metadata;

async function cleanup() {
  await admin.query(`DELETE FROM auth.users WHERE id = $1 OR email LIKE 'zztest-pfb-%@example.invalid'`, [user]);
  await admin.query(`DELETE FROM public.media_items WHERE title LIKE 'ZZTEST P %'`);
}

before(async () => {
  await cleanup();
  await admin.query(`INSERT INTO auth.users (id, aud, role, email) VALUES ($1, 'authenticated', 'authenticated', $2)`, [user, `zztest-pfb-${user.slice(0, 8)}@example.invalid`]);
});
beforeEach(() => {
  calls = [];
  tmdbDown = false;
  tmdbTv = {};
  tmdbSeasons = {};
  tmdbMovies = {};
  tmdbStatus = {};
  maze = { shows: [], seasons: {}, episodes: {}, byImdb: {} };
  mazeDown = false;
  tvdbData = { series: {}, movies: {}, episodes: {}, hits: { series: [], movie: [] } };
  delete process.env.TVDB_API_KEY;
  resetTvdbState();
  resetTitleIndex();
  cache.clear();
  installFetch();
});
after(async () => {
  globalThis.fetch = realFetch;
  await cleanup();
  await closePool();
});

// ------------------------------------------------------------------- details ---

test('timeouts: the default provider timeout is 14 s', () => {
  assert.equal(DEFAULT_PROVIDER_TIMEOUT_MS, 14_000);
});

test('details: TMDB down on a never-stored title -> TVMaze supplies it, stored under the TMDB identity, with the TVMaze id linked', async () => {
  maze.shows = [mazeShow(7001, 'ZZTEST P Alpha')];
  rememberTitles([{ provider: 'TMDB', mediaType: 'TV', externalId: '993000001', title: 'ZZTEST P Alpha', releaseYear: 2015 }]); // seen in a search result earlier
  tmdbDown = true;

  const page = await getMediaDetails({ provider: 'TMDB', mediaType: 'TV', externalId: '993000001' });
  assert.equal(page.title, 'ZZTEST P Alpha');
  assert.equal(page.provider, 'TMDB', 'the requested identity is kept');
  assert.equal(page.externalId, '993000001');
  assert.equal(page.dataSource, 'TVMAZE');
  assert.equal(page.overview, 'ZZTEST P Alpha (TVMaze)', 'HTML stripped');
  assert.ok(page.catalogId, 'saved to the catalog, so it can be tracked');
  assert.ok(calls.some((u) => u.includes('api.tvmaze.com')));

  const sources = await sourcesOf(page.catalogId);
  assert.deepEqual(sources, { TMDB: '993000001', TVMAZE: '7001' }, 'one title, two provider records');
  assert.equal((await metaOf(page.catalogId)).dataSource, 'TVMAZE');

  // a user can add it and track it: the library entry points at media_items.id
  const added = await api('post', '', { mediaId: page.catalogId, status: 'WATCHING' });
  assert.equal(added.status, 201);
  assert.equal(added.body.data.mediaId, page.catalogId);
  assert.equal(added.body.data.media.title, 'ZZTEST P Alpha');
});

test('details: when TMDB recovers, the SAME title row is upgraded to the full TMDB record and the library entry is untouched', async () => {
  maze.shows = [mazeShow(7002, 'ZZTEST P Beta')];
  rememberTitles([{ provider: 'TMDB', mediaType: 'TV', externalId: '993000002', title: 'ZZTEST P Beta', releaseYear: 2015 }]);
  tmdbDown = true;
  const degraded = await getMediaDetails({ provider: 'TMDB', mediaType: 'TV', externalId: '993000002' });
  const entry = (await api('post', '', { mediaId: degraded.catalogId, status: 'WATCHING', rating: 9 })).body.data;

  // ten minutes later the short-lived fallback copy is stale; TMDB answers again
  await admin.query(`UPDATE public.media_items SET metadata = jsonb_set(metadata, '{snapshot,savedAt}', to_jsonb($2::bigint)) WHERE id = $1`, [degraded.catalogId, Date.now() - 11 * 60_000]);
  cache.clear();
  tmdbDown = false;
  tmdbTv['993000002'] = tmdbShow(993000002, 'ZZTEST P Beta');
  const full = await getMediaDetails({ provider: 'TMDB', mediaType: 'TV', externalId: '993000002' });

  assert.equal(full.catalogId, degraded.catalogId, 'same internal id');
  assert.equal(full.dataSource, undefined);
  assert.equal(full.tagline, 'The TMDB tagline');
  assert.equal(full.posterUrl, 'https://image.tmdb.org/t/p/w342/tmdb.jpg');
  assert.equal((await metaOf(full.catalogId)).dataSource, 'TMDB');
  assert.equal((await sourcesOf(full.catalogId)).TVMAZE, '7002', 'the extra mapping is kept');

  const after = (await api('get', `/check/${full.catalogId}`)).body.data.entry;
  assert.equal(after.id, entry.id, 'the user\'s library entry is the same row');
  assert.equal(after.rating, 9);
  assert.equal(after.status, 'WATCHING');
});

test('details: a stored copy beats a thinner fallback record when TMDB fails', async () => {
  tmdbTv['993000003'] = tmdbShow(993000003, 'ZZTEST P Gamma');
  const first = await getMediaDetails({ provider: 'TMDB', mediaType: 'TV', externalId: '993000003' });
  assert.equal(first.tagline, 'The TMDB tagline');

  await admin.query(`UPDATE public.media_items SET metadata = jsonb_set(metadata, '{snapshot,savedAt}', to_jsonb($2::bigint)) WHERE id = $1`, [first.catalogId, Date.now() - 7 * 3600_000]);
  cache.clear();
  tmdbDown = true;
  maze.shows = [mazeShow(7003, 'ZZTEST P Gamma')];
  calls = [];
  const served = await getMediaDetails({ provider: 'TMDB', mediaType: 'TV', externalId: '993000003' });
  assert.equal(served.tagline, 'The TMDB tagline', 'the richer stored record is served');
  assert.equal(served.catalogId, first.catalogId);
  assert.equal(count('api.tvmaze.com'), 0, 'TVMaze is not even asked');
  assert.equal(count('api.themoviedb.org'), 1, 'TMDB got one short attempt');
});

test('details: a fresh stored copy needs no network at all', async () => {
  tmdbTv['993000004'] = tmdbShow(993000004, 'ZZTEST P Delta');
  await getMediaDetails({ provider: 'TMDB', mediaType: 'TV', externalId: '993000004' });
  cache.clear();
  calls = [];
  tmdbDown = true;
  const page = await getMediaDetails({ provider: 'TMDB', mediaType: 'TV', externalId: '993000004' });
  assert.equal(page.title, 'ZZTEST P Delta');
  assert.equal(calls.length, 0);
});

test('details: TVMaze cannot match -> TheTVDB (when a key is set); the TVDB id is linked', async () => {
  process.env.TVDB_API_KEY = 'key';
  maze.shows = [mazeShow(7005, 'ZZTEST P Epsilon: A Different Show')]; // not an exact title match
  tvdbData.hits.series = [{ tvdb_id: '9005', name: 'ZZTEST P Epsilon', year: '2015' }];
  tvdbData.series['9005'] = { id: 9005, name: 'ZZTEST P Epsilon', overview: 'From TheTVDB.', image: 'https://artworks/e.jpg', firstAired: '2015-03-01', status: { name: 'Ended' }, genres: [{ name: 'Drama' }] };
  rememberTitles([{ provider: 'TMDB', mediaType: 'TV', externalId: '993000005', title: 'ZZTEST P Epsilon', releaseYear: 2015 }]);
  tmdbDown = true;

  const page = await getMediaDetails({ provider: 'TMDB', mediaType: 'TV', externalId: '993000005' });
  assert.equal(page.dataSource, 'TVDB');
  assert.equal(page.overview, 'From TheTVDB.');
  assert.equal(page.sourceRating, null);
  assert.deepEqual(await sourcesOf(page.catalogId), { TMDB: '993000005', TVDB: '9005' });
});

test('details: an exact external id (IMDb) from a stored title is used before any title guess', async () => {
  const mediaId = await insertMedia('ZZTEST P Zeta', 'TV', '993000006', { externalIds: { imdb: 'tt777', tvdb: null } });
  maze.byImdb['tt777'] = mazeShow(7006, 'ZZTEST P Zeta (renamed in TVMaze)');
  maze.shows = [maze.byImdb['tt777'], mazeShow(7099, 'ZZTEST P Zeta')]; // a title search would find a different record
  tmdbDown = true;
  const page = await getMediaDetails({ provider: 'TMDB', mediaType: 'TV', externalId: '993000006' });
  assert.equal(page.dataSource, 'TVMAZE');
  assert.equal(page.title, 'ZZTEST P Zeta (renamed in TVMaze)');
  assert.equal(page.catalogId, mediaId, 'an existing row is reused and not overwritten');
  assert.equal(count('/search/shows'), 0, 'no title search was needed');
  assert.equal((await admin.query('SELECT title FROM public.media_items WHERE id = $1', [mediaId])).rows[0].title, 'ZZTEST P Zeta', 'the stored row keeps its own data');
  assert.equal((await sourcesOf(mediaId)).TVMAZE, '7006');
});

test('details: nobody can supply it -> the ORIGINAL TMDB error, and nothing is stored', async () => {
  rememberTitles([{ provider: 'TMDB', mediaType: 'TV', externalId: '993000007', title: 'ZZTEST P Eta', releaseYear: 2015 }]);
  tmdbDown = true;
  mazeDown = true;
  await assert.rejects(getMediaDetails({ provider: 'TMDB', mediaType: 'TV', externalId: '993000007' }), (e) => e.provider === 'TMDB' && ['NETWORK', 'TIMEOUT'].includes(e.kind));
  assert.equal((await admin.query(`SELECT COUNT(*)::int AS n FROM public.media_sources WHERE external_id = '993000007'`)).rows[0].n, 0);
});

test('details: a title that cannot be identified (never seen, TMDB down) is a plain error, not a wrong guess', async () => {
  tmdbDown = true;
  maze.shows = [mazeShow(7008, 'Anything')];
  await assert.rejects(getMediaDetails({ provider: 'TMDB', mediaType: 'TV', externalId: '993000008' }), (e) => e.provider === 'TMDB');
  assert.equal(count('api.tvmaze.com'), 0);
});

test('details: a real "not found" from TMDB is never second-guessed by a fallback', async () => {
  rememberTitles([{ provider: 'TMDB', mediaType: 'TV', externalId: '993000009', title: 'ZZTEST P Theta', releaseYear: 2015 }]);
  maze.shows = [mazeShow(7009, 'ZZTEST P Theta')];
  tmdbStatus['993000009'] = 404;
  await assert.rejects(getMediaDetails({ provider: 'TMDB', mediaType: 'TV', externalId: '993000009' }), (e) => e.kind === 'NOT_FOUND');
  assert.equal(count('api.tvmaze.com'), 0);
});

test('details: movies fall back to TheTVDB only (TVMaze has no movies); without a key the error stands', async () => {
  rememberTitles([{ provider: 'TMDB', mediaType: 'MOVIE', externalId: '993100001', title: 'ZZTEST P Film', releaseYear: 2010 }]);
  tmdbDown = true;
  maze.shows = [mazeShow(7010, 'ZZTEST P Film')];

  await assert.rejects(getMediaDetails({ provider: 'TMDB', mediaType: 'MOVIE', externalId: '993100001' }), (e) => e.provider === 'TMDB');
  assert.equal(count('api.tvmaze.com'), 0, 'TVMaze is never asked about movies');

  process.env.TVDB_API_KEY = 'key';
  cache.clear();
  tvdbData.hits.movie = [{ tvdb_id: '603', name: 'ZZTEST P Film', year: '2010' }];
  tvdbData.movies['603'] = { id: 603, name: 'ZZTEST P Film', year: '2010', runtime: 120, image: 'https://artworks/f.jpg', genres: [{ name: 'Action' }] };
  const page = await getMediaDetails({ provider: 'TMDB', mediaType: 'MOVIE', externalId: '993100001' });
  assert.equal(page.mediaType, 'MOVIE');
  assert.equal(page.dataSource, 'TVDB');
  assert.equal(page.runtimeMinutes, 120);
  assert.deepEqual(await sourcesOf(page.catalogId), { TMDB: '993100001', TVDB: '603' });
});

// ------------------------------------------------------------------ episodes ---

test('episodes: TMDB down on a first sync -> TVMaze fills the seasons; the episodes are linked to the title and marked as fallback data', async () => {
  const mediaId = await insertMedia('ZZTEST P Iota', 'TV', '993200001');
  maze.shows = [mazeShow(7101, 'ZZTEST P Iota')];
  maze.seasons['7101'] = [{ number: 1, name: '' }, { number: 2, name: '' }];
  maze.episodes['7101'] = [...mazeEpisodes(1, ['Pilot', 'Second', 'Third']), ...mazeEpisodes(2, ['Return'])];
  tmdbDown = true;

  const result = await syncSeasonsAndEpisodes(mediaId);
  assert.deepEqual(result, { seasons: 2, episodes: 4 });
  const { seasons } = await getSeasonsForMedia(mediaId);
  assert.deepEqual(seasons.map((s) => [s.seasonNumber, s.episodes.length]), [[1, 3], [2, 1]]);
  assert.equal(seasons[0].episodes[0].title, 'Pilot');
  assert.equal(seasons[0].episodes[0].runtimeMinutes, 45);

  assert.equal((await sourcesOf(mediaId)).TVMAZE, '7101');
  assert.equal((await metaOf(mediaId)).episodesSource, 'TVMAZE');
});

test('episodes: when TMDB is back the SAME episode rows are updated: watched progress survives the provider swap', async () => {
  const mediaId = await insertMedia('ZZTEST P Kappa', 'TV', '993200002');
  maze.shows = [mazeShow(7102, 'ZZTEST P Kappa')];
  maze.seasons['7102'] = [{ number: 1, name: '' }];
  maze.episodes['7102'] = mazeEpisodes(1, ['Fallback One', 'Fallback Two', 'Fallback Three']);
  tmdbDown = true;
  await syncSeasonsAndEpisodes(mediaId);
  const before = (
    await admin.query(
      `SELECT e.id, e.title FROM public.episodes e JOIN public.seasons s ON s.id = e.season_id WHERE s.media_id = $1 ORDER BY e.episode_number`,
      [mediaId]
    )
  ).rows;
  assert.deepEqual(before.map((e) => e.title), ['Fallback One', 'Fallback Two', 'Fallback Three']);

  const entry = (await api('post', '', { mediaId, status: 'PLAN_TO_WATCH' })).body.data;
  const watched = await api('post', `/${entry.id}/episodes/${before[0].id}/watched`);
  assert.equal(watched.status, 200);
  assert.equal(watched.body.data.watchedEpisodesCount, 1);

  // TMDB recovers; opening the tracker notices the episodes came from a fallback and re-checks TMDB
  tmdbDown = false;
  tmdbTv['993200002'] = tmdbShow(993200002, 'ZZTEST P Kappa');
  tmdbSeasons['993200002:1'] = tmdbSeason(1, ['TMDB One', 'TMDB Two', 'TMDB Three']);
  const refreshed = (await getSeasonsForMedia(mediaId)).seasons[0].episodes;

  assert.deepEqual(refreshed.map((e) => e.id), before.map((e) => e.id), 'identical episode ids');
  assert.deepEqual(refreshed.map((e) => e.title), ['TMDB One', 'TMDB Two', 'TMDB Three'], 'TMDB data took over');
  assert.equal((await metaOf(mediaId)).episodesSource, 'TMDB');
  const check = (await api('get', `/check/${mediaId}`)).body.data;
  assert.equal(check.entry.watchedEpisodesCount, 1, 'progress intact');
  assert.deepEqual(check.watchedEpisodeIds, [before[0].id]);
});

test('episodes: a fallback only fills what is missing: stored seasons and episodes are never rewritten or extended', async () => {
  const mediaId = await insertMedia('ZZTEST P Lambda', 'TV', '993200003', { episodesSource: 'TMDB' });
  const s1 = (await admin.query(`INSERT INTO public.seasons (media_id, season_number, name, episode_count) VALUES ($1, 1, 'Season 1', 2) RETURNING id`, [mediaId])).rows[0].id;
  for (const n of [1, 2]) await admin.query(`INSERT INTO public.episodes (season_id, episode_number, title) VALUES ($1, $2, $3)`, [s1, n, `TMDB Ep ${n}`]);
  const entry = (await api('post', '', { mediaId, status: 'WATCHING' })).body.data;
  const e1 = (await admin.query('SELECT id FROM public.episodes WHERE season_id = $1 AND episode_number = 1', [s1])).rows[0].id;
  await api('post', `/${entry.id}/episodes/${e1}/watched`);

  // TVMaze disagrees about season 1 (different titles, an extra episode) and also knows a season 2
  maze.shows = [mazeShow(7103, 'ZZTEST P Lambda')];
  maze.seasons['7103'] = [{ number: 1 }, { number: 2 }];
  maze.episodes['7103'] = [...mazeEpisodes(1, ['Maze 1', 'Maze 2', 'Maze 3 (extra)']), ...mazeEpisodes(2, ['Maze S2E1', 'Maze S2E2'])];
  tmdbDown = true;
  await syncSeasonsAndEpisodes(mediaId);

  const { seasons } = await getSeasonsForMedia(mediaId);
  assert.deepEqual(seasons.map((s) => [s.seasonNumber, s.episodes.length]), [[1, 2], [2, 2]], 'season 1 untouched (no extra episode), season 2 added');
  assert.deepEqual(seasons[0].episodes.map((e) => e.title), ['TMDB Ep 1', 'TMDB Ep 2']);
  assert.equal(seasons[0].episodes[0].id, e1);
  assert.equal((await api('get', `/check/${mediaId}`)).body.data.entry.watchedEpisodesCount, 1);
});

test('episodes: TMDB down and TVMaze cannot help -> TheTVDB supplies the episodes', async () => {
  process.env.TVDB_API_KEY = 'key';
  const mediaId = await insertMedia('ZZTEST P Mu', 'TV', '993200004', { externalIds: { imdb: null, tvdb: '9100' } });
  tvdbData.episodes['9100'] = [
    { seasonNumber: 1, number: 1, name: 'Pilot', aired: '2015-01-01', runtime: 50 },
    { seasonNumber: 1, number: 2, name: 'Two', aired: '2015-01-08' },
    { seasonNumber: 0, number: 1, name: 'Extra' }
  ];
  tmdbDown = true;
  mazeDown = true;
  assert.deepEqual(await syncSeasonsAndEpisodes(mediaId), { seasons: 2, episodes: 3 });
  assert.equal((await sourcesOf(mediaId)).TVDB, '9100');
  assert.equal((await metaOf(mediaId)).episodesSource, 'TVDB');
});

test('episodes: nobody can help -> the original error; nothing is written', async () => {
  const mediaId = await insertMedia('ZZTEST P Nu', 'TV', '993200005');
  tmdbDown = true;
  mazeDown = true;
  await assert.rejects(syncSeasonsAndEpisodes(mediaId), (e) => e.provider === 'TMDB');
  assert.equal((await admin.query('SELECT COUNT(*)::int AS n FROM public.seasons WHERE media_id = $1', [mediaId])).rows[0].n, 0);
});

test('episodes: a failing TMDB stops quickly instead of queueing a slow request per season', async () => {
  const mediaId = await insertMedia('ZZTEST P Xi', 'TV', '993200006');
  tmdbTv['993200006'] = tmdbShow(993200006, 'ZZTEST P Xi', { seasons: Array.from({ length: 8 }, (_, i) => ({ season_number: i + 1, episode_count: 2 })) });
  // the show itself loads, but every season request fails with a server error
  const base = globalThis.fetch;
  globalThis.fetch = async (url, init) => (/\/tv\/\d+\/season\//.test(String(url)) ? (calls.push(String(url)), json({}, 503)) : base(url, init));
  maze.shows = [mazeShow(7106, 'ZZTEST P Xi')];
  maze.seasons['7106'] = [{ number: 1 }];
  maze.episodes['7106'] = mazeEpisodes(1, ['A', 'B']);
  await syncSeasonsAndEpisodes(mediaId);
  assert.ok(count('/season/') <= 4, `at most one batch of season requests before handing over, saw ${count('/season/')}`);
  assert.equal((await metaOf(mediaId)).episodesSource, 'TVMAZE');
});

// ------------------------------------------------------- ended-show throttling ---

test('ended TV shows are re-checked every 30 days, not every 12 hours', async () => {
  assert.equal(ENDED_TV_RECHECK_MS, 30 * 24 * 60 * 60 * 1000);
  const mediaId = await insertMedia('ZZTEST P Omicron', 'TV', '993300001', { status: 'Ended', episodesSource: 'TMDB' });
  const s = (await admin.query(`INSERT INTO public.seasons (media_id, season_number, name, episode_count) VALUES ($1, 1, 'Season 1', 1) RETURNING id`, [mediaId])).rows[0].id;
  await admin.query(`INSERT INTO public.episodes (season_id, episode_number, title) VALUES ($1, 1, 'One')`, [s]);
  tmdbTv['993300001'] = tmdbShow(993300001, 'ZZTEST P Omicron', { seasons: [{ season_number: 1, episode_count: 1 }] });
  tmdbSeasons['993300001:1'] = tmdbSeason(1, ['One']);

  const backdate = async (days) => {
    await admin.query('ALTER TABLE public.seasons DISABLE TRIGGER set_seasons_updated_at');
    try {
      await admin.query(`UPDATE public.seasons SET updated_at = NOW() - make_interval(days => $2) WHERE media_id = $1`, [mediaId, days]);
    } finally {
      await admin.query('ALTER TABLE public.seasons ENABLE TRIGGER set_seasons_updated_at');
    }
  };

  await backdate(20); // older than the old 12 h rule, younger than 30 days
  calls = [];
  await getSeasonsForMedia(mediaId);
  assert.equal(calls.length, 0, 'no provider call for a show that ended recently checked');

  await backdate(31);
  calls = [];
  await getSeasonsForMedia(mediaId);
  assert.ok(count('api.themoviedb.org') >= 1, 'after 30 days it is checked again');
});
