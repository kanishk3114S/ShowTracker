/**
 * Anime franchise linking: AniList sequels become Season 1, 2, 3 ... of ONE series.
 *
 * REAL: franchise traversal, season/episode persistence, the library API (progress
 * rollup, completion), SQL and the database as the restricted `showtracker_app` role.
 * SUBSTITUTED: AniList HTTP (globalThis.fetch serves a small in-memory relation graph)
 * and authentication (`x-test-user` through the router's injectable `auth` hook).
 *
 * Disposable users and "ZZTEST F" titles are created via the admin connection and removed at the end.
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
const { syncSeasonsAndEpisodes, getSeasonsForMedia } = await import('../src/services/episodeCatalog.service.js');
const { resolveFranchise, planAnimeSeasons, MAX_FRANCHISE_SEASONS, resetFranchiseCache } = await import(
  '../src/services/franchise.service.js'
);
const anilistProvider = await import('../src/providers/anilist.provider.js');
const { default: realApp } = await import('../src/app.js');
const { getMediaDetails } = await import('../src/services/mediaCatalog.service.js');

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

// ------------------------------------------------ in-memory AniList graph ---

const graph = new Map(); // id -> node
let calls = []; // AniList entry ids requested, in order
let failIds = new Set();

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function addNode(id, { title, format = 'TV', episodes = 12, status = 'FINISHED', year = 2020, next = null, duration = 24 } = {}) {
  graph.set(String(id), {
    id: Number(id),
    format,
    status,
    episodes,
    duration,
    title: { romaji: title ?? `ZZTEST F Show ${id}`, english: title ?? null, native: null },
    coverImage: { extraLarge: `https://img.example/${id}.jpg`, large: `https://img.example/${id}-s.jpg` },
    startDate: { year, month: 1, day: 1 },
    nextAiringEpisode: next,
    relations: { edges: [] }
  });
}
const edgeNode = (n) => ({
  id: n.id,
  type: 'ANIME',
  format: n.format,
  status: n.status,
  episodes: n.episodes,
  title: n.title,
  startDate: n.startDate
});
/** `a` has `b` as SEQUEL and `b` has `a` as PREQUEL. */
function link(a, b) {
  const A = graph.get(String(a));
  const B = graph.get(String(b));
  A.relations.edges.push({ relationType: 'SEQUEL', node: edgeNode(B) });
  B.relations.edges.push({ relationType: 'PREQUEL', node: edgeNode(A) });
}
const sideEdge = (from, relationType, node) => graph.get(String(from)).relations.edges.push({ relationType, node });

function installFetch() {
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    const id = String(body.variables?.id);
    calls.push(id);
    if (failIds.has(id)) return jsonResponse({}, 500);
    const node = graph.get(id);
    if (!node) return jsonResponse({ errors: [{ status: 404, message: 'Not Found.' }], data: { Media: null } }, 404);
    return jsonResponse({ data: { Media: node } });
  };
}

async function insertAnime(title, externalId) {
  const { rows } = await admin.query(
    `INSERT INTO public.media_items (media_type, title, metadata) VALUES ('ANIME', $1, '{}'::jsonb) RETURNING id`,
    [title]
  );
  await admin.query(
    `INSERT INTO public.media_sources (media_id, provider, provider_media_type, external_id) VALUES ($1, 'ANILIST', 'ANIME', $2)`,
    [rows[0].id, String(externalId)]
  );
  return rows[0].id;
}

async function cleanup() {
  await admin.query(`DELETE FROM auth.users WHERE id = $1 OR email LIKE 'zztest-frn-%@example.invalid'`, [user]);
  await admin.query(`DELETE FROM public.media_items WHERE title LIKE 'ZZTEST F %'`);
}

before(async () => {
  await cleanup();
  await admin.query(`INSERT INTO auth.users (id, aud, role, email) VALUES ($1, 'authenticated', 'authenticated', $2)`, [
    user,
    `zztest-frn-${user.slice(0, 8)}@example.invalid`
  ]);
  installFetch();
});

