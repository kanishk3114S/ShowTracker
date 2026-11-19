/**
 * Release Radar: GET /api/library/upcoming and the airing data behind it.
 *
 * REAL: routes, service, SQL, transactions and the database as the restricted
 * `showtracker_app` role (RLS on), metadata persistence, the normalizers.
 * SUBSTITUTED: AniList / TMDB HTTP (globalThis.fetch) and authentication (`x-test-user`).
 *
 * Disposable users and "ZZTEST R" titles are created via the admin connection and removed at the end.
 */
import dotenv from 'dotenv';
dotenv.config();
process.env.NODE_ENV = 'test';

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import request from 'supertest';

const { migrationPool, closePool } = await import('../src/config/database.js');
const { createLibraryRouter } = await import('../src/modules/library/library.routes.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const { getUpcoming, resetRadarState, buildRadarItem, MAX_TMDB_REFRESHES } = await import('../src/modules/library/radar.service.js');
const { normalizeAniListMedia, normalizeTmdbMedia } = await import('../src/services/mediaNormalizer.js');
const { upsertMediaFromDetails } = await import('../src/services/mediaPersistence.service.js');
const { default: realApp } = await import('../src/app.js');

const admin = migrationPool;
const userA = crypto.randomUUID();
const userB = crypto.randomUUID();
const realFetch = globalThis.fetch;
const ids = {};

const fakeAuth = (req, res, next) => {
  req.user = { id: req.headers['x-test-user'] };
  next();
};
const app = express();
app.use(express.json());
app.use('/api/library', createLibraryRouter({ auth: fakeAuth }));
app.use(errorHandler);
const get = (path, user) => request(app).get(`/api/library${path}`).set('x-test-user', user);

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// fixed "now" so the expectations never depend on the clock
const NOW = Date.UTC(2026, 10, 18, 12, 0, 0); // 2026-11-18 12:00:00 UTC
const sec = (ms) => Math.floor(ms / 1000);
const HOUR = 3600_000;
const DAY = 24 * HOUR;

let anilistRequests; // each entry: array of ids requested in one batched call
let tmdbRequests; // tv ids requested
let anilistAiring; // id -> { status, nextAiringEpisode }
let tmdbShows; // id -> tv details body
let failAnilist = false;
let failTmdb = new Set();

function installFetch() {
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('graphql.anilist.co')) {
      const body = JSON.parse(init.body);
      anilistRequests.push(body.variables.ids);
      if (failAnilist) return jsonResponse({}, 500);
      const media = body.variables.ids.filter((id) => anilistAiring.has(String(id))).map((id) => ({ id, episodes: null, ...anilistAiring.get(String(id)) }));
      return jsonResponse({ data: { Page: { media } } });
    }
    const m = u.match(/\/tv\/(\d+)/);
    if (m) {
      tmdbRequests.push(m[1]);
      if (failTmdb.has(m[1])) return jsonResponse({}, 500);
      return jsonResponse(tmdbShows.get(m[1]) ?? { status: 'Ended', next_episode_to_air: null });
    }
    throw new Error(`unmocked fetch ${u}`);
  };
}

async function insertMedia(title, mediaType, provider, externalId, metadata) {
  const { rows } = await admin.query(
    `INSERT INTO public.media_items (media_type, title, metadata) VALUES ($1, $2, $3::jsonb) RETURNING id`,
    [mediaType, title, JSON.stringify(metadata)]
  );
  await admin.query(
    `INSERT INTO public.media_sources (media_id, provider, provider_media_type, external_id) VALUES ($1, $2, $3, $4)`,
    [rows[0].id, provider, mediaType, externalId]
  );
  return rows[0].id;
}
const addToLibrary = async (user, mediaId, status) => {
  const { rows } = await admin.query(
    `INSERT INTO public.user_library (user_id, media_id, status) VALUES ($1, $2, $3) RETURNING id`,
    [user, mediaId, status]
  );
  return rows[0].id;
};

