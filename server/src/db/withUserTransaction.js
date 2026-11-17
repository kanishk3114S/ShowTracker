import { pool } from '../config/database.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Executes a callback within a transaction where PostgreSQL request claims
 * are set to the verified user's identity.
 *
 * Sets transaction-local configuration:
 * 1. 'request.jwt.claim.sub' -> verifiedUserId
 * 2. 'request.jwt.claims' -> JSON string { sub: verifiedUserId, role: 'authenticated' }
 * 3. 'app.user_id' -> verifiedUserId (fallback)
 *
 * Because the 3rd argument of set_config is `true`, these settings are strictly
 * local to the current transaction and are erased automatically on COMMIT or ROLLBACK.
 *
 * Speed: the database is remote, so every round trip costs ~0.3s.
 *  - BEGIN and the identity claims are sent together (one round trip, not three).
 *    The id is interpolated into the statement, so it is strictly validated as a UUID first.
 *  - `readOnly: true` callers get their result as soon as the query finishes; the closing
 *    COMMIT is queued on the same connection (so it still runs before that connection's next
 *    use) but is not awaited. A transaction that wrote data is ALWAYS awaited.
 *
 * @template T
 * @param {string} verifiedUserId - The verified UUID from server-side token verification
 * @param {(client: import('pg').PoolClient) => Promise<T>} callback - Async function executing queries
 * @param {{ readOnly?: boolean }} [options]
 * @returns {Promise<T>}
 */
export async function withUserTransaction(verifiedUserId, callback, { readOnly = false } = {}) {
  if (!verifiedUserId) {
    throw new Error('withUserTransaction requires a verified user UUID.');
  }
  const userId = String(verifiedUserId);
  if (!UUID_RE.test(userId)) {
    throw new Error('withUserTransaction requires a valid user UUID.');
  }

  const claims = JSON.stringify({ sub: userId, role: 'authenticated' });
  const client = await pool.connect();
  try {
    // Simple-query protocol: both statements travel in a single round trip.
    await client.query(
      `BEGIN; SELECT set_config('request.jwt.claim.sub', '${userId}', true), ` +
        `set_config('request.jwt.claims', '${claims}', true), ` +
        `set_config('app.user_id', '${userId}', true);`
    );

    const result = await callback(client);

    if (readOnly) {
      // Not awaited: it executes in order on this connection before anything else can use it.
      client.query('COMMIT;').catch(() => {});
    } else {
      await client.query('COMMIT;');
    }
    return result;
  } catch (err) {
    await client.query('ROLLBACK;').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export default withUserTransaction;
