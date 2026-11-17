import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING SHOWTRACKER API AUTOMATED TESTS');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ PASSED: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAILED: ${name}`);
      console.error(err);
      failed++;
    }
  }

  // 1. Health Endpoint
  await test('GET /api/health returns 200 with valid schema', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.services);
    assert.equal(res.body.services.server.status, 'healthy');
  });

  // 2. Auth Protection: Missing Token
  await test('GET /api/auth/me returns 401 when token is missing', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'AUTH_REQUIRED');
  });

  // 3. Auth Protection: Malformed Token
  await test('GET /api/auth/me returns 401 when token is invalid/malformed', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid_test_token_123');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'TOKEN_EXPIRED_OR_INVALID');
  });

  // 4. Auth Protection: PATCH /api/profiles/me
  await test('PATCH /api/profiles/me returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .patch('/api/profiles/me')
      .send({ display_name: 'Hacker' });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'AUTH_REQUIRED');
  });

  // 5. Username Availability: Valid format
  await test('GET /api/profiles/username-availability accepts valid format', async () => {
    const res = await request(app)
      .get('/api/profiles/username-availability')
      .query({ username: 'valid_tracker_user' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.username, 'valid_tracker_user');
  });

  // 6. Username Availability: Invalid format rejection
  await test('GET /api/profiles/username-availability rejects invalid short username', async () => {
    const res = await request(app)
      .get('/api/profiles/username-availability')
      .query({ username: 'ab' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.available, false);
    assert.ok(res.body.reason);
  });

  // 7. Public Profile: Nonexistent user returns 404
  await test('GET /api/users/:username returns 404 for nonexistent user', async () => {
    const res = await request(app).get('/api/users/nonexistent_phantom_user_xyz_999');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'USER_NOT_FOUND');
  });

  // 8. 404 Undefined Route Handler
  await test('GET /api/nonexistent-route returns structured 404 JSON', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  console.log('====================================================');
  console.log(`Summary: ${passed} passed, ${failed} failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