async function cleanup() {
  await admin.query(`DELETE FROM auth.users WHERE id = ANY($1::uuid[]) OR email LIKE 'zztest-rdr-%@example.invalid'`, [[userA, userB]]);
  await admin.query(`DELETE FROM public.media_items WHERE title LIKE 'ZZTEST R %'`);
}

before(async () => {
  await cleanup();
  for (const [id, label] of [[userA, 'a'], [userB, 'b']]) {
    await admin.query(`INSERT INTO auth.users (id, aud, role, email) VALUES ($1, 'authenticated', 'authenticated', $2)`, [
      id,
      `zztest-rdr-${label}-${id.slice(0, 8)}@example.invalid`
    ]);
  }
  process.env.TMDB_API_READ_ACCESS_TOKEN ||= 'test-token';

  // anime that airs in 2 days 14h (stored data is fresh: no refresh needed)
  ids.animeSoon = await insertMedia('ZZTEST R Anime Soon', 'ANIME', 'ANILIST', '992000001', {
    status: 'RELEASING',
    nextAiring: sec(NOW + 2 * DAY + 14 * HOUR),
    nextAiringEpisode: 11
  });
  // anime that airs later today
  ids.animeToday = await insertMedia('ZZTEST R Anime Today', 'ANIME', 'ANILIST', '992000002', {
    status: 'RELEASING',
    nextAiring: sec(NOW + 3 * HOUR),
    nextAiringEpisode: 4
  });
  // anime whose stored airing time has PASSED: must be refreshed from AniList
  ids.animeStale = await insertMedia('ZZTEST R Anime Stale', 'ANIME', 'ANILIST', '992000003', {
    status: 'RELEASING',
    nextAiring: sec(NOW - 2 * DAY),
    nextAiringEpisode: 7
  });
  // finished anime: never on the radar, never refreshed
  ids.animeDone = await insertMedia('ZZTEST R Anime Finished', 'ANIME', 'ANILIST', '992000004', {
    status: 'FINISHED',
    nextAiring: null
  });
  // TV show with a stored next air date (day precision)
  ids.tvSoon = await insertMedia('ZZTEST R Show Soon', 'TV', 'TMDB', '992000005', {
    status: 'Returning Series',
    nextAirDate: '2026-11-20',
    nextAirEpisode: 5,
    nextAirSeason: 2
  });
  // TV show whose air date passed: refreshed from TMDB
  ids.tvStale = await insertMedia('ZZTEST R Show Stale', 'TV', 'TMDB', '992000006', {
    status: 'Returning Series',
    nextAirDate: '2026-11-01',
    nextAirEpisode: 3,
    nextAirSeason: 1
  });
  ids.movie = await insertMedia('ZZTEST R Movie', 'MOVIE', 'TMDB', '992000007', { status: 'Released' });
  ids.animeNotLibrary = await insertMedia('ZZTEST R Not In Library', 'ANIME', 'ANILIST', '992000008', {
    status: 'RELEASING',
    nextAiring: sec(NOW + DAY),
    nextAiringEpisode: 2
  });

  ids.eSoon = await addToLibrary(userA, ids.animeSoon, 'WATCHING');
  ids.eToday = await addToLibrary(userA, ids.animeToday, 'PLAN_TO_WATCH');
  ids.eStale = await addToLibrary(userA, ids.animeStale, 'WATCHING');
  ids.eDone = await addToLibrary(userA, ids.animeDone, 'WATCHING');
  ids.eTvSoon = await addToLibrary(userA, ids.tvSoon, 'WATCHING');
  ids.eTvStale = await addToLibrary(userA, ids.tvStale, 'WATCHING');
  ids.eMovie = await addToLibrary(userA, ids.movie, 'WATCHING');
  // user B tracks one of the same shows
  ids.bSoon = await addToLibrary(userB, ids.animeSoon, 'WATCHING');
});

