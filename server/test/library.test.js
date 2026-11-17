/**
 * Phase 4 integration tests: library CRUD, episode progress, movie/cross-media
 * guards, season/episode sync and Row Level Security.
 *
 * REAL: the Express routes/controllers/services, SQL, transactions and the
 * database, which is accessed as the restricted `showtracker_app` role (RLS on).
 * SUBSTITUTED: (1) authentication - tests send `x-test-user` instead of a Google
 * token, via the router's injectable `auth` hook; (2) TMDB/AniList HTTP calls
 * in the sync tests (globalThis.fetch is mocked).
 *
 * Disposable users and "ZZTEST" titles are created through the admin
 * connection and removed at the end.
 */
import dotenv from 'dotenv';
dotenv.config();
process.env.NODE_ENV = 'test';

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import request from 'supertest';

const { pool, migrationPool, closePool } = await import('../src/config/database.js');
const { createLibraryRouter } = await import('../src/modules/library/library.routes.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const { withUserTransaction } = await import('../src/db/withUserTransaction.js');
const { syncSeasonsAndEpisodes, getSeasonsForMedia } = await import('../src/services/episodeCatalog.service.js');
const { default: realApp } = await import('../src/app.js');

// ------------------------------------------------------------------ setup ---

const admin = migrationPool; // postgres: fixtures and cleanup only
const userA = crypto.randomUUID();
const userB = crypto.randomUUID();
const ids = {}; // fixture ids filled in by before()

const fakeAuth = (req, res, next) => {
  req.user = { id: req.headers['x-test-user'] };
  next();
};
const app = express();
app.use(express.json());
app.use('/api/library', createLibraryRouter({ auth: fakeAuth }));
app.use(errorHandler);

const api = (method, path, user, body) => {
  let r = request(app)[method](`/api/library${path}`).set('x-test-user', user);
  if (body !== undefined) r = r.send(body);
  return r;
};

async function insertMedia(title, mediaType, provider, externalId, metadata = {}) {
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

async function insertSeasons(mediaId, layout) {
  // layout: { seasonNumber: episodeCount }
  const out = { seasons: {}, episodes: {} };
  for (const [num, count] of Object.entries(layout)) {
    const s = await admin.query(
      `INSERT INTO public.seasons (media_id, season_number, name, episode_count) VALUES ($1, $2, $3, $4) RETURNING id`,
      [mediaId, Number(num), Number(num) === 0 ? 'Specials' : `Season ${num}`, count]
    );
    out.seasons[num] = s.rows[0].id;
    out.episodes[num] = [];
    for (let n = 1; n <= count; n++) {
      const e = await admin.query(
        `INSERT INTO public.episodes (season_id, episode_number, title) VALUES ($1, $2, $3) RETURNING id`,
        [s.rows[0].id, n, `Episode ${n}`]
      );
      out.episodes[num].push(e.rows[0].id);
    }
  }
  return out;
}

async function cleanup() {
  // Cascades to profiles + library. The email pattern also clears leftovers from crashed earlier runs.
  await admin.query(`DELETE FROM auth.users WHERE id = ANY($1::uuid[]) OR email LIKE 'zztest-%@example.invalid'`, [
    [userA, userB]
  ]);
  await admin.query(`DELETE FROM public.media_items WHERE title LIKE 'ZZTEST %'`); // cascades seasons/episodes/sources
}

before(async () => {
  await cleanup();
  for (const [id, label] of [[userA, 'a'], [userB, 'b']]) {
    await admin.query(
      `INSERT INTO auth.users (id, aud, role, email) VALUES ($1, 'authenticated', 'authenticated', $2)`,
      [id, `zztest-${label}-${id.slice(0, 8)}@example.invalid`]
    );
  }
  ids.tv1 = await insertMedia('ZZTEST Show One', 'TV', 'TMDB', '990000001');
  ids.tv2 = await insertMedia('ZZTEST Show Two', 'TV', 'TMDB', '990000002');
  ids.movie = await insertMedia('ZZTEST Movie', 'MOVIE', 'TMDB', '990000003');
  ids.anime = await insertMedia('ZZTEST Anime', 'ANIME', 'ANILIST', '990000004', { totalEpisodes: 3 });
  ids.tv1Layout = await insertSeasons(ids.tv1, { 0: 1, 1: 3, 2: 2 }); // 5 regular episodes + 1 special
  ids.tv2Layout = await insertSeasons(ids.tv2, { 1: 2 });
});

after(async () => {
  await cleanup();
  await closePool();
});

// ------------------------------------------------------------------ tests ---

test('runtime database role is showtracker_app without RLS bypass', async () => {
  const { rows } = await pool.query(
    `SELECT current_user AS u, (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass`
  );
  assert.equal(rows[0].u, 'showtracker_app');
  assert.equal(rows[0].bypass, false);
});

test('real app: library routes require authentication', async () => {
  const res = await request(realApp).get('/api/library');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'AUTH_REQUIRED');
});

test('add: movie, anime and TV can be added; defaults to PLAN_TO_WATCH', async () => {
  const tv = await api('post', '', userA, { mediaId: ids.tv1 });
  assert.equal(tv.status, 201);
  assert.equal(tv.body.data.status, 'PLAN_TO_WATCH');
  assert.equal(tv.body.data.watchedEpisodesCount, 0);
  assert.equal(tv.body.data.totalEpisodes, 5);
  ids.entryTv1 = tv.body.data.id;

  const movie = await api('post', '', userA, { mediaId: ids.movie, status: 'COMPLETED', rating: 8.5 });
  assert.equal(movie.status, 201);
  assert.equal(movie.body.data.rating, 8.5);
  assert.ok(movie.body.data.completedAt, 'completed_at set when added as COMPLETED');
  assert.equal(movie.body.data.totalEpisodes, null);
  ids.entryMovie = movie.body.data.id;

  const anime = await api('post', '', userA, { mediaId: ids.anime, status: 'WATCHING' });
  assert.equal(anime.status, 201);
  assert.ok(anime.body.data.startedAt);
  assert.equal(anime.body.data.totalEpisodes, 3, 'falls back to catalog metadata until episodes are synced');
  ids.entryAnime = anime.body.data.id;
});

test('add: duplicates -> 409; unknown media -> 404; bad input -> 400', async () => {
  const dup = await api('post', '', userA, { mediaId: ids.tv1 });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, 'ALREADY_IN_LIBRARY');

  assert.equal((await api('post', '', userA, { mediaId: crypto.randomUUID() })).status, 404);
  assert.equal((await api('post', '', userA, { mediaId: 'nope' })).status, 400);
  assert.equal((await api('post', '', userA, { mediaId: ids.tv2, status: 'BINGING' })).status, 400);
  assert.equal((await api('post', '', userA, { mediaId: ids.tv2, rating: 11 })).status, 400);
  assert.equal((await api('post', '', userA, { mediaId: ids.tv2, notes: 'x'.repeat(2001) })).status, 400);
});

