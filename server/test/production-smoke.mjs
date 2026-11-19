/**
 * Production smoke test: health, security headers, CORS and rate limiting.
 *   node test/production-smoke.mjs
 * Needs DATABASE_URL for the database check; makes NO calls to AniList or TMDB
 * (limiter checks use requests the API rejects with 400 before any provider is contacted).
 */
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_FORCE = 'true'; // the limiter is off in tests unless forced
process.env.CLIENT_URL = 'https://showtracker.example.app';

import assert from 'node:assert/strict';
import request from 'supertest';

// Static imports are hoisted above the env assignments, so load the app dynamically after them.
const { default: app } = await import('../src/app.js');
const { closePool } = await import('../src/config/database.js');
const { mediaDiscoveryLimiter, usernameCheckLimiter, authLimiter } = await import('../src/middleware/rateLimit.js');

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ PASSED: ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ FAILED: ${name}\n   ${err.message}`);
    failed++;
  }
}

console.log('====================================================');
console.log('🏭 SHOWTRACKER PRODUCTION SMOKE TEST');
console.log('====================================================');

await test('GET /api/health is 200 with a connected database', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'healthy', `database status: ${JSON.stringify(res.body.services?.database)}`);
  assert.equal(res.body.services.database.status, 'connected');
});

await test('security headers: strict CSP, nosniff, HSTS, no framing, no x-powered-by', async () => {
  const res = await request(app).get('/api/health');
  const csp = res.headers['content-security-policy'] ?? '';
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  const hsts = res.headers['strict-transport-security'] ?? '';
  assert.match(hsts, /max-age=31536000/);
  assert.match(hsts, /includeSubDomains/);
  assert.match(hsts, /preload/);
  assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.equal(res.headers['x-frame-options'], 'DENY');
  assert.equal(res.headers['x-powered-by'], undefined);
});

await test('CORS: the configured client origin is allowed', async () => {
  const res = await request(app).get('/api/health').set('Origin', 'https://showtracker.example.app');
  assert.equal(res.headers['access-control-allow-origin'], 'https://showtracker.example.app');
  assert.equal(res.headers['access-control-allow-credentials'], 'true');
});

await test('CORS: an unknown origin gets no allow header', async () => {
  const res = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
  assert.equal(res.headers['access-control-allow-origin'], undefined);
});

await test('CORS preflight: only the declared methods and headers', async () => {
  const res = await request(app)
    .options('/api/library')
    .set('Origin', 'https://showtracker.example.app')
    .set('Access-Control-Request-Method', 'PATCH')
    .set('Access-Control-Request-Headers', 'authorization,content-type');
  assert.ok(res.status === 204 || res.status === 200);
  assert.match(res.headers['access-control-allow-methods'] ?? '', /PATCH/);
  assert.match((res.headers['access-control-allow-headers'] ?? '').toLowerCase(), /authorization/);
});

await test('rate limit: /api/media/search allows 60/min then answers 429 with Retry-After', async () => {
  mediaDiscoveryLimiter.reset();
  for (let i = 1; i <= 60; i++) {
    const res = await request(app).get('/api/media/search?q=a'); // 1 character: rejected locally, no provider call
    assert.notEqual(res.status, 429, `request ${i} was limited too early`);
  }
  const limited = await request(app).get('/api/media/search?q=a');
  assert.equal(limited.status, 429);
  assert.equal(limited.body.success, false);
  assert.equal(limited.body.error.code, 'RATE_LIMITED');
  assert.ok(Number(limited.headers['retry-after']) >= 1, 'Retry-After header missing');
  assert.equal(limited.headers['ratelimit-remaining'], '0');
  mediaDiscoveryLimiter.reset();
});

await test('rate limit: /api/media/trending shares the 60/min discovery quota', async () => {
  mediaDiscoveryLimiter.reset();
  for (let i = 0; i < 60; i++) await request(app).get('/api/media/search?q=a');
  const res = await request(app).get('/api/media/trending');
  assert.equal(res.status, 429);
  mediaDiscoveryLimiter.reset();
});

await test('rate limit: username-availability allows 30/min then answers 429', async () => {
  usernameCheckLimiter.reset();
  for (let i = 1; i <= 30; i++) {
    const res = await request(app).get('/api/profiles/username-availability');
    assert.notEqual(res.status, 429, `request ${i} was limited too early`);
  }
  const limited = await request(app).get('/api/profiles/username-availability');
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error.code, 'RATE_LIMITED');
  assert.ok(Number(limited.headers['retry-after']) >= 1);
  usernameCheckLimiter.reset();
});

await test('rate limit: /api/auth allows 60/min then answers 429 with Retry-After', async () => {
  authLimiter.reset();
  for (let i = 1; i <= 60; i++) {
    const res = await request(app).get('/api/auth/me'); // no token: 401 locally, no database or Supabase call
    assert.equal(res.status, 401, `request ${i}`);
  }
  const limited = await request(app).get('/api/auth/me');
  assert.equal(limited.status, 429);
  assert.equal(limited.body.error.code, 'RATE_LIMITED');
  assert.ok(Number(limited.headers['retry-after']) >= 1);
  authLimiter.reset();
});

await test('payload limit: bodies above 100 kB are refused with 413', async () => {
  const res = await request(app).post('/api/library/groups').set('Content-Type', 'application/json').send(JSON.stringify({ name: 'x'.repeat(150_000) }));
  assert.equal(res.status, 413);
  assert.equal(res.body.error.code, 'PAYLOAD_TOO_LARGE');
});

await test('rate limit: other routes are not affected (health still 200 while search is limited)', async () => {
  mediaDiscoveryLimiter.reset();
  for (let i = 0; i < 61; i++) await request(app).get('/api/media/search?q=a');
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  mediaDiscoveryLimiter.reset();
});

await closePool().catch(() => {});
console.log('====================================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('====================================================');
process.exit(failed ? 1 : 0);
