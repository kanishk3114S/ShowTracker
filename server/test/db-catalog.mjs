/**
 * Database integration test for migration 002 (REAL database, uses the
 * MIGRATION/admin connection and then `SET ROLE showtracker_app` so the checks
 * run with the restricted role's privileges and RLS policies).
 *
 *   npm run test:db
 *
 * Test rows use a fake TMDB id and are deleted at the end.
 */
import dotenv from 'dotenv';
dotenv.config();

const { migrationPool, closePool } = await import('../src/config/database.js');
const { upsertMediaFromDetails } = await import('../src/services/mediaPersistence.service.js');

const TEST_ID = '999999991';
let passed = 0;
let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`PASSED  ${name}`);
    passed++;
  } catch (err) {
    console.log(`FAILED  ${name} — ${err.message}`);
    failed++;
  }
}
const expect = (c, m) => {
  if (!c) throw new Error(m);
};
async function expectError(fn, pattern) {
  try {
    await fn();
  } catch (err) {
    expect(pattern.test(err.message), `wrong error: ${err.message}`);
    return;
  }
  throw new Error('expected an error but none was thrown');
}

/**
 * A "db" for the persistence service. Prefers the restricted role (SET ROLE),
 * which Supabase's admin account may not be allowed to do. In that case it falls
 * back to the admin connection and the role-specific checks are reported BLOCKED.
 */
let canSetRole = null;
const restrictedDb = {
  async connect() {
    const client = await migrationPool.connect();
    if (canSetRole === null) {
      try {
        await client.query('SET ROLE showtracker_app');
        await client.query('RESET ROLE');
        canSetRole = true;
      } catch {
        canSetRole = false;
      }
    }
    if (canSetRole) {
      try {
        await client.query('SET ROLE showtracker_app');
      } catch (err) {
        client.release();
        throw err;
      }
      const release = client.release.bind(client);
      client.release = () => {
        client.query('RESET ROLE').finally(() => release());
      };
    }
    return client;
  }
};

const sample = (overrides = {}) => ({
  provider: 'TMDB',
  externalId: TEST_ID,
  mediaType: 'MOVIE',
  title: 'ShowTracker Test Movie',
  originalTitle: null,
  overview: 'Test overview',
  posterUrl: 'https://example.com/p.jpg',
  backdropUrl: null,
  releaseDate: '2024-01-01',
  releaseYear: 2024,
  genres: ['Action', 'Drama'],
  sourceRating: 7.5,
  sourceRatingName: 'TMDB',
  popularity: 12.5,
  runtimeMinutes: 100,
  ...overrides
});

async function cleanup() {
  await migrationPool.query(
    `DELETE FROM public.media_items WHERE id IN (
       SELECT media_id FROM public.media_sources WHERE provider='TMDB' AND external_id = $1)`,
    [TEST_ID]
  );
}

await cleanup();

console.log('--- Role / permissions ---');
await check('role showtracker_app is NOSUPERUSER + NOBYPASSRLS', async () => {
  const { rows } = await migrationPool.query(
    `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname='showtracker_app'`
  );
  expect(rows[0] && !rows[0].rolsuper && !rows[0].rolbypassrls, JSON.stringify(rows));
});
await check('RLS enabled on all four catalog tables', async () => {
  const { rows } = await migrationPool.query(
    `SELECT relname, relrowsecurity FROM pg_class
      WHERE relname IN ('media_items','media_sources','genres','media_genres') AND relnamespace='public'::regnamespace`
  );
  expect(rows.length === 4 && rows.every((r) => r.relrowsecurity), JSON.stringify(rows));
});
await check('anon and authenticated have NO access to catalog tables', async () => {
  const { rows } = await migrationPool.query(
    `SELECT grantee, table_name FROM information_schema.role_table_grants
      WHERE table_schema='public' AND table_name IN ('media_items','media_sources','genres','media_genres')
        AND grantee IN ('anon','authenticated','PUBLIC')`
  );
  expect(rows.length === 0, JSON.stringify(rows));
});
await check('showtracker_app grants: no DELETE on items/sources/genres, DML where needed', async () => {
  const priv = async (table, p) =>
    (await migrationPool.query('SELECT has_table_privilege($1, $2, $3) AS ok', ['showtracker_app', `public.${table}`, p])).rows[0].ok;
  expect(!(await priv('media_items', 'DELETE')), 'media_items DELETE granted');
  expect(!(await priv('media_sources', 'DELETE')), 'media_sources DELETE granted');
  expect(!(await priv('genres', 'DELETE')), 'genres DELETE granted');
  expect(!(await priv('genres', 'UPDATE')), 'genres UPDATE granted');
  expect(await priv('media_items', 'INSERT') && await priv('media_items', 'UPDATE') && await priv('media_items', 'SELECT'), 'media_items DML missing');
  expect(await priv('media_genres', 'DELETE') && await priv('media_genres', 'INSERT'), 'media_genres DML missing');
  expect(!(await priv('media_items', 'TRUNCATE')), 'TRUNCATE granted');
});