beforeEach(() => {
  resetFranchiseCache();
  calls = [];
  failIds = new Set();
  installFetch();
});

after(async () => {
  globalThis.fetch = realFetch;
  await cleanup();
  await closePool();
});

// A four-season franchise like Attack on Titan: 25 + 12 + 12 + 16 = 65 episodes
const AOT = { s1: 991100001, s2: 991100002, s3: 991100003, s4: 991100004 };
/** Builds the 4-season graph at `base` (each test uses its own ids: media_sources must stay unique). */
function buildAot(base = 991100000) {
  const ids = { s1: base + 1, s2: base + 2, s3: base + 3, s4: base + 4 };
  addNode(ids.s1, { title: 'ZZTEST F Titan', episodes: 25, year: 2013 });
  addNode(ids.s2, { title: 'ZZTEST F Titan Season 2', episodes: 12, year: 2017 });
  addNode(ids.s3, { title: 'ZZTEST F Titan Season 3', episodes: 12, year: 2018 });
  addNode(ids.s4, { title: 'ZZTEST F Titan The Final Season', episodes: 16, year: 2020 });
  link(ids.s1, ids.s2);
  link(ids.s2, ids.s3);
  link(ids.s3, ids.s4);
  return ids;
}

// ------------------------------------------------------------------- tests ---

test('root sync: sequels become Season 1..4 of one series, with names, posters and AniList ids', async () => {
  buildAot();
  const root = await insertAnime('ZZTEST F Titan', AOT.s1);
  assert.deepEqual(await syncSeasonsAndEpisodes(root), { seasons: 4, episodes: 65 });

  const { seasons } = await getSeasonsForMedia(root);
  assert.deepEqual(seasons.map((s) => s.seasonNumber), [1, 2, 3, 4]);
  assert.deepEqual(seasons.map((s) => s.episodes.length), [25, 12, 12, 16]);
  assert.deepEqual(seasons.map((s) => s.name), [
    'ZZTEST F Titan',
    'ZZTEST F Titan Season 2',
    'ZZTEST F Titan Season 3',
    'ZZTEST F Titan The Final Season'
  ]);
  assert.deepEqual(seasons.map((s) => s.externalId), [String(AOT.s1), String(AOT.s2), String(AOT.s3), String(AOT.s4)]);
  assert.ok(seasons.every((s) => s.overview === null), 'the internal marker is never exposed as text');
  assert.equal(seasons[1].posterUrl, `https://img.example/${AOT.s2}.jpg`);
  assert.equal(seasons[3].airDate, '2020-01-01');
  assert.equal(seasons[3].episodes[15].title, 'Episode 16');

  // idempotent: syncing again adds nothing
  await syncSeasonsAndEpisodes(root);
  const counts = await admin.query(
    `SELECT (SELECT COUNT(*) FROM public.seasons WHERE media_id = $1)::int AS seasons,
            (SELECT COUNT(*) FROM public.episodes e JOIN public.seasons s ON s.id = e.season_id WHERE s.media_id = $1)::int AS episodes`,
    [root]
  );
  assert.deepEqual(counts.rows[0], { seasons: 4, episodes: 65 });
});

test('traversal is cheap: each AniList entry is requested once, then served from cache', async () => {
  buildAot();
  await planAnimeSeasons(AOT.s1);
  assert.deepEqual([...calls].sort(), [AOT.s1, AOT.s2, AOT.s3, AOT.s4].map(String).sort());
  const before = calls.length;
  await planAnimeSeasons(AOT.s1);
  await resolveFranchise(AOT.s3);
  assert.equal(calls.length, before, 'no extra provider calls for a repeated lookup');
});