test('update: status, rating, favorite and notes; timestamps follow status', async () => {
  const res = await api('patch', `/${ids.entryTv1}`, userA, {
    rating: 9.04,
    isFavorite: true,
    notes: 'private thoughts'
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.rating, 9);
  assert.equal(res.body.data.isFavorite, true);
  assert.equal(res.body.data.notes, 'private thoughts');

  const watching = await api('patch', `/${ids.entryTv1}`, userA, { status: 'WATCHING' });
  assert.equal(watching.body.data.status, 'WATCHING');
  assert.ok(watching.body.data.startedAt);
  assert.equal(watching.body.data.completedAt, null);

  const done = await api('patch', `/${ids.entryTv1}`, userA, { status: 'COMPLETED' });
  assert.ok(done.body.data.completedAt);
  const back = await api('patch', `/${ids.entryTv1}`, userA, { status: 'WATCHING', rating: null });
  assert.equal(back.body.data.completedAt, null, 'leaving COMPLETED clears completed_at');
  assert.equal(back.body.data.rating, null);
});

test('update: invalid ratings and empty patch are rejected', async () => {
  for (const rating of [-1, 10.5, 'high']) {
    const res = await api('patch', `/${ids.entryTv1}`, userA, { rating });
    assert.equal(res.status, 400, `rating ${rating}`);
  }
  assert.equal((await api('patch', `/${ids.entryTv1}`, userA, {})).status, 400);
});

test('episodes: watching one episode derives the count and auto-starts a PLAN_TO_WATCH entry', async () => {
  const fresh = await api('post', '', userA, { mediaId: ids.tv2 });
  const entryId = fresh.body.data.id;
  const ep = ids.tv2Layout.episodes[1][0];

  const watched = await api('post', `/${entryId}/episodes/${ep}/watched`, userA);
  assert.equal(watched.status, 200);
  assert.equal(watched.body.data.watchedEpisodesCount, 1);
  assert.equal(watched.body.data.status, 'WATCHING');
  assert.ok(watched.body.data.startedAt);

  const again = await api('post', `/${entryId}/episodes/${ep}/watched`, userA); // idempotent
  assert.equal(again.body.data.watchedEpisodesCount, 1);

  const { rows } = await admin.query(
    'SELECT COUNT(*)::int AS n FROM public.user_episode_progress WHERE user_library_id = $1',
    [entryId]
  );
  assert.equal(rows[0].n, 1, 'exactly one progress row');

  const unwatched = await api('delete', `/${entryId}/episodes/${ep}/watched`, userA);
  assert.equal(unwatched.body.data.watchedEpisodesCount, 0);
  const left = await admin.query(
    'SELECT COUNT(*)::int AS n FROM public.user_episode_progress WHERE user_library_id = $1',
    [entryId]
  );
  assert.equal(left.rows[0].n, 0);
  ids.entryTv2 = entryId;
});

test('episodes: finishing every regular episode completes the show; unwatching reverts it; specials are ignored', async () => {
  const eps = ids.tv1Layout.episodes;
  const special = eps[0][0];
  const regular = [...eps[1], ...eps[2]];

  // A special is tracked but does not count toward progress.
  const sp = await api('post', `/${ids.entryTv1}/episodes/${special}/watched`, userA);
  assert.equal(sp.body.data.watchedEpisodesCount, 0);

  let last;
  for (const id of regular) last = await api('post', `/${ids.entryTv1}/episodes/${id}/watched`, userA);
  assert.equal(last.body.data.watchedEpisodesCount, 5);
  assert.equal(last.body.data.totalEpisodes, 5);
  assert.equal(last.body.data.status, 'COMPLETED');
  assert.ok(last.body.data.completedAt);

  const undo = await api('delete', `/${ids.entryTv1}/episodes/${regular[4]}/watched`, userA);
  assert.equal(undo.body.data.status, 'WATCHING');
  assert.equal(undo.body.data.completedAt, null);
  assert.equal(undo.body.data.watchedEpisodesCount, 4);
});

test('episodes: mark a whole season watched (bulk, idempotent)', async () => {
  const season2 = ids.tv1Layout.seasons[2];
  const res = await api('post', `/${ids.entryTv1}/seasons/${season2}/watched`, userA);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.watchedEpisodesCount, 5);
  assert.equal(res.body.data.status, 'COMPLETED');

  const again = await api('post', `/${ids.entryTv1}/seasons/${season2}/watched`, userA);
  assert.equal(again.body.data.markedCount, 0);
  assert.equal(again.body.data.watchedEpisodesCount, 5);
});