beforeEach(async () => {
  // refreshes persist, so put the two "stale" titles back into their stale state before every test
  await admin.query(`UPDATE public.media_items SET metadata = $2::jsonb WHERE id = $1`, [
    ids.animeStale,
    JSON.stringify({ status: 'RELEASING', nextAiring: sec(NOW - 2 * DAY), nextAiringEpisode: 7 })
  ]);
  await admin.query(`UPDATE public.media_items SET metadata = $2::jsonb WHERE id = $1`, [
    ids.tvStale,
    JSON.stringify({ status: 'Returning Series', nextAirDate: '2026-11-01', nextAirEpisode: 3, nextAirSeason: 1 })
  ]);
  resetRadarState();
  anilistRequests = [];
  tmdbRequests = [];
  failAnilist = false;
  failTmdb = new Set();
  anilistAiring = new Map([['992000003', { status: 'RELEASING', nextAiringEpisode: { episode: 8, airingAt: sec(NOW + 5 * DAY), timeUntilAiring: 5 * 86400 } }]]);
  tmdbShows = new Map([['992000006', { status: 'Returning Series', next_episode_to_air: { air_date: '2026-11-25', episode_number: 4, season_number: 1 } }]]);
  installFetch();
});

after(async () => {
  globalThis.fetch = realFetch;
  await cleanup();
  await closePool();
});

const byTitle = (items) => Object.fromEntries(items.map((i) => [i.title.replace('ZZTEST R ', ''), i]));

test('real app: /api/library/upcoming requires authentication', async () => {
  const res = await request(realApp).get('/api/library/upcoming');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'AUTH_REQUIRED');
});

test('upcoming: only WATCHING / PLAN_TO_WATCH anime and TV with a known next episode, soonest first', async () => {
  const { items, serverTime } = await getUpcoming(userA, { now: NOW });
  assert.equal(serverTime, new Date(NOW).toISOString());
  assert.deepEqual(items.map((i) => i.title.replace('ZZTEST R ', '')), [
    'Anime Today', // +3h
    'Show Soon', // 2026-11-20
    'Anime Soon', // +2d14h  (2026-11-21 02:00)
    'Anime Stale', // refreshed to +5d
    'Show Stale' // refreshed to 2026-11-25
  ]);
  const t = byTitle(items);
  assert.equal(t['Anime Finished'], undefined, 'finished anime is not on the radar');
  assert.equal(t['Movie'], undefined, 'movies are never on the radar');
  assert.equal(t['Not In Library'], undefined, 'only titles in YOUR library');
});

test('upcoming: item fields (episode, exact AniList time, TMDB day precision, countdown seconds)', async () => {
  const t = byTitle((await getUpcoming(userA, { now: NOW })).items);

  const soon = t['Anime Soon'];
  assert.equal(soon.mediaType, 'ANIME');
  assert.equal(soon.nextEpisode, 11);
  assert.equal(soon.precision, 'exact');
  assert.equal(soon.airingAt, new Date(NOW + 2 * DAY + 14 * HOUR).toISOString());
  assert.equal(soon.timeUntilAiring, 2 * 86400 + 14 * 3600);
  assert.equal(soon.provider, 'ANILIST');
  assert.equal(soon.externalId, '992000001');
  assert.equal(soon.entryId, ids.eSoon);
  assert.equal(soon.libraryStatus, 'WATCHING');
  assert.equal(soon.airDate, null);

  const show = t['Show Soon'];
  assert.equal(show.mediaType, 'TV');
  assert.equal(show.precision, 'day');
  assert.equal(show.airDate, '2026-11-20');
  assert.equal(show.nextEpisode, 5);
  assert.equal(show.seasonNumber, 2);
  assert.equal(show.airingAt, '2026-11-20T00:00:00.000Z');

  assert.equal(t['Anime Today'].libraryStatus, 'PLAN_TO_WATCH');
  assert.equal(t['Anime Today'].timeUntilAiring, 3 * 3600);
});