test('a sequel opened on its own keeps just its own season; the franchise summary points to the root', async () => {
  buildAot();
  const s3Media = await insertAnime('ZZTEST F Titan Season 3 (standalone)', AOT.s3);
  assert.deepEqual(await syncSeasonsAndEpisodes(s3Media), { seasons: 1, episodes: 12 });
  const { seasons } = await getSeasonsForMedia(s3Media);
  assert.equal(seasons.length, 1);
  assert.equal(seasons[0].seasonNumber, 1);
  assert.equal(seasons[0].externalId, String(AOT.s3));

  const res = await request(realApp).get(`/api/media/franchise/${AOT.s3}`);
  assert.equal(res.status, 200);
  const f = res.body.data;
  assert.equal(f.isFranchise, true);
  assert.equal(f.isRoot, false);
  assert.equal(f.seasonNumber, 3);
  assert.equal(f.totalSeasons, 4);
  assert.equal(f.totalEpisodes, 65);
  assert.deepEqual(f.root, { externalId: String(AOT.s1), title: 'ZZTEST F Titan' });
  assert.deepEqual(f.members.map((m) => m.seasonNumber), [1, 2, 3, 4]);

  const rootRes = await request(realApp).get(`/api/media/franchise/${AOT.s1}`);
  assert.equal(rootRes.body.data.isRoot, true);
  assert.equal(rootRes.body.data.seasonNumber, 1);
});

test('franchise route: a standalone anime is not a franchise; bad ids are rejected; unknown ids 404', async () => {
  addNode(991100050, { title: 'ZZTEST F Standalone', episodes: 13 });
  const alone = await request(realApp).get('/api/media/franchise/991100050');
  assert.equal(alone.status, 200);
  assert.equal(alone.body.data.isFranchise, false);
  assert.equal(alone.body.data.root, null);
  assert.deepEqual(alone.body.data.members, []);

  assert.equal((await request(realApp).get('/api/media/franchise/abc')).status, 400);
  assert.equal((await request(realApp).get('/api/media/franchise/0')).status, 400);
  assert.equal((await request(realApp).get('/api/media/franchise/991199999')).status, 404);
});

test('only TV, TV_SHORT and ONA sequels link; movies, OVAs, specials and side stories are skipped', async () => {
  addNode(991100060, { title: 'ZZTEST F Base', episodes: 12 });
  addNode(991100061, { title: 'ZZTEST F Base Season 2', episodes: 12, year: 2021 });
  addNode(991100062, { title: 'ZZTEST F Base The Movie', format: 'MOVIE', episodes: 1, year: 2020 });
  addNode(991100063, { title: 'ZZTEST F Base OVA', format: 'OVA', episodes: 3, year: 2020 });
  addNode(991100064, { title: 'ZZTEST F Base Spin-off', episodes: 12, year: 2020 });
  addNode(991100065, { title: 'ZZTEST F Base ONA Sequel', format: 'ONA', episodes: 6, year: 2022 });
  link(991100060, 991100061);
  link(991100061, 991100065); // an ONA continuation is a valid season
  sideEdge(991100060, 'SEQUEL', edgeNode(graph.get('991100062'))); // movie sequel: ignored
  sideEdge(991100060, 'SEQUEL', edgeNode(graph.get('991100063'))); // OVA sequel: ignored
  sideEdge(991100060, 'SPIN_OFF', edgeNode(graph.get('991100064'))); // spin-off TV: not a sequel
  sideEdge(991100060, 'SIDE_STORY', edgeNode(graph.get('991100064')));

  const { members } = await resolveFranchise(991100060);
  assert.deepEqual(members.map((m) => m.externalId), ['991100060', '991100061', '991100065']);
  // the ignored entries were never even requested
  assert.ok(!calls.includes('991100062') && !calls.includes('991100063') && !calls.includes('991100064'));
});