test('guard: episodes of a movie are rejected', async () => {
  const anyEpisode = ids.tv1Layout.episodes[1][0];
  const res = await api('post', `/${ids.entryMovie}/episodes/${anyEpisode}/watched`, userA);
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'CANNOT_TRACK_EPISODES_FOR_MOVIE');
  const del = await api('delete', `/${ids.entryMovie}/episodes/${anyEpisode}/watched`, userA);
  assert.equal(del.body.error.code, 'CANNOT_TRACK_EPISODES_FOR_MOVIE');
});

test('guard: an episode of Show A cannot be marked on Show B\'s entry', async () => {
  const showAEpisode = ids.tv1Layout.episodes[1][0];
  const res = await api('post', `/${ids.entryTv2}/episodes/${showAEpisode}/watched`, userA);
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'INVALID_EPISODE_FOR_MEDIA');

  const season = await api('post', `/${ids.entryTv2}/seasons/${ids.tv1Layout.seasons[1]}/watched`, userA);
  assert.equal(season.status, 400);
  assert.equal(season.body.error.code, 'INVALID_SEASON_FOR_MEDIA');
});

test('list: filters, sorting and derived progress', async () => {
  const all = await api('get', '', userA);
  assert.equal(all.status, 200);
  assert.equal(all.body.data.length, 4);

  const tvOnly = await api('get', '?mediaType=TV', userA);
  assert.deepEqual(tvOnly.body.data.map((e) => e.media.mediaType).sort(), ['TV', 'TV']);

  const completed = await api('get', '?status=COMPLETED', userA);
  assert.ok(completed.body.data.every((e) => e.status === 'COMPLETED'));

  const byTitle = await api('get', '?sort=title&order=asc', userA);
  const titles = byTitle.body.data.map((e) => e.media.title);
  assert.deepEqual(titles, [...titles].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));

  assert.equal((await api('get', '?sort=password', userA)).status, 400, 'sort is whitelisted');
  assert.equal((await api('get', '?status=NOPE', userA)).status, 400);

  const tv1 = all.body.data.find((e) => e.id === ids.entryTv1);
  assert.equal(tv1.watchedEpisodesCount, 5);
});