test('stale airing data is refreshed: ONE batched AniList request for all stale anime, TMDB per show; results are saved', async () => {
  await getUpcoming(userA, { now: NOW });
  assert.equal(anilistRequests.length, 1, 'one batched AniList call');
  assert.deepEqual(anilistRequests[0].map(String), ['992000003'], 'only the anime whose stored time passed');
  assert.deepEqual(tmdbRequests, ['992000006'], 'only the show whose air date passed');

  const saved = await admin.query(`SELECT metadata FROM public.media_items WHERE id = ANY($1::uuid[])`, [[ids.animeStale, ids.tvStale]]);
  const metas = saved.rows.map((r) => r.metadata);
  assert.ok(metas.some((m) => m.nextAiring === sec(NOW + 5 * DAY) && m.nextAiringEpisode === 8), 'anime airing time persisted');
  assert.ok(metas.some((m) => m.nextAirDate === '2026-11-25' && m.nextAirEpisode === 4), 'TV air date persisted');
});

test('a refreshed title is not asked again within the cool-down (even if nothing changed)', async () => {
  await getUpcoming(userA, { now: NOW });
  anilistRequests = [];
  tmdbRequests = [];
  await getUpcoming(userA, { now: NOW });
  assert.equal(anilistRequests.length, 0);
  assert.equal(tmdbRequests.length, 0);
});

test('finished titles are never refreshed', async () => {
  await getUpcoming(userA, { now: NOW });
  assert.ok(!anilistRequests.flat().map(String).includes('992000004'));
});

test('provider failures never break the radar: stored data is served instead', async () => {
  failAnilist = true;
  failTmdb = new Set(['992000006']);
  const { items } = await getUpcoming(userA, { now: NOW });
  const titles = items.map((i) => i.title.replace('ZZTEST R ', ''));
  assert.deepEqual(titles, ['Anime Today', 'Show Soon', 'Anime Soon'], 'fresh stored items remain; unrefreshable stale ones are dropped');
});

test('an anime that just aired stays listed for 3 hours, then disappears', async () => {
  const row = { entry_id: 'e', media_id: 'm', title: 'T', media_type: 'ANIME', library_status: 'WATCHING', provider: 'ANILIST', external_id: '1' };
  const meta = (agoMs) => ({ status: 'RELEASING', nextAiring: sec(NOW - agoMs), nextAiringEpisode: 3 });
  const recent = buildRadarItem(row, meta(30 * 60_000), NOW);
  assert.ok(recent && recent.timeUntilAiring < 0, 'aired 30 minutes ago: still shown (negative countdown)');
  assert.equal(buildRadarItem(row, meta(4 * HOUR), NOW), null);
  assert.equal(buildRadarItem(row, { status: 'RELEASING' }, NOW), null, 'no airing data');
});

test('TV air dates: the whole air day (and time zones) are respected, older ones dropped', async () => {
  const row = { entry_id: 'e', media_id: 'm', title: 'T', media_type: 'TV', library_status: 'WATCHING', provider: 'TMDB', external_id: '1' };
  const meta = (airDate) => ({ status: 'Returning Series', nextAirDate: airDate, nextAirEpisode: 2, nextAirSeason: 1 });
  assert.ok(buildRadarItem(row, meta('2026-11-18'), NOW), 'airs today');
  assert.ok(buildRadarItem(row, meta('2026-11-17'), NOW), 'yesterday in UTC can still be today elsewhere');
  assert.equal(buildRadarItem(row, meta('2026-11-15'), NOW), null);
  assert.equal(buildRadarItem(row, meta('not-a-date'), NOW), null);
});

test('TMDB refreshes are capped per request', async () => {
  const extra = [];
  for (let i = 0; i < MAX_TMDB_REFRESHES + 3; i++) {
    const m = await insertMedia(`ZZTEST R Many ${i}`, 'TV', 'TMDB', `99201${String(i).padStart(2, '0')}`, {
      status: 'Returning Series',
      nextAirDate: '2026-10-01'
    });
    await addToLibrary(userB, m, 'WATCHING');
    extra.push(m);
  }
  await getUpcoming(userB, { now: NOW });
  assert.ok(tmdbRequests.length <= MAX_TMDB_REFRESHES, `at most ${MAX_TMDB_REFRESHES} TMDB lookups, got ${tmdbRequests.length}`);
  assert.ok(tmdbRequests.length >= 1);
  await admin.query(`DELETE FROM public.user_library WHERE user_id = $1 AND media_id = ANY($2::uuid[])`, [userB, extra]);
});

