/**
 * LIVE provider smoke test. Hits the REAL AniList and TMDB APIs (and the real
 * database for catalog persistence). Not part of `npm test` because it needs
 * network access and credentials and is not repeatable.
 *
 *   npm run test:live
 *
 * TMDB checks are reported as SKIPPED when TMDB_API_READ_ACCESS_TOKEN is not set.
 */
import dotenv from 'dotenv';
dotenv.config();
process.env.NODE_ENV = 'test';

const { default: request } = await import('supertest');
const { default: app } = await import('../src/app.js');
const { closePool, pool } = await import('../src/config/database.js');

const results = [];
const record = (name, status, detail = '') => {
  results.push({ name, status });
  console.log(`${status.padEnd(7)} ${name}${detail ? ` — ${detail}` : ''}`);
};
async function check(name, fn) {
  try {
    const detail = await fn();
    record(name, 'PASSED', detail);
  } catch (err) {
    record(name, 'FAILED', err.message);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const hasTmdb = Boolean(process.env.TMDB_API_READ_ACCESS_TOKEN) && process.env.TMDB_API_READ_ACCESS_TOKEN !== 'replace_me';
const skipTmdb = (name) => record(name, 'SKIPPED', 'TMDB_API_READ_ACCESS_TOKEN not set');

console.log('--- LIVE AniList ---');
let animeId;
await check('AniList search "attack on titan"', async () => {
  const r = await request(app).get('/api/media/search?q=attack on titan&type=ANIME');
  expect(r.status === 200, `HTTP ${r.status}`);
  const g = r.body.data.groups[0];
  expect(g.results.length > 0, 'no results');
  animeId = g.results[0].externalId;
  return `${g.results.length} results, first: ${g.results[0].title} (rating ${g.results[0].sourceRating})`;
});
await check('AniList trending', async () => {
  const r = await request(app).get('/api/media/trending?type=ANIME');
  expect(r.status === 200 && r.body.data.groups[0].results.length > 0, `HTTP ${r.status}`);
  return r.body.data.groups[0].label;
});
await check('AniList genres', async () => {
  const r = await request(app).get('/api/media/genres?type=ANIME');
  expect(r.status === 200 && r.body.data.genres.length > 5, `HTTP ${r.status}`);
  return `${r.body.data.genres.length} genres`;
});
await check('AniList details + catalog persistence (twice, no duplicates)', async () => {
  const url = `/api/media/details/ANILIST/ANIME/${animeId}`;
  const a = await request(app).get(`${url}?refresh=1`);
  const b = await request(app).get(`${url}?refresh=1`);
  expect(a.status === 200 && b.status === 200, `HTTP ${a.status}/${b.status}`);
  expect(a.body.data.catalogId, 'catalogId missing (persistence failed)');
  expect(a.body.data.catalogId === b.body.data.catalogId, 'catalogId changed between requests');
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM public.media_sources WHERE provider='ANILIST' AND provider_media_type='ANIME' AND external_id=$1`,
    [animeId]
  );
  expect(rows[0].n === 1, `expected 1 media_sources row, got ${rows[0].n}`);
  const who = await pool.query('SELECT current_user AS u');
  return `1 source row; db role: ${who.rows[0].u}`;
});
await check('AniList missing id -> 404', async () => {
  const r = await request(app).get('/api/media/details/ANILIST/ANIME/99999999');
  expect(r.status === 404, `HTTP ${r.status}`);
});

console.log('--- LIVE TMDB ---');
if (!hasTmdb) {
  [
    'TMDB search movies',
    'TMDB search TV',
    'TMDB movie details',
    'TMDB TV details',
    'TMDB trending day/week'
  ].forEach(skipTmdb);
} else {
  let movieId;
  let tvId;
  await check('TMDB search movies', async () => {
    const r = await request(app).get('/api/media/search?q=inception&type=MOVIE');
    expect(r.status === 200 && r.body.data.groups[0].results.length > 0, `HTTP ${r.status} ${r.body?.error?.code}`);
    movieId = r.body.data.groups[0].results[0].externalId;
    return r.body.data.groups[0].results[0].title;
  });
  await check('TMDB search TV', async () => {
    const r = await request(app).get('/api/media/search?q=breaking bad&type=TV');
    expect(r.status === 200 && r.body.data.groups[0].results.length > 0, `HTTP ${r.status}`);
    tvId = r.body.data.groups[0].results[0].externalId;
    return r.body.data.groups[0].results[0].title;
  });
  await check('TMDB movie details', async () => {
    const r = await request(app).get(`/api/media/details/TMDB/MOVIE/${movieId}`);
    expect(r.status === 200 && r.body.data.runtimeMinutes, `HTTP ${r.status}`);
    return `${r.body.data.title}, ${r.body.data.runtimeMinutes} min`;
  });
  await check('TMDB TV details', async () => {
    const r = await request(app).get(`/api/media/details/TMDB/TV/${tvId}`);
    expect(r.status === 200 && r.body.data.totalSeasons, `HTTP ${r.status}`);
    return `${r.body.data.title}, ${r.body.data.totalSeasons} seasons`;
  });
  await check('TMDB trending day + week', async () => {
    for (const w of ['day', 'week']) {
      const r = await request(app).get(`/api/media/trending?type=ALL&window=${w}`);
      expect(r.status === 200, `HTTP ${r.status}`);
      for (const g of r.body.data.groups) expect(!g.error && g.results.length > 0, `${g.mediaType}/${w}: ${g.error?.code}`);
    }
  });
}

await closePool();
const failed = results.filter((r) => r.status === 'FAILED').length;
console.log(
  `\nPASSED ${results.filter((r) => r.status === 'PASSED').length} | FAILED ${failed} | SKIPPED ${results.filter((r) => r.status === 'SKIPPED').length}`
);
process.exit(failed ? 1 : 0);