test('a prequel that is only an OVA/movie does not make an entry a sequel (it stays the root)', async () => {
  addNode(991100070, { title: 'ZZTEST F Root With OVA Prequel', episodes: 24 });
  addNode(991100071, { title: 'ZZTEST F Prequel OVA', format: 'OVA', episodes: 2, year: 2010 });
  sideEdge(991100070, 'PREQUEL', edgeNode(graph.get('991100071')));
  const plan = await planAnimeSeasons(991100070);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].episodeCount, 24);
});

test('safety: cycles terminate and chains are capped at 12 seasons', async () => {
  // A <-> B (each calls the other its sequel)
  addNode(991100080, { title: 'ZZTEST F Loop A', episodes: 5, year: 2010 });
  addNode(991100081, { title: 'ZZTEST F Loop B', episodes: 5, year: 2011 });
  link(991100080, 991100081);
  sideEdge(991100081, 'SEQUEL', edgeNode(graph.get('991100080')));
  const loop = await resolveFranchise(991100080);
  assert.equal(loop.members.length, 2);

  // 15 entries in a row
  for (let i = 0; i < 15; i++) addNode(991100100 + i, { title: `ZZTEST F Long ${i}`, episodes: 2, year: 2000 + i });
  for (let i = 0; i < 14; i++) link(991100100 + i, 991100101 + i);
  const long = await resolveFranchise(991100100);
  assert.equal(long.members.length, MAX_FRANCHISE_SEASONS);
  assert.equal(MAX_FRANCHISE_SEASONS, 12);
});

test('entries without a known episode count yet (unreleased) are left out, not invented', async () => {
  addNode(991100090, { title: 'ZZTEST F Soon S1', episodes: 12 });
  addNode(991100091, { title: 'ZZTEST F Soon S2', episodes: 12, year: 2021 });
  addNode(991100092, { title: 'ZZTEST F Soon S3', episodes: null, status: 'NOT_YET_RELEASED', year: 2027 });
  link(991100090, 991100091);
  link(991100091, 991100092);
  const plan = await planAnimeSeasons(991100090);
  assert.deepEqual(plan.map((s) => s.seasonNumber), [1, 2]);

  // a running sequel counts only the episodes already aired
  graph.get('991100092').status = 'RELEASING';
  graph.get('991100092').nextAiringEpisode = { episode: 4, airingAt: 1900000000, timeUntilAiring: 1000 };
  resetFranchiseCache();
  const running = await planAnimeSeasons(991100090);
  assert.deepEqual(running.map((s) => s.episodeCount), [12, 12, 3]);
});

test('if the provider fails mid-chain nothing partial is stored (no half-built franchise)', async () => {
  const ids = buildAot(991200000);
  failIds = new Set([String(ids.s3)]);
  const root = await insertAnime('ZZTEST F Titan (provider fails)', ids.s1);
  await assert.rejects(syncSeasonsAndEpisodes(root));
  const stored = await admin.query('SELECT COUNT(*)::int AS n FROM public.seasons WHERE media_id = $1', [root]);
  assert.equal(stored.rows[0].n, 0);

  failIds = new Set(); // provider recovers: the retry builds the whole franchise
  resetFranchiseCache();
  assert.deepEqual(await syncSeasonsAndEpisodes(root), { seasons: 4, episodes: 65 });
});

