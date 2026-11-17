/**
 * Phase 5 integration tests: live statistics, dashboard shelves and the
 * privacy rules of the public profile API.
 *
 * REAL: Express routes/controllers/services, SQL, transactions, Row Level
 * Security, migration-005 view. The database is accessed as `showtracker_app`.
 * SUBSTITUTED: authentication only - tests send `x-test-user` instead of a
 * Google token (the same injectable-auth approach as library.test.js).
 *
 * Disposable users and "ZZSP" titles are created with the admin connection and
 * deleted at the end.
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
const { getPublicProfile, updateMyProfile } = await import('../src/modules/profiles/profiles.controller.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const { default: realApp } = await import('../src/app.js');

const admin = migrationPool;
const tag = crypto.randomBytes(4).toString('hex');
const U = {
  owner: { id: crypto.randomUUID(), username: `zzsp_owner_${tag}` }, // public profile, public library
  hidden: { id: crypto.randomUUID(), username: `zzsp_hidden_${tag}` }, // public profile, PRIVATE library
  secret: { id: crypto.randomUUID(), username: `zzsp_secret_${tag}` }, // PRIVATE profile
  empty: { id: crypto.randomUUID(), username: `zzsp_empty_${tag}` }, // no library
  viewer: { id: crypto.randomUUID(), username: `zzsp_viewer_${tag}` } // a signed-in stranger
};
const NOTE = (who) => `ZZSP-PRIVATE-NOTE-${who}-${tag}`;
const m = {}; // media ids
const entries = {};

// ------------------------------------------------------------------ app ---

const fakeAuth = (req, res, next) => {
  req.user = { id: req.headers['x-test-user'] };
  next();
};
const fakeOptionalAuth = (req, res, next) => {
  req.user = req.headers['x-test-user'] ? { id: req.headers['x-test-user'] } : null;
  next();
};
const app = express();
app.use(express.json());
app.use('/api/library', createLibraryRouter({ auth: fakeAuth }));
app.get('/api/users/:username', fakeOptionalAuth, getPublicProfile);
app.patch('/api/profiles/me', fakeAuth, updateMyProfile);
app.use(errorHandler);

const get = (path, user) => {
  let r = request(app).get(path);
  if (user) r = r.set('x-test-user', user.id);
  return r;
};

// ---------------------------------------------------------------- fixtures --

const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

async function insertMedia(title, mediaType, extId, metadata = {}) {
  const { rows } = await admin.query(
    `INSERT INTO public.media_items (media_type, title, poster_path, backdrop_path, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
    [mediaType, title, `https://img.example/${extId}.jpg`, `https://img.example/${extId}-bd.jpg`, JSON.stringify(metadata)]
  );
  await admin.query(
    `INSERT INTO public.media_sources (media_id, provider, provider_media_type, external_id) VALUES ($1, $2, $3, $4)`,
    [rows[0].id, mediaType === 'ANIME' ? 'ANILIST' : 'TMDB', mediaType, extId]
  );
  return rows[0].id;
}

async function addSeason(mediaId, seasonNumber, count) {
  const s = await admin.query(
    `INSERT INTO public.seasons (media_id, season_number, name, episode_count) VALUES ($1, $2, $3, $4) RETURNING id`,
    [mediaId, seasonNumber, seasonNumber === 0 ? 'Specials' : `Season ${seasonNumber}`, count]
  );
  const ids = [];
  for (let n = 1; n <= count; n++) {
    const e = await admin.query(
      `INSERT INTO public.episodes (season_id, episode_number, title) VALUES ($1, $2, $3) RETURNING id`,
      [s.rows[0].id, n, `Episode ${n}`]
    );
    ids.push(e.rows[0].id);
  }
  return ids;
}

async function addEntry(key, user, mediaId, { status, rating = null, notes = null, hours }) {
  const { rows } = await admin.query(
    `INSERT INTO public.user_library (user_id, media_id, status, rating, notes, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [user.id, mediaId, status, rating, notes, hoursAgo(hours)]
  );
  entries[key] = rows[0].id;
  return rows[0].id;
}

async function cleanup() {
  await admin.query(`DELETE FROM auth.users WHERE id = ANY($1::uuid[]) OR email LIKE 'zzsp-%@example.invalid'`, [
    Object.values(U).map((u) => u.id)
  ]);
  await admin.query(`DELETE FROM public.media_items WHERE title LIKE 'ZZSP %'`);
}

before(async () => {
  await cleanup();
  for (const [name, u] of Object.entries(U)) {
    await admin.query(
      `INSERT INTO auth.users (id, aud, role, email) VALUES ($1, 'authenticated', 'authenticated', $2)`,
      [u.id, `zzsp-${name}-${tag}@example.invalid`]
    );
    await admin.query(
      `UPDATE public.profiles SET username = $2, display_name = $3, bio = $4 WHERE id = $1`,
      [u.id, u.username, `Display ${name}`, `Bio of ${name}`]
    );
  }
  await admin.query(`UPDATE public.profiles SET library_visibility = 'PRIVATE' WHERE id = $1`, [U.hidden.id]);
  await admin.query(`UPDATE public.profiles SET profile_visibility = 'PRIVATE' WHERE id = $1`, [U.secret.id]);

  m.tvA = await insertMedia('ZZSP Show A', 'TV', '990100001');
  m.tvB = await insertMedia('ZZSP Show B', 'TV', '990100002');
  m.tvC = await insertMedia('ZZSP Show C', 'TV', '990100003');
  m.tvD = await insertMedia('ZZSP Show D', 'TV', '990100004');
  m.anime = await insertMedia('ZZSP Anime', 'ANIME', '990100005', { totalEpisodes: 12 });
  m.movie = await insertMedia('ZZSP Movie', 'MOVIE', '990100006');
  const epsA = await addSeason(m.tvA, 1, 3);
  const specials = await addSeason(m.tvA, 0, 1);

  // owner: 6 titles, controlled "updated" times
  await addEntry('tvB', U.owner, m.tvB, { status: 'PLAN_TO_WATCH', notes: NOTE('owner-b'), hours: 0.5 }); // newest overall
  await addEntry('tvA', U.owner, m.tvA, { status: 'WATCHING', rating: 8, notes: NOTE('owner-a'), hours: 1 });
  await addEntry('tvC', U.owner, m.tvC, { status: 'WATCHING', hours: 2 });
  await addEntry('tvD', U.owner, m.tvD, { status: 'WATCHING', hours: 3 });
  await addEntry('anime', U.owner, m.anime, { status: 'COMPLETED', rating: 9, notes: NOTE('owner-anime'), hours: 4 });
  await addEntry('movie', U.owner, m.movie, { status: 'COMPLETED', hours: 5 });
  // two regular episodes + one special watched on show A => 3 watched episodes in total
  for (const ep of [epsA[0], epsA[1], specials[0]]) {
    await admin.query(`INSERT INTO public.user_episode_progress (user_library_id, episode_id) VALUES ($1, $2)`, [entries.tvA, ep]);
  }
  // hidden-library user and private-profile user each have a titled, noted entry
  await addEntry('hiddenEntry', U.hidden, m.tvA, { status: 'WATCHING', rating: 7, notes: NOTE('hidden'), hours: 1 });
  await addEntry('secretEntry', U.secret, m.tvA, { status: 'WATCHING', rating: 6, notes: NOTE('secret'), hours: 1 });
});

after(async () => {
  await cleanup();
  await closePool();
});

// ------------------------------------------------------------------- stats ---

test('stats: exact totals, type and status breakdown, episodes, average rating', async () => {
  const res = await get('/api/library/stats', U.owner);
  assert.equal(res.status, 200);
  const s = res.body.data;
  assert.equal(s.totalItems, 6);
  assert.deepEqual(s.byType, { ANIME: 1, TV: 4, MOVIE: 1 });
  assert.deepEqual(s.byStatus, { WATCHING: 3, COMPLETED: 2, PLAN_TO_WATCH: 1, ON_HOLD: 0, DROPPED: 0, REWATCHING: 0 });
  assert.equal(s.completed, 2);
  assert.equal(s.watching, 3);
  assert.equal(s.episodesWatched, 3, 'COUNT(*) of progress rows (specials are real watched episodes)');
  assert.equal(s.averageRating, 8.5, 'AVG of rated titles only: (8 + 9) / 2');
  assert.equal(s.ratedCount, 2);
  assert.equal((await get('/api/library/stats', U.owner)).headers['cache-control'], 'private, no-store');
});

test('stats: empty library gives zeros and a null average (never NaN)', async () => {
  const s = (await get('/api/library/stats', U.empty)).body.data;
  assert.equal(s.totalItems, 0);
  assert.equal(s.episodesWatched, 0);
  assert.equal(s.averageRating, null);
  assert.deepEqual(s.byType, { ANIME: 0, TV: 0, MOVIE: 0 });
});

test('stats: each user only counts their own library', async () => {
  const s = (await get('/api/library/stats', U.hidden)).body.data;
  assert.equal(s.totalItems, 1);
  assert.equal(s.episodesWatched, 0);
  assert.equal(s.averageRating, 7);
});

// ----------------------------------------------------------------- shelves ---

test('continue-watching: only WATCHING titles, newest first, with artwork and progress', async () => {
  const res = await get('/api/library/continue-watching', U.owner);
  assert.equal(res.status, 200);
  const items = res.body.data;
  assert.deepEqual(items.map((e) => e.id), [entries.tvA, entries.tvC, entries.tvD]);
  assert.ok(items.every((e) => e.status === 'WATCHING'));
  const a = items[0];
  assert.equal(a.watchedEpisodesCount, 2);
  assert.equal(a.totalEpisodes, 3);
  assert.equal(a.media.backdropUrl, 'https://img.example/990100001-bd.jpg');
  assert.equal(a.media.posterUrl, 'https://img.example/990100001.jpg');
  assert.equal(a.media.provider, 'TMDB');
  assert.equal(a.media.externalId, '990100001');
});

test('continue-watching: empty when nothing is being watched', async () => {
  assert.deepEqual((await get('/api/library/continue-watching', U.empty)).body.data, []);
});

test('recently-updated: newest first across every status, capped at 10', async () => {
  const items = (await get('/api/library/recently-updated', U.owner)).body.data;
  assert.deepEqual(items.map((e) => e.id), [entries.tvB, entries.tvA, entries.tvC, entries.tvD, entries.anime, entries.movie]);

  // 12 more entries for the empty user => still only 10 returned
  for (let i = 0; i < 12; i++) {
    const id = await insertMedia(`ZZSP Bulk ${i}`, 'MOVIE', `99020${String(i).padStart(4, '0')}`);
    await addEntry(`bulk${i}`, U.empty, id, { status: 'PLAN_TO_WATCH', hours: 10 + i });
  }
  const capped = (await get('/api/library/recently-updated', U.empty)).body.data;
  assert.equal(capped.length, 10);
  assert.equal(capped[0].id, entries.bulk0);
  await admin.query('DELETE FROM public.user_library WHERE user_id = $1', [U.empty.id]);
});

test('stats and shelves require authentication (real app)', async () => {
  for (const path of ['/api/library/stats', '/api/library/continue-watching', '/api/library/recently-updated']) {
    const res = await request(realApp).get(path);
    assert.equal(res.status, 401, path);
  }
});

// (runs after the shelf tests: editing an entry legitimately moves it to the top of the shelves)
test('stats update live when progress or ratings change', async () => {
  const before = (await get('/api/library/stats', U.owner)).body.data;
  const patched = await request(app).patch(`/api/library/${entries.tvC}`).set('x-test-user', U.owner.id).send({ rating: 4 });
  assert.equal(patched.status, 200);
  const after = (await get('/api/library/stats', U.owner)).body.data;
  assert.equal(after.ratedCount, before.ratedCount + 1);
  assert.equal(after.averageRating, 7); // (8 + 9 + 4) / 3
  await request(app).patch(`/api/library/${entries.tvC}`).set('x-test-user', U.owner.id).send({ rating: null });
});

// ----------------------------------------------------------------- privacy ---

const publicUrl = (u, qs = '') => `/api/users/${u.username}${qs}`;
const bodyText = (res) => JSON.stringify(res.body);

test('privacy: PRIVATE profile is a 404 for visitors and other users, nothing leaks', async () => {
  for (const viewer of [null, U.viewer, U.owner]) {
    const res = await get(publicUrl(U.secret), viewer);
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'USER_NOT_FOUND');
    assert.ok(!bodyText(res).includes('Bio of secret'));
    assert.ok(!bodyText(res).includes(NOTE('secret')));
  }
  // same response as a username that does not exist
  const missing = await get('/api/users/zzsp_nobody_xyz');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.message, (await get(publicUrl(U.secret))).body.error.message);
});

test('privacy: PUBLIC profile with PRIVATE library shows identity only - no titles, progress or stats', async () => {
  for (const viewer of [null, U.viewer]) {
    const res = await get(publicUrl(U.hidden), viewer);
    assert.equal(res.status, 200);
    assert.equal(res.body.profile.display_name, 'Display hidden');
    assert.equal(res.body.profile.bio, 'Bio of hidden');
    assert.deepEqual(res.body.library, []);
    assert.equal(res.body.stats, null);
    assert.equal(res.body.library_is_private, true);
    assert.equal(res.body.isOwner, false);
    const text = bodyText(res);
    assert.ok(!text.includes('ZZSP Show A'), 'no title leaked');
    assert.ok(!text.includes(NOTE('hidden')), 'no notes leaked');
    assert.ok(!text.includes('"notes"'));
  }
});

test('privacy: PUBLIC profile + PUBLIC library shows titles and stats but never notes', async () => {
  for (const viewer of [null, U.viewer]) {
    const res = await get(publicUrl(U.owner), viewer);
    assert.equal(res.status, 200);
    assert.equal(res.body.library_is_private, false);
    assert.equal(res.body.isOwner, false);
    assert.equal(res.body.library.length, 6);

    const tvA = res.body.library.find((e) => e.media.title === 'ZZSP Show A');
    assert.equal(tvA.rating, 8);
    assert.equal(tvA.watchedEpisodesCount, 2);
    assert.equal(tvA.totalEpisodes, 3);
    assert.equal(tvA.media.provider, 'TMDB');
    assert.equal(tvA.media.externalId, '990100001');

    assert.equal(res.body.stats.totalItems, 6);
    assert.equal(res.body.stats.completed, 2);
    assert.equal(res.body.stats.episodesWatched, 3);
    assert.equal(res.body.stats.averageRating, 8.5);

    const text = bodyText(res);
    assert.ok(!text.includes('notes'), 'the word "notes" appears nowhere in the payload');
    for (const k of ['owner-a', 'owner-b', 'owner-anime']) assert.ok(!text.includes(NOTE(k)), k);
  }
});

test('privacy: public stats equal what the owner sees', async () => {
  const ownerStats = (await get('/api/library/stats', U.owner)).body.data;
  const publicStats = (await get(publicUrl(U.owner))).body.stats;
  assert.deepEqual(publicStats, ownerStats);
});

test('privacy: the owner sees their own full library including private notes, even when it is private', async () => {
  const res = await get(publicUrl(U.owner), U.owner);
  assert.equal(res.status, 200);
  assert.equal(res.body.isOwner, true);
  assert.equal(res.body.library.find((e) => e.media.title === 'ZZSP Show A').notes, NOTE('owner-a'));

  const hiddenOwner = await get(publicUrl(U.hidden), U.hidden);
  assert.equal(hiddenOwner.body.isOwner, true);
  assert.equal(hiddenOwner.body.library.length, 1, 'owner sees their private library');
  assert.equal(hiddenOwner.body.library[0].notes, NOTE('hidden'));
  assert.ok(hiddenOwner.body.stats.totalItems === 1);
  assert.equal(hiddenOwner.body.library_is_private, true);

  const secretOwner = await get(publicUrl(U.secret), U.secret);
  assert.equal(secretOwner.status, 200, 'owner can open their own PRIVATE profile');
  assert.equal(secretOwner.body.isOwner, true);
});

test('privacy: library filters work on the public view; bad input is rejected', async () => {
  const watching = await get(publicUrl(U.owner, '?status=WATCHING'));
  assert.deepEqual(watching.body.library.map((e) => e.status), ['WATCHING', 'WATCHING', 'WATCHING']);
  assert.equal(watching.body.stats.totalItems, 6, 'stats ignore the filter');

  const movies = await get(publicUrl(U.owner, '?mediaType=MOVIE&sort=title&order=asc'));
  assert.equal(movies.body.library.length, 1);

  assert.equal((await get(publicUrl(U.owner, '?status=NOPE'))).status, 400);
  assert.equal((await get(publicUrl(U.owner, '?sort=password'))).status, 400);
  for (const weird of ['..%2Fetc', 'a', 'x'.repeat(60), "bob'%3B--"]) {
    assert.equal((await get(`/api/users/${weird}`)).status, 404, weird);
  }
});

test('privacy toggles: switching visibility in settings changes what strangers see immediately', async () => {
  const patch = (user, body) => request(app).patch('/api/profiles/me').set('x-test-user', user.id).send(body);

  // hide the library
  let res = await patch(U.owner, { library_visibility: 'PRIVATE' });
  assert.equal(res.status, 200);
  assert.equal(res.body.profile.library_visibility, 'PRIVATE');
  let view = await get(publicUrl(U.owner));
  assert.deepEqual(view.body.library, []);
  assert.equal(view.body.stats, null);
  assert.equal(view.body.library_is_private, true);

  // hide the whole profile
  await patch(U.owner, { profile_visibility: 'PRIVATE' });
  assert.equal((await get(publicUrl(U.owner))).status, 404);
  assert.equal((await get(publicUrl(U.owner), U.viewer)).status, 404);
  assert.equal((await get(publicUrl(U.owner), U.owner)).status, 200, 'the owner still sees it');

  // a PRIVATE profile never exposes its library even though library_visibility is PUBLIC
  await patch(U.owner, { library_visibility: 'PUBLIC' });
  assert.equal((await get(publicUrl(U.owner))).status, 404);

  // restore
  await patch(U.owner, { profile_visibility: 'PUBLIC' });
  view = await get(publicUrl(U.owner));
  assert.equal(view.body.library.length, 6);

  // validation
  assert.equal((await patch(U.owner, { library_visibility: 'FRIENDS' })).status, 400);
  assert.equal((await patch(U.owner, {})).status, 400);
  assert.equal((await patch(U.owner, { avatar_url: 'javascript:alert(1)' })).status, 400, 'avatar must be http(s)');
  assert.equal((await patch(U.owner, { avatar_url: 'https://example.com/a.png' })).status, 200);
  const text = await patch(U.owner, { display_name: 'New Name', bio: 'New bio' });
  assert.equal(text.body.profile.display_name, 'New Name');
});

// ---------------------------------------------- database-level guarantees ---

test('database: the public view cannot return notes or hidden users, even to raw SQL', async () => {
  // the view has no notes column
  await assert.rejects(pool.query('SELECT notes FROM public.public_library_entries'), /column "notes" does not exist/);

  // raw SQL as the app role only ever sees PUBLIC/PUBLIC users
  const { rows } = await pool.query(
    'SELECT DISTINCT user_id FROM public.public_library_entries WHERE user_id = ANY($1::uuid[])',
    [[U.owner.id, U.hidden.id, U.secret.id]]
  );
  assert.deepEqual(rows.map((r) => r.user_id), [U.owner.id]);

  // the underlying tables stay owner-only: no user identity => no rows
  const direct = await pool.query('SELECT id FROM public.user_library WHERE user_id = ANY($1::uuid[])', [[U.owner.id, U.hidden.id]]);
  assert.equal(direct.rows.length, 0);
});

test('database: anon/authenticated roles have no access to the view', async () => {
  const { rows } = await admin.query(
    `SELECT grantee FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name = 'public_library_entries'
        AND grantee IN ('anon', 'authenticated', 'PUBLIC')`
  );
  assert.deepEqual(rows, []);
});