test('isolation: each user sees only their own library on the radar', async () => {
  const a = await getUpcoming(userA, { now: NOW });
  const b = await getUpcoming(userB, { now: NOW });
  assert.ok(a.items.length >= 4);
  assert.ok(b.items.every((i) => i.mediaId === ids.animeSoon), 'B tracks only "Anime Soon"');
  const stranger = await getUpcoming(crypto.randomUUID(), { now: NOW });
  assert.deepEqual(stranger.items, []);
});

test('route: GET /api/library/upcoming returns { serverTime, items } and is not cacheable', async () => {
  const res = await get('/upcoming', userA);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(Array.isArray(res.body.data.items));
  assert.ok(Date.parse(res.body.data.serverTime));
  assert.match(res.headers['cache-control'], /no-store/);
});

// ----------------------------------------------------- provider data capture ---

test('normalizers expose the next episode (AniList airingAt / TMDB air date)', () => {
  const anime = normalizeAniListMedia({
    id: 5,
    title: { english: 'X' },
    nextAiringEpisode: { episode: 9, airingAt: 1900000000, timeUntilAiring: 1234 }
  });
  assert.deepEqual(anime.nextAiring, { episode: 9, airingAt: 1900000000 });
  assert.equal(normalizeAniListMedia({ id: 5, title: { english: 'X' }, nextAiringEpisode: null }).nextAiring, null);
  assert.equal('nextAiring' in normalizeAniListMedia({ id: 5, title: { english: 'X' } }), false, 'list items carry no airing key');

  const tv = normalizeTmdbMedia(
    { id: 7, name: 'Show', next_episode_to_air: { air_date: '2026-12-01', episode_number: 6, season_number: 2 } },
    'TV'
  );
  assert.deepEqual(tv.nextEpisode, { airDate: '2026-12-01', episode: 6, season: 2 });
  assert.equal(normalizeTmdbMedia({ id: 7, name: 'Show', next_episode_to_air: null }, 'TV').nextEpisode, null);
  assert.equal('nextEpisode' in normalizeTmdbMedia({ id: 8, title: 'Movie' }, 'MOVIE'), false);
});

test('opening a title page stores nextAiring / nextAirDate in media_items.metadata', async () => {
  const anime = normalizeAniListMedia({
    id: 992100001,
    title: { english: 'ZZTEST R Persisted Anime' },
    status: 'RELEASING',
    nextAiringEpisode: { episode: 3, airingAt: 1900000000, timeUntilAiring: 10 }
  });
  const animeId = await upsertMediaFromDetails(anime);
  const tv = normalizeTmdbMedia(
    { id: 992100002, name: 'ZZTEST R Persisted Show', status: 'Returning Series', next_episode_to_air: { air_date: '2026-12-02', episode_number: 2, season_number: 1 } },
    'TV'
  );
  const tvId = await upsertMediaFromDetails(tv);
  const rows = await admin.query(
    `SELECT id, metadata->>'nextAiring' AS next_airing, metadata->>'nextAiringEpisode' AS ep,
            metadata->>'nextAirDate' AS next_air_date, metadata->>'nextAirEpisode' AS tv_ep
       FROM public.media_items WHERE id = ANY($1::uuid[])`,
    [[animeId, tvId]]
  );
  const a = rows.rows.find((r) => r.id === animeId);
  const t = rows.rows.find((r) => r.id === tvId);
  assert.equal(a.next_airing, '1900000000');
  assert.equal(a.ep, '3');
  assert.equal(t.next_air_date, '2026-12-02');
  assert.equal(t.tv_ep, '2');
});