test('progress rolls up across seasons in ONE library entry (season and franchise totals)', async () => {
  const ids = buildAot(991300000);
  const root = await insertAnime('ZZTEST F Titan (tracked)', ids.s1);
  const added = await api('post', '', { mediaId: root, status: 'PLAN_TO_WATCH' });
  assert.equal(added.status, 201);
  const entryId = added.body.data.id;

  const { seasons } = await getSeasonsForMedia(root);
  const [s1, s2, s3, s4] = seasons;
  const watch = (episode) => api('post', `/${entryId}/episodes/${episode.id}/watched`);

  // tick 8 episodes of Season 2 and 1 of Season 3
  for (const ep of s2.episodes.slice(0, 8)) assert.equal((await watch(ep)).status, 200);
  const last = await watch(s3.episodes[0]);
  assert.equal(last.body.data.watchedEpisodesCount, 9);
  assert.equal(last.body.data.totalEpisodes, 65, 'franchise total across all four seasons');
  assert.equal(last.body.data.status, 'WATCHING', 'first watched episode auto-starts the entry');

  const check = await api('get', `/check/${root}`);
  assert.equal(check.body.data.entry.watchedEpisodesCount, 9);
  const watchedIds = new Set(check.body.data.watchedEpisodeIds);
  const perSeason = seasons.map((s) => s.episodes.filter((e) => watchedIds.has(e.id)).length);
  assert.deepEqual(perSeason, [0, 8, 1, 0], 'season progress: Season 2 = 8/12');

  // un-watching one reduces the total
  const undo = await api('delete', `/${entryId}/episodes/${s2.episodes[0].id}/watched`);
  assert.equal(undo.body.data.watchedEpisodesCount, 8);

  // finish every season: the whole franchise completes only when ALL 65 are watched
  for (const season of [s1, s2, s3, s4]) {
    const res = await api('post', `/${entryId}/seasons/${season.id}/watched`);
    assert.equal(res.status, 200);
    if (season !== s4) assert.notEqual(res.body.data.status, 'COMPLETED');
  }
  const done = await api('get', `/check/${root}`);
  assert.equal(done.body.data.entry.watchedEpisodesCount, 65);
  assert.equal(done.body.data.entry.status, 'COMPLETED');
  assert.ok(done.body.data.entry.completedAt);
});

test('legacy upgrade: an anime stored with one season gains its sequels WITHOUT losing watched progress', async () => {
  const ids = buildAot(991400000);
  // stored the old way: "Season 1" only, no AniList marker, plus a user who watched two episodes
  const media = await insertAnime('ZZTEST F Titan (legacy)', ids.s1);
  const season = await admin.query(
    `INSERT INTO public.seasons (media_id, season_number, name, episode_count) VALUES ($1, 1, 'Season 1', 25) RETURNING id`,
    [media]
  );
  const episodeIds = [];
  for (let n = 1; n <= 25; n++) {
    const e = await admin.query(
      `INSERT INTO public.episodes (season_id, episode_number, title) VALUES ($1, $2, $3) RETURNING id`,
      [season.rows[0].id, n, `Episode ${n}`]
    );
    episodeIds.push(e.rows[0].id);
  }
  const added = await api('post', '', { mediaId: media, status: 'WATCHING' });
  const entryId = added.body.data.id;
  await api('post', `/${entryId}/episodes/${episodeIds[0]}/watched`);
  await api('post', `/${entryId}/episodes/${episodeIds[1]}/watched`);

  const upgraded = await getSeasonsForMedia(media); // opening the tracker triggers the one-time upgrade
  assert.equal(upgraded.seasons.length, 4);
  assert.deepEqual(upgraded.seasons.map((s) => s.episodes.length), [25, 12, 12, 16]);
  assert.deepEqual(
    upgraded.seasons[0].episodes.slice(0, 2).map((e) => e.id),
    episodeIds.slice(0, 2),
    'Season 1 episodes keep their ids, so progress attaches to the same rows'
  );

  const check = await api('get', `/check/${media}`);
  assert.equal(check.body.data.entry.watchedEpisodesCount, 2, 'progress preserved');
  assert.equal(check.body.data.entry.totalEpisodes, 65);

  const callsAfterUpgrade = calls.length;
  await getSeasonsForMedia(media);
  assert.equal(calls.length, callsAfterUpgrade, 'the upgrade runs once, not on every page view');
});