test('check: returns the entry and watched episode ids for a title', async () => {
  const res = await api('get', `/check/${ids.tv1}`, userA);
  assert.equal(res.body.data.entry.id, ids.entryTv1);
  assert.equal(res.body.data.watchedEpisodeIds.length, 6); // 5 regular + 1 special

  const none = await api('get', `/check/${ids.tv2}`, userB);
  assert.deepEqual(none.body.data, { entry: null, watchedEpisodeIds: [] });
});

// ------------------------------------------------------------- isolation ---

test('isolation: user B cannot see user A\'s library', async () => {
  const res = await api('get', '', userB);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, []);
});

test('isolation: user B cannot read, update, delete or track user A\'s entry (404, nothing changed)', async () => {
  const ep = ids.tv1Layout.episodes[1][0];
  const before = (await api('get', `/check/${ids.tv1}`, userA)).body.data;

  assert.equal((await api('patch', `/${ids.entryTv1}`, userB, { rating: 1, notes: 'hacked' })).status, 404);
  assert.equal((await api('post', `/${ids.entryTv1}/episodes/${ep}/watched`, userB)).status, 404);
  assert.equal((await api('delete', `/${ids.entryTv1}/episodes/${ep}/watched`, userB)).status, 404);
  assert.equal((await api('post', `/${ids.entryTv1}/seasons/${ids.tv1Layout.seasons[1]}/watched`, userB)).status, 404);
  assert.equal((await api('delete', `/${ids.entryTv1}`, userB)).status, 404);

  const after = (await api('get', `/check/${ids.tv1}`, userA)).body.data;
  assert.deepEqual(after, before, 'user A\'s data is untouched');
});

test('isolation (database level): RLS blocks cross-user reads and writes even with raw SQL', async () => {
  const seenByB = await withUserTransaction(userB, (c) =>
    c.query('SELECT id FROM public.user_library WHERE id = $1', [ids.entryTv1])
  );
  assert.equal(seenByB.rows.length, 0);

  const progressSeenByB = await withUserTransaction(userB, (c) =>
    c.query('SELECT 1 FROM public.user_episode_progress WHERE user_library_id = $1', [ids.entryTv1])
  );
  assert.equal(progressSeenByB.rows.length, 0);

  // Inserting a row owned by someone else violates the policy.
  await assert.rejects(
    withUserTransaction(userB, (c) =>
      c.query('INSERT INTO public.user_library (user_id, media_id) VALUES ($1, $2)', [userA, ids.tv2])
    ),
    /row-level security/i
  );
  // Writing progress onto someone else's entry violates the policy.
  await assert.rejects(
    withUserTransaction(userB, (c) =>
      c.query('INSERT INTO public.user_episode_progress (user_library_id, episode_id) VALUES ($1, $2)', [
        ids.entryTv1,
        ids.tv1Layout.episodes[1][0]
      ])
    ),
    /row-level security/i
  );
  // Without any user identity nothing is visible.
  const noUser = await pool.query('SELECT id FROM public.user_library');
  assert.equal(noUser.rows.length, 0);
});

