/**
 * Security hardening: text sanitizing, production error masking, payload limits, validation.
 * No database needed.
 */
process.env.NODE_ENV = 'test';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';

const { cleanText, cleanLine } = await import('../../src/utils/sanitize.js');
const { errorHandler, AppError } = await import('../../src/middleware/errorHandler.js');
const { updateProfileSchema } = await import('../../src/modules/profiles/profiles.validation.js');
const { createGroupSchema, updateGroupSchema } = await import('../../src/modules/library/groups.validation.js');
const { addLibrarySchema } = await import('../../src/modules/library/library.validation.js');
const { default: app } = await import('../../src/app.js');

// ------------------------------------------------------------- sanitizing ---

test('sanitize: tags and invisible/bidi characters are removed, ordinary text survives', () => {
  assert.equal(cleanLine('<b>Peak</b>   Shonen'), 'Peak Shonen');
  assert.equal(cleanLine('<script>alert(1)</script>Name'), 'alert(1)Name');
  assert.equal(cleanLine('<img src=x onerror=alert(1)>Hi'), 'Hi');
  assert.equal(cleanLine('<<b>script>evil'), 'evil', 'nested attempts cannot reassemble into a tag');
  assert.equal(cleanLine('I <3 anime & "quotes" > ok'), 'I <3 anime & "quotes" > ok', 'plain symbols are kept');
  assert.equal(cleanLine('ad\u202Emin\u200B'), 'admin', 'bidi override and zero-width characters are removed');
  assert.equal(cleanText('line one\nline two\t!'), 'line one\nline two\t!', 'line breaks survive in multi-line text');
  assert.equal(cleanText('a\u0000b\u0007c'), 'abc', 'control characters are removed');
});

test('validation: display name, bio, notes and group fields are sanitized before they are stored', () => {
  const p = updateProfileSchema.parse({ display_name: '  <b>Kani</b>\u200B shk ', bio: 'Loves <i>anime</i>\nand tea' });
  assert.equal(p.display_name, 'Kani shk');
  assert.equal(p.bio, 'Loves anime\nand tea');

  assert.equal(addLibrarySchema.parse({ mediaId: crypto.randomUUID(), notes: 'note <script>x</script>' }).notes, 'note x');

  const g = createGroupSchema.parse({ name: ' <u>Peak</u>  Shonen ', description: '<b>best</b> picks' });
  assert.equal(g.name, 'Peak Shonen');
  assert.equal(g.description, 'best picks');
  assert.equal(updateGroupSchema.parse({ name: '<i>Renamed</i>' }).name, 'Renamed');

  // length limits apply to the CLEANED text
  assert.throws(() => updateProfileSchema.parse({ display_name: 'x'.repeat(81) }));
  assert.throws(() => updateProfileSchema.parse({ bio: 'y'.repeat(301) }));
  assert.throws(() => createGroupSchema.parse({ name: '<b></b>   ' }), 'a name that is only markup is empty');
});

test('usernames: only a-z, 0-9 and underscore (no path tricks, no dots, no slashes)', () => {
  for (const bad of ['../admin', 'a/b', 'ab', 'x'.repeat(31), 'with space', 'dot.name', '<script>', 'a%2Fb']) {
    assert.throws(() => updateProfileSchema.parse({ username: bad }), bad);
  }
  assert.equal(updateProfileSchema.parse({ username: 'Valid_Name_9' }).username, 'valid_name_9');
});

// ---------------------------------------------------------- error masking ---

function appThatThrows(error) {
  const a = express();
  a.get('/boom', (req, res, next) => next(error));
  a.use(errorHandler);
  return a;
}

async function inProduction(fn) {
  const before = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    return await fn();
  } finally {
    process.env.NODE_ENV = before;
  }
}

test('production: database and unexpected errors never leak messages, codes, SQL, paths or stacks', async () => {
  const dbError = Object.assign(new Error('duplicate key value violates unique constraint "user_library_user_media_unique"'), {
    code: '23505',
    detail: 'Key (user_id, media_id)=(1, 2) already exists.',
    table: 'user_library'
  });
  const res = await inProduction(() => request(appThatThrows(dbError)).get('/boom'));
  assert.equal(res.status, 500);
  assert.deepEqual(res.body, { success: false, error: { message: 'An unexpected internal error occurred.', code: 'INTERNAL_SERVER_ERROR' } });
  const text = JSON.stringify(res.body);
  for (const leak of ['duplicate key', 'user_library', 'stack', '23505', 'C:\\', 'node_modules']) assert.ok(!text.includes(leak), leak);

  const bug = await inProduction(() => request(appThatThrows(new TypeError("Cannot read properties of undefined (reading 'id')"))).get('/boom'));
  assert.equal(bug.status, 500);
  assert.ok(!JSON.stringify(bug.body).includes('Cannot read'));
});

test('production: deliberate (operational) errors keep their clear message and code, still without a stack', async () => {
  const res = await inProduction(() => request(appThatThrows(new AppError('Library entry not found.', 404, 'LIBRARY_ENTRY_NOT_FOUND'))).get('/boom'));
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { success: false, error: { message: 'Library entry not found.', code: 'LIBRARY_ENTRY_NOT_FOUND' } });
});

test('development still shows the real message and stack for debugging', async () => {
  const before = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    const res = await request(appThatThrows(new Error('real reason'))).get('/boom');
    assert.equal(res.body.error.message, 'real reason');
    assert.ok(res.body.error.stack);
  } finally {
    process.env.NODE_ENV = before;
  }
});

// ----------------------------------------------------------- payload limits ---

test('payloads above 100 kB are refused with 413 PAYLOAD_TOO_LARGE; malformed JSON is a clean 400', async () => {
  const big = await request(app).post('/api/library/groups').set('Content-Type', 'application/json').send(JSON.stringify({ name: 'x'.repeat(150_000) }));
  assert.equal(big.status, 413);
  assert.equal(big.body.error.code, 'PAYLOAD_TOO_LARGE');
  assert.equal(big.body.success, false);

  const bad = await request(app).post('/api/library/groups').set('Content-Type', 'application/json').send('{"name": ');
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'INVALID_JSON');
});

test('payloads just under the limit are still accepted by the parser (then rejected by auth, not by size)', async () => {
  const ok = await request(app).post('/api/library/groups').set('Content-Type', 'application/json').send(JSON.stringify({ name: 'x'.repeat(50_000) }));
  assert.equal(ok.status, 401);
});