test('a failed legacy upgrade serves the stored season and does not hammer the provider', async () => {
  const ids = buildAot(991500000);
  failIds = new Set([String(ids.s1)]);
  const media = await insertAnime('ZZTEST F Titan (legacy fail)', ids.s1);
  const season = await admin.query(
    `INSERT INTO public.seasons (media_id, season_number, name, episode_count) VALUES ($1, 1, 'Season 1', 2) RETURNING id`,
    [media]
  );
  for (let n = 1; n <= 2; n++) {
    await admin.query(`INSERT INTO public.episodes (season_id, episode_number, title) VALUES ($1, $2, $3)`, [season.rows[0].id, n, `Episode ${n}`]);
  }
  const first = await getSeasonsForMedia(media);
  assert.equal(first.seasons.length, 1, 'stored data is served');
  const callsAfterFailure = calls.length;
  await getSeasonsForMedia(media);
  assert.equal(calls.length, callsAfterFailure, 'no retry within the cool-down');
});

test('AniList raw query includes the fields the franchise and radar features depend on', async () => {
  let seen = '';
  globalThis.fetch = async (url, init) => {
    seen = JSON.parse(init.body).query;
    return jsonResponse({ data: { Media: { id: 1 } } });
  };
  await anilistProvider.getAnimeFranchiseNode(1);
  assert.match(seen, /relationType\(version: 2\)/);
  assert.match(seen, /nextAiringEpisode \{ episode airingAt timeUntilAiring \}/);
  await anilistProvider.getAnimeDetails(1);
  assert.match(seen, /nextAiringEpisode \{ episode airingAt timeUntilAiring \}/);
});

test('series-wise tracking: the page of a sequel points at the ROOT entry, so adding it tracks the whole series once', async () => {
  const ids = buildAot(991600000);
  const rootPage = await getMediaDetails({ provider: 'ANILIST', mediaType: 'ANIME', externalId: String(ids.s1) });
  assert.ok(rootPage.catalogId);
  assert.equal(rootPage.series, undefined, 'the first season tracks itself');

  const s3Page = await getMediaDetails({ provider: 'ANILIST', mediaType: 'ANIME', externalId: String(ids.s3) });
  assert.ok(s3Page.catalogId && s3Page.catalogId !== rootPage.catalogId, 'the sequel still has its own catalog row');
  assert.deepEqual(s3Page.series, {
    rootExternalId: String(ids.s1),
    rootTitle: 'ZZTEST F Titan',
    rootCatalogId: rootPage.catalogId,
    seasonNumber: 3,
    totalSeasons: 4
  });

  // what the client does from the Season 3 page: add the ROOT, then everything counts toward one entry
  const added = await api('post', '', { mediaId: s3Page.series.rootCatalogId, status: 'WATCHING' });
  assert.equal(added.status, 201);
  assert.equal(added.body.data.media.title, 'ZZTEST F Titan');
  await syncSeasonsAndEpisodes(rootPage.catalogId);
  const { seasons } = await getSeasonsForMedia(rootPage.catalogId);
  for (const ep of seasons[0].episodes.slice(0, 12)) await api('post', `/${added.body.data.id}/episodes/${ep.id}/watched`);
  const entry = (await api('get', `/check/${rootPage.catalogId}`)).body.data.entry;
  assert.equal(entry.watchedEpisodesCount, 12);
  assert.equal(entry.totalEpisodes, 65, '12 / 65 for the whole series');
  const library = await api('get', '');
  assert.equal(library.body.data.filter((e) => e.media.title.startsWith('ZZTEST F Titan') && e.mediaId === rootPage.catalogId).length, 1, 'one entry for the series');
  assert.equal((await api('get', `/check/${s3Page.catalogId}`)).body.data.entry, null, 'the lone sequel row is not tracked');
});

test('series lookup failure degrades gracefully: the sequel page still works and tracks itself', async () => {
  const ids = buildAot(991700000);
  failIds = new Set([String(ids.s1)]); // the root cannot be loaded
  const page = await getMediaDetails({ provider: 'ANILIST', mediaType: 'ANIME', externalId: String(ids.s2) });
  assert.ok(page.catalogId);
  assert.equal(page.series, undefined);
});
