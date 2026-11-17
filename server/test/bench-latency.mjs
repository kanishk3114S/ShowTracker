/**
 * Latency benchmark for the user-scoped transaction helper against the REAL database.
 * Not part of `npm test`.   node test/bench-latency.mjs
 *
 * Compares the previous implementation (separate BEGIN, three set_config calls, awaited
 * COMMIT = 5 round trips for a one-query read) with the current withUserTransaction().
 */
import dotenv from 'dotenv';
dotenv.config();

const { pool, warmPool, closePool } = await import('../src/config/database.js');
const { withUserTransaction } = await import('../src/db/withUserTransaction.js');

const userId = '00000000-0000-4000-8000-000000000001';
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const time = async (fn) => {
  const t = performance.now();
  await fn();
  return performance.now() - t;
};

/** The previous implementation, kept here only for comparison. */
async function legacyTransaction(id, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    await client.query("SELECT set_config('request.jwt.claim.sub', $1, true);", [id]);
    await client.query("SELECT set_config('request.jwt.claims', $1, true);", [JSON.stringify({ sub: id, role: 'authenticated' })]);
    await client.query("SELECT set_config('app.user_id', $1, true);", [id]);
    const result = await callback(client);
    await client.query('COMMIT;');
    return result;
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}

const coldMs = await time(() => pool.query('SELECT 1'));
await warmPool(3);
const rtt = median(await Promise.all(Array.from({ length: 5 }, () => time(() => pool.query('SELECT 1')))));

const run = async (label, fn, n = 7) => {
  const samples = [];
  for (let i = 0; i < n; i++) samples.push(await time(fn));
  console.log(`${label.padEnd(46)} median ${Math.round(median(samples))} ms`);
  return median(samples);
};

console.log(`first connection (cold): ${Math.round(coldMs)} ms   | one round trip: ~${Math.round(rtt)} ms\n`);
const before = await run('BEFORE  one-query read  (5 round trips)', () => legacyTransaction(userId, (c) => c.query('SELECT 1')));
const afterWrite = await run('AFTER   write transaction (3 round trips)', () => withUserTransaction(userId, (c) => c.query('SELECT 1')));
const afterRead = await run('AFTER   read-only          (2 round trips)', () => withUserTransaction(userId, (c) => c.query('SELECT 1'), { readOnly: true }));
console.log(`\nread requests are ${(before / afterRead).toFixed(1)}x faster; writes ${(before / afterWrite).toFixed(1)}x faster`);
await closePool();