test('isolation: a transaction identity does not leak to the next pooled connection', async () => {
  await withUserTransaction(userA, (c) => c.query('SELECT 1'));
  const leaked = await pool.query(`SELECT current_setting('request.jwt.claim.sub', true) AS sub`);
  assert.ok(!leaked.rows[0].sub, 'claim is cleared after the transaction');
});

test('transactions: invalid user ids are rejected before any SQL is built', async () => {
  for (const bad of ["x'); DROP TABLE public.profiles; --", 'not-a-uuid', '', null, undefined, 12345]) {
    await assert.rejects(withUserTransaction(bad, (c) => c.query('SELECT 1')), /UUID|requires/i, String(bad));
  }
});

test('transactions: read-only transactions (COMMIT not awaited) never leak identity to other connections', async () => {
  // Run several read-only transactions, then probe every pooled connection concurrently.
  await Promise.all(
    Array.from({ length: 6 }, () => withUserTransaction(userA, (c) => c.query('SELECT 1'), { readOnly: true }))
  );
  const probes = await Promise.all(
    Array.from({ length: 8 }, () => pool.query(`SELECT current_setting('request.jwt.claim.sub', true) AS sub, current_setting('app.user_id', true) AS uid`))
  );
  for (const p of probes) {
    assert.ok(!p.rows[0].sub, 'claim cleared');
    assert.ok(!p.rows[0].uid, 'app.user_id cleared');
  }
});

test('transactions: a read-only transaction still sees the right user and a failing one rolls back', async () => {
  const seen = await withUserTransaction(
    userA,
    (c) => c.query(`SELECT current_setting('request.jwt.claim.sub', true) AS sub, current_setting('request.jwt.claims', true)::json->>'role' AS role`),
    { readOnly: true }
  );
  assert.equal(seen.rows[0].sub, userA);
  assert.equal(seen.rows[0].role, 'authenticated');
  // ...and RLS really does see that identity: user A can read their own library entry through the read-only path
  const own = await withUserTransaction(userA, (c) => c.query('SELECT COUNT(*)::int AS n FROM public.user_library'), { readOnly: true });
  assert.ok(own.rows[0].n >= 1);
  const other = await withUserTransaction(userB, (c) => c.query('SELECT COUNT(*)::int AS n FROM public.user_library WHERE user_id = $1', [userA]), { readOnly: true });
  assert.equal(other.rows[0].n, 0);
  await assert.rejects(
    withUserTransaction(userA, (c) => c.query('SELECT * FROM public.table_that_does_not_exist'), { readOnly: true })
  );
  // the connection is usable and clean afterwards
  const after = await pool.query(`SELECT current_setting('request.jwt.claim.sub', true) AS sub`);
  assert.ok(!after.rows[0].sub);
});

