/**
 * Custom library groups (migration 008): CRUD, many-to-many membership, library
 * filtering by group, and Row Level Security isolation between users.
 *
 * REAL: Express routes/controllers/services, SQL, transactions and the database,
 * accessed as the restricted `showtracker_app` role (RLS on).
 * SUBSTITUTED: authentication only - tests send `x-test-user` through the router's
 * injectable `auth` hook, exactly like library.test.js.
 *
 * Disposable users and "ZZTEST G" titles are created via the admin connection and removed at the end.
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
const { default: realApp } = await import('../src/app.js');

const admin = migrationPool;
const userA = crypto.randomUUID();
const userB = crypto.randomUUID();
const ids = {};

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

async function insertMedia(title, mediaType, externalId) {
  const { rows } = await admin.query(
    `INSERT INTO public.media_items (media_type, title) VALUES ($1, $2) RETURNING id`,
    [mediaType, title]
  );
  await admin.query(
    `INSERT INTO public.media_sources (media_id, provider, provider_media_type, external_id) VALUES ($1, 'TMDB', $2, $3)`,
    [rows[0].id, mediaType, externalId]
  );
  return rows[0].id;
}

async function cleanup() {
  await admin.query(`DELETE FROM auth.users WHERE id = ANY($1::uuid[]) OR email LIKE 'zztest-grp-%@example.invalid'`, [
    [userA, userB]
  ]);
  await admin.query(`DELETE FROM public.media_items WHERE title LIKE 'ZZTEST G %'`);
}

before(async () => {
  await cleanup();
  for (const [id, label] of [[userA, 'a'], [userB, 'b']]) {
    await admin.query(
      `INSERT INTO auth.users (id, aud, role, email) VALUES ($1, 'authenticated', 'authenticated', $2)`,
      [id, `zztest-grp-${label}-${id.slice(0, 8)}@example.invalid`]
    );
  }
  ids.m1 = await insertMedia('ZZTEST G One', 'ANIME', '991000001');
  ids.m2 = await insertMedia('ZZTEST G Two', 'TV', '991000002');
  ids.m3 = await insertMedia('ZZTEST G Three', 'MOVIE', '991000003');

  // user A owns three library entries, user B owns one
  for (const [key, mediaId] of [['a1', ids.m1], ['a2', ids.m2], ['a3', ids.m3]]) {
    const res = await api('post', '', userA, { mediaId, status: 'PLAN_TO_WATCH' });
    assert.equal(res.status, 201);
    ids[key] = res.body.data.id;
  }
  const b = await api('post', '', userB, { mediaId: ids.m1, status: 'WATCHING' });
  assert.equal(b.status, 201);
  ids.b1 = b.body.data.id;
});

after(async () => {
  await cleanup();
  await closePool();
});

// ------------------------------------------------------------------ schema ---

test('schema: both tables have ROW LEVEL SECURITY enabled AND forced', async () => {
  const { rows } = await admin.query(
    `SELECT relname, relrowsecurity, relforcerowsecurity
       FROM pg_class
      WHERE relname IN ('library_groups', 'library_group_items') AND relkind = 'r'
      ORDER BY relname`
  );
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.equal(r.relrowsecurity, true, `${r.relname} RLS enabled`);
    assert.equal(r.relforcerowsecurity, true, `${r.relname} RLS forced`);
  }
});

test('schema: permissions - app role cannot UPDATE links; anon/authenticated have nothing', async () => {
  const q = async (role, table, priv) =>
    (await admin.query('SELECT has_table_privilege($1, $2, $3) AS ok', [role, `public.${table}`, priv])).rows[0].ok;
  assert.equal(await q('showtracker_app', 'library_group_items', 'UPDATE'), false);
  assert.equal(await q('showtracker_app', 'library_group_items', 'INSERT'), true);
  assert.equal(await q('showtracker_app', 'library_groups', 'UPDATE'), true);
  for (const role of ['anon', 'authenticated']) {
    for (const table of ['library_groups', 'library_group_items']) {
      for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
        assert.equal(await q(role, table, priv), false, `${role} must not ${priv} ${table}`);
      }
    }
  }
});

test('schema: a case-insensitive unique index and the many-to-many primary key exist', async () => {
  const { rows } = await admin.query(
    `SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename IN ('library_groups', 'library_group_items')`
  );
  const defs = rows.map((r) => r.indexdef.toLowerCase()).join('\n');
  assert.match(defs, /unique index.*library_groups.*user_id, lower\(name\)/);
  assert.match(defs, /library_group_items_entry_idx/);
  assert.match(defs, /library_group_items_pkey/);
});

// ---------------------------------------------------------------------- API ---

test('real app: group routes require authentication', async () => {
  for (const [method, path] of [['get', '/api/library/groups'], ['post', '/api/library/groups']]) {
    const res = await request(realApp)[method](path);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'AUTH_REQUIRED');
  }
});

test('create / list / rename / recolor / delete a group', async () => {
  const created = await api('post', '/groups', userA, { name: '  Watched   in 2026 ', description: ' my year ', color: 'rose' });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.name, 'Watched in 2026', 'whitespace is normalized');
  assert.equal(created.body.data.description, 'my year');
  assert.equal(created.body.data.color, 'rose');
  assert.equal(created.body.data.itemCount, 0);
  ids.gYear = created.body.data.id;

  const defaults = await api('post', '/groups', userA, { name: 'Peak Shonen' });
  assert.equal(defaults.status, 201);
  assert.equal(defaults.body.data.color, 'amber');
  assert.equal(defaults.body.data.description, null);
  ids.gShonen = defaults.body.data.id;

  const list = await api('get', '/groups', userA);
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.data.map((g) => g.name), ['Watched in 2026', 'Peak Shonen'], 'oldest first');

  const renamed = await api('patch', `/groups/${ids.gYear}`, userA, { name: 'Watched in 2027', description: null, color: 'cyan' });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.data.name, 'Watched in 2027');
  assert.equal(renamed.body.data.description, null);
  assert.equal(renamed.body.data.color, 'cyan');

  const temp = await api('post', '/groups', userA, { name: 'Temp' });
  const del = await api('delete', `/groups/${temp.body.data.id}`, userA);
  assert.equal(del.status, 200);
  assert.equal((await api('delete', `/groups/${temp.body.data.id}`, userA)).status, 404, 'already gone');
  assert.deepEqual((await api('get', '/groups', userA)).body.data.map((g) => g.name), ['Watched in 2027', 'Peak Shonen']);
});

test('validation: empty/long names, bad colors, empty patch and bad ids are rejected', async () => {
  for (const body of [{}, { name: '   ' }, { name: 'x'.repeat(61) }, { name: 'ok', color: 'neon' }, { name: 'ok', description: 'd'.repeat(201) }]) {
    const res = await api('post', '/groups', userA, body);
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 40));
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  }
  assert.equal((await api('patch', `/groups/${ids.gShonen}`, userA, {})).status, 400);
  assert.equal((await api('patch', '/groups/not-a-uuid', userA, { name: 'x' })).status, 400);
  assert.equal((await api('post', `/groups/${ids.gShonen}/items`, userA, { libraryEntryId: 'nope' })).status, 400);
});

test('names are unique per user, case-insensitively (409), but another user may reuse them', async () => {
  const dup = await api('post', '/groups', userA, { name: 'peak SHONEN' });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, 'GROUP_NAME_TAKEN');

  const clash = await api('patch', `/groups/${ids.gYear}`, userA, { name: 'PEAK shonen' });
  assert.equal(clash.status, 409);
  assert.equal((await api('get', '/groups', userA)).body.data.find((g) => g.id === ids.gYear).name, 'Watched in 2027', 'unchanged');

  const other = await api('post', '/groups', userB, { name: 'Peak Shonen' });
  assert.equal(other.status, 201, 'user B can use the same name');
  ids.bGroup = other.body.data.id;
});

test('many-to-many: one title on several shelves, several titles on one shelf', async () => {
  const add = (group, entry, user = userA) => api('post', `/groups/${group}/items`, user, { libraryEntryId: entry });

  const first = await add(ids.gShonen, ids.a1);
  assert.equal(first.status, 201);
  assert.equal(first.body.data.added, true);
  assert.equal(first.body.data.group.itemCount, 1);

  assert.equal((await add(ids.gYear, ids.a1)).body.data.added, true, 'the same title joins a second shelf');
  assert.equal((await add(ids.gYear, ids.a2)).body.data.group.itemCount, 2);

  const again = await add(ids.gShonen, ids.a1);
  assert.equal(again.status, 201);
  assert.equal(again.body.data.added, false, 'adding twice is idempotent');
  assert.equal(again.body.data.group.itemCount, 1);

  const memberships = await api('get', `/items/${ids.a1}/groups`, userA);
  assert.equal(memberships.status, 200);
  assert.deepEqual([...memberships.body.data.groupIds].sort(), [ids.gShonen, ids.gYear].sort());
  assert.deepEqual((await api('get', `/items/${ids.a3}/groups`, userA)).body.data.groupIds, []);

  const counts = Object.fromEntries((await api('get', '/groups', userA)).body.data.map((g) => [g.id, g.itemCount]));
  assert.equal(counts[ids.gShonen], 1);
  assert.equal(counts[ids.gYear], 2);
});

test('removing from one shelf keeps the other shelf and the library entry', async () => {
  const rm = await api('delete', `/groups/${ids.gShonen}/items/${ids.a1}`, userA);
  assert.equal(rm.status, 200);
  assert.equal(rm.body.data.removed, true);
  assert.equal(rm.body.data.group.itemCount, 0);
  assert.deepEqual((await api('get', `/items/${ids.a1}/groups`, userA)).body.data.groupIds, [ids.gYear]);

  const again = await api('delete', `/groups/${ids.gShonen}/items/${ids.a1}`, userA);
  assert.equal(again.status, 200);
  assert.equal(again.body.data.removed, false, 'removing a non-member is a harmless no-op');

  const library = await api('get', '', userA);
  assert.equal(library.body.data.length, 3, 'no title was removed from the library');
});

test('library list can be filtered by group', async () => {
  const inYear = await api('get', `?groupId=${ids.gYear}`, userA);
  assert.equal(inYear.status, 200);
  assert.deepEqual(inYear.body.data.map((e) => e.id).sort(), [ids.a1, ids.a2].sort());

  const emptyShelf = await api('get', `?groupId=${ids.gShonen}`, userA);
  assert.deepEqual(emptyShelf.body.data, []);

  const combined = await api('get', `?groupId=${ids.gYear}&mediaType=TV`, userA);
  assert.deepEqual(combined.body.data.map((e) => e.id), [ids.a2], 'group combines with the other filters');

  assert.equal((await api('get', '?groupId=garbage', userA)).status, 400);
});

test('deleting a library entry removes it from every shelf; deleting a shelf keeps the library', async () => {
  await api('post', `/groups/${ids.gShonen}/items`, userA, { libraryEntryId: ids.a3 });
  await api('post', `/groups/${ids.gYear}/items`, userA, { libraryEntryId: ids.a3 });
  assert.equal((await api('delete', `/${ids.a3}`, userA)).status, 200);
  const counts = Object.fromEntries((await api('get', '/groups', userA)).body.data.map((g) => [g.id, g.itemCount]));
  assert.equal(counts[ids.gShonen], 0);
  assert.equal(counts[ids.gYear], 2);

  assert.equal((await api('delete', `/groups/${ids.gYear}`, userA)).status, 200);
  const library = await api('get', '', userA);
  assert.deepEqual(library.body.data.map((e) => e.id).sort(), [ids.a1, ids.a2].sort(), 'titles survive the shelf');
  const links = await admin.query('SELECT COUNT(*)::int AS n FROM public.library_group_items WHERE group_id = $1', [ids.gYear]);
  assert.equal(links.rows[0].n, 0, 'links are gone with the shelf');
});

test('limit: at most 50 groups per user (409)', async () => {
  await admin.query(
    `INSERT INTO public.library_groups (user_id, name)
     SELECT $1, 'ZZ bulk ' || g FROM generate_series(1, 60) g
      WHERE (SELECT COUNT(*) FROM public.library_groups WHERE user_id = $1) + g <= 50`,
    [userA]
  );
  const res = await api('post', '/groups', userA, { name: 'One too many' });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, 'GROUP_LIMIT_REACHED');
  await admin.query(`DELETE FROM public.library_groups WHERE user_id = $1 AND name LIKE 'ZZ bulk %'`, [userA]);
});

// ---------------------------------------------------------------- isolation ---

test('isolation: user B cannot see, rename, delete or fill user A\'s group (404, nothing changed)', async () => {
  const mine = await api('post', '/groups', userA, { name: 'Private shelf' });
  const g = mine.body.data.id;
  await api('post', `/groups/${g}/items`, userA, { libraryEntryId: ids.a1 });

  assert.deepEqual((await api('get', '/groups', userB)).body.data.map((x) => x.name), ['Peak Shonen'], 'B sees only B\'s own group');
  assert.equal((await api('patch', `/groups/${g}`, userB, { name: 'Hacked' })).status, 404);
  assert.equal((await api('delete', `/groups/${g}`, userB)).status, 404);
  assert.equal((await api('post', `/groups/${g}/items`, userB, { libraryEntryId: ids.b1 })).status, 404);
  assert.equal((await api('delete', `/groups/${g}/items/${ids.a1}`, userB)).status, 404);
  assert.equal((await api('get', `?groupId=${g}`, userB)).body.data.length, 0, 'filtering by A\'s group leaks nothing');

  const still = (await api('get', '/groups', userA)).body.data.find((x) => x.id === g);
  assert.equal(still.name, 'Private shelf');
  assert.equal(still.itemCount, 1);
});

test('isolation: nobody can attach another user\'s library entry to a group, or read its memberships', async () => {
  assert.equal((await api('post', `/groups/${ids.bGroup}/items`, userB, { libraryEntryId: ids.a1 })).status, 404, 'B cannot add A\'s entry to B\'s group');
  assert.equal((await api('post', `/groups/${ids.gShonen}/items`, userB, { libraryEntryId: ids.b1 })).status, 404, 'B cannot add B\'s entry to A\'s group');
  assert.equal((await api('get', `/items/${ids.a1}/groups`, userB)).status, 404);
});

test('isolation (database level): RLS blocks cross-user reads, writes and forged links even with raw SQL', async () => {
  // user B, raw SQL: sees none of A's rows
  const seen = await withUserTransaction(userB, (c) => c.query('SELECT COUNT(*)::int AS n FROM public.library_groups WHERE user_id = $1', [userA]), { readOnly: true });
  assert.equal(seen.rows[0].n, 0);
  const links = await withUserTransaction(userB, (c) => c.query('SELECT COUNT(*)::int AS n FROM public.library_group_items'), { readOnly: true });
  const ownLinks = await admin.query(
    `SELECT COUNT(*)::int AS n FROM public.library_group_items i JOIN public.library_groups g ON g.id = i.group_id WHERE g.user_id = $1`,
    [userB]
  );
  assert.equal(links.rows[0].n, ownLinks.rows[0].n, 'B sees only links of B\'s own groups');

  // B cannot rename / delete A's group via raw SQL (0 rows affected)
  const upd = await withUserTransaction(userB, (c) => c.query(`UPDATE public.library_groups SET name = 'pwned' WHERE user_id = $1`, [userA]));
  assert.equal(upd.rowCount, 0);
  const del = await withUserTransaction(userB, (c) => c.query('DELETE FROM public.library_groups WHERE user_id = $1', [userA]));
  assert.equal(del.rowCount, 0);

  // B cannot insert a group owned by A, nor a link to A's group / A's entry
  await assert.rejects(
    withUserTransaction(userB, (c) => c.query(`INSERT INTO public.library_groups (user_id, name) VALUES ($1, 'forged')`, [userA])),
    /row-level security/i
  );
  const aGroup = (await admin.query('SELECT id FROM public.library_groups WHERE user_id = $1 LIMIT 1', [userA])).rows[0].id;
  await assert.rejects(
    withUserTransaction(userB, (c) => c.query('INSERT INTO public.library_group_items (group_id, library_entry_id) VALUES ($1, $2)', [aGroup, ids.b1])),
    /row-level security/i,
    'link into A\'s group'
  );
  await assert.rejects(
    withUserTransaction(userB, (c) => c.query('INSERT INTO public.library_group_items (group_id, library_entry_id) VALUES ($1, $2)', [ids.bGroup, ids.a1])),
    /row-level security/i,
    'A\'s entry into B\'s own group'
  );

  // A's data is exactly as it was
  const check = await admin.query(`SELECT COUNT(*)::int AS n FROM public.library_groups WHERE user_id = $1 AND name = 'pwned'`, [userA]);
  assert.equal(check.rows[0].n, 0);
});

test('isolation: deleting a user removes their groups (cascade) and nothing of anyone else', async () => {
  const before = (await admin.query('SELECT COUNT(*)::int AS n FROM public.library_groups WHERE user_id = $1', [userB])).rows[0].n;
  assert.ok(before >= 1);
  const aBefore = (await admin.query('SELECT COUNT(*)::int AS n FROM public.library_groups WHERE user_id = $1', [userA])).rows[0].n;
  await admin.query('DELETE FROM auth.users WHERE id = $1', [userB]);
  assert.equal((await admin.query('SELECT COUNT(*)::int AS n FROM public.library_groups WHERE user_id = $1', [userB])).rows[0].n, 0);
  assert.equal((await admin.query('SELECT COUNT(*)::int AS n FROM public.library_groups WHERE user_id = $1', [userA])).rows[0].n, aBefore);
  assert.ok(pool);
});