console.log('--- Constraints (as admin) ---');
const bad = (sql, params, pattern) => () => expectError(() => migrationPool.query(sql, params), pattern);
await check('invalid media_type rejected', bad(`INSERT INTO public.media_items (media_type,title) VALUES ('BOOK','x')`, [], /media_items_media_type_check/));
await check('blank title rejected', bad(`INSERT INTO public.media_items (media_type,title) VALUES ('MOVIE','   ')`, [], /media_items_title_not_empty_check/));
await check('rating > 10 rejected', bad(`INSERT INTO public.media_items (media_type,title,source_rating) VALUES ('MOVIE','x',10.5)`, [], /media_items_source_rating_range_check/));
await check('rating < 0 rejected', bad(`INSERT INTO public.media_items (media_type,title,source_rating) VALUES ('MOVIE','x',-1)`, [], /media_items_source_rating_range_check/));
await check('source with unknown media_id rejected (foreign key)', bad(
  `INSERT INTO public.media_sources (media_id,provider,provider_media_type,external_id) VALUES (gen_random_uuid(),'TMDB','MOVIE','1')`, [], /foreign key/i));
await check('genre names unique case-insensitively', async () => {
  await migrationPool.query(`INSERT INTO public.genres (name) VALUES ('zz_test_genre')`);
  try {
    await expectError(() => migrationPool.query(`INSERT INTO public.genres (name) VALUES ('ZZ_TEST_GENRE')`), /genres_name_lower_idx|duplicate/i);
  } finally {
    await migrationPool.query(`DELETE FROM public.genres WHERE LOWER(name)='zz_test_genre'`);
  }
});

console.log('--- Persistence service ---');
let firstId;
await check('first upsert creates item + source + genres', async () => {
  firstId = await upsertMediaFromDetails(sample(), restrictedDb);
  const { rows } = await migrationPool.query(
    `SELECT (SELECT count(*) FROM public.media_sources WHERE media_id=$1)::int AS sources,
            (SELECT count(*) FROM public.media_genres WHERE media_id=$1)::int AS genres`,
    [firstId]
  );
  expect(rows[0].sources === 1 && rows[0].genres === 2, JSON.stringify(rows[0]));
});
await check('second upsert returns same id, updates fields, adds no duplicates', async () => {
  const secondId = await upsertMediaFromDetails(sample({ title: 'Renamed Test Movie', genres: ['drama', 'Thriller'] }), restrictedDb);
  expect(secondId === firstId, 'id changed');
  const { rows } = await migrationPool.query(
    `SELECT mi.title,
            (SELECT count(*) FROM public.media_items WHERE id=$1)::int AS items,
            (SELECT count(*) FROM public.media_sources WHERE provider='TMDB' AND external_id=$2)::int AS sources,
            (SELECT array_agg(g.name ORDER BY g.name) FROM public.media_genres mg JOIN public.genres g ON g.id=mg.genre_id WHERE mg.media_id=$1) AS genres
       FROM public.media_items mi WHERE mi.id=$1`,
    [firstId, TEST_ID]
  );
  const r = rows[0];
  expect(r.title === 'Renamed Test Movie' && r.items === 1 && r.sources === 1, JSON.stringify(r));
  // "drama" must reuse the existing "Drama" genre (case-insensitive); "Action" link removed.
  expect(r.genres.length === 2 && r.genres.includes('Drama') && r.genres.includes('Thriller'), JSON.stringify(r.genres));
});
await check('same title, different provider id is NOT merged', async () => {
  const otherId = await upsertMediaFromDetails(sample({ externalId: '999999992' }), restrictedDb);
  expect(otherId !== firstId, 'records were merged');
  await migrationPool.query(`DELETE FROM public.media_items WHERE id=$1`, [otherId]);
});
await check('concurrent upserts of one title create one row', async () => {
  await cleanup();
  const ids = await Promise.all(Array.from({ length: 5 }, () => upsertMediaFromDetails(sample(), restrictedDb)));
  expect(new Set(ids).size === 1, `got ${new Set(ids).size} different ids`);
});

await restrictedDb.connect().then((c) => c.release());
console.log(canSetRole ? 'NOTE    persistence ran AS showtracker_app (RLS policies exercised)' : 'BLOCKED persistence ran as ADMIN: RLS policies for showtracker_app NOT exercised (set its password in DATABASE_URL and rerun)');
await cleanup();
// Genres created by the test are shared catalog data and may be reused by real titles; they are left in place.
await closePool();
console.log(`\nPASSED ${passed} | FAILED ${failed}`);
process.exit(failed ? 1 : 0);