// -------------------------------------------------- season/episode sync ---

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('sync (TMDB TV, mocked HTTP): creates seasons/episodes once; repeated syncs add no duplicates', async () => {
  const mediaId = await insertMedia('ZZTEST Synced Show', 'TV', 'TMDB', '990000010');
  const realFetch = globalThis.fetch;
  process.env.TMDB_API_READ_ACCESS_TOKEN ||= 'test-token';
  let seasonCalls = 0;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/tv/990000010/season/')) {
      seasonCalls++;
      const n = Number(u.match(/season\/(\d+)/)[1]);
      return jsonResponse({
        season_number: n,
        name: n === 0 ? 'Specials' : `Season ${n}`,
        episodes: Array.from({ length: n === 1 ? 3 : 2 }, (_, i) => ({
          episode_number: i + 1,
          name: i === 0 ? '' : `Ep ${i + 1}`, // blank title must fall back to "Episode 1"
          air_date: '2020-01-0' + (i + 1),
          runtime: 45
        }))
      });
    }
    if (u.includes('/tv/990000010')) {
      return jsonResponse({
        seasons: [
          { season_number: 0, name: 'Specials', episode_count: 2 },
          { season_number: 1, name: 'Season 1', episode_count: 3 },
          { season_number: 2, name: 'Season 2', episode_count: 2 }
        ]
      });
    }
    throw new Error(`unmocked fetch ${u}`);
  };
  try {
    const first = await syncSeasonsAndEpisodes(mediaId);
    assert.deepEqual(first, { seasons: 3, episodes: 7 });
    await Promise.all([syncSeasonsAndEpisodes(mediaId), syncSeasonsAndEpisodes(mediaId)]); // concurrent
    await syncSeasonsAndEpisodes(mediaId);

    const counts = await admin.query(
      `SELECT (SELECT COUNT(*) FROM public.seasons WHERE media_id = $1)::int AS seasons,
              (SELECT COUNT(*) FROM public.episodes e JOIN public.seasons s ON s.id = e.season_id WHERE s.media_id = $1)::int AS episodes`,
      [mediaId]
    );
    assert.deepEqual(counts.rows[0], { seasons: 3, episodes: 7 });

    const result = await getSeasonsForMedia(mediaId);
    const s1 = result.seasons.find((s) => s.seasonNumber === 1);
    assert.equal(s1.episodes[0].title, 'Episode 1');
    assert.equal(s1.episodes[0].airDate, '2020-01-01');
    assert.equal(s1.episodes[0].runtimeMinutes, 45);
    assert.equal(result.supportsEpisodes, true);
    assert.ok(seasonCalls >= 3);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('sync (AniList, mocked HTTP): generates episodes 1..N, or aired episodes for a running show', async () => {
  const realFetch = globalThis.fetch;
  const anime = (episodes, next) =>
    jsonResponse({ data: { Media: { id: 1, episodes, duration: 24, nextAiringEpisode: next ? { episode: next } : null } } });
  try {
    const finished = await insertMedia('ZZTEST Finished Anime', 'ANIME', 'ANILIST', '990000011');
    globalThis.fetch = async () => anime(12, null);
    assert.deepEqual(await syncSeasonsAndEpisodes(finished), { seasons: 1, episodes: 12 });
    await syncSeasonsAndEpisodes(finished);
    const { seasons } = await getSeasonsForMedia(finished);
    assert.equal(seasons.length, 1);
    assert.equal(seasons[0].episodes.length, 12);
    assert.equal(seasons[0].episodes[11].title, 'Episode 12');

    const airing = await insertMedia('ZZTEST Airing Anime', 'ANIME', 'ANILIST', '990000012');
    globalThis.fetch = async () => anime(null, 8); // episode 8 airs next => 7 are out
    assert.deepEqual(await syncSeasonsAndEpisodes(airing), { seasons: 1, episodes: 7 });

    const unknown = await insertMedia('ZZTEST Unannounced Anime', 'ANIME', 'ANILIST', '990000013');
    globalThis.fetch = async () => anime(null, null);
    assert.deepEqual(await syncSeasonsAndEpisodes(unknown), { seasons: 0, episodes: 0 });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('sync: movies never get seasons or episodes', async () => {
  assert.deepEqual(await syncSeasonsAndEpisodes(ids.movie), { seasons: 0, episodes: 0 });
  const result = await getSeasonsForMedia(ids.movie);
  assert.equal(result.supportsEpisodes, false);
  assert.deepEqual(result.seasons, []);
});

test('sync: removing an entry deletes progress but never catalog data', async () => {
  const del = await api('delete', `/${ids.entryTv1}`, userA);
  assert.equal(del.status, 200);
  const progress = await admin.query('SELECT COUNT(*)::int AS n FROM public.user_episode_progress WHERE user_library_id = $1', [ids.entryTv1]);
  assert.equal(progress.rows[0].n, 0);
  const catalog = await admin.query('SELECT COUNT(*)::int AS n FROM public.media_items WHERE id = $1', [ids.tv1]);
  assert.equal(catalog.rows[0].n, 1);
  assert.equal((await api('delete', `/${ids.entryTv1}`, userA)).status, 404);
});
