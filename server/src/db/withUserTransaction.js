import { pool } from '../config/database.js';

/**
 * Executes a callback within a transaction where PostgreSQL request claims
 * are set to the verified user's identity.
 * 
 * Sets transaction-local configuration:
 * 1. 'request.jwt.claim.sub' -> verifiedUserId
 * 2. 'request.jwt.claims' -> JSON string { sub: verifiedUserId, role: 'authenticated' }
 * 
 * Because the 3rd argument of set_config is `true`, these settings are strictly
 * local to the current transaction and are erased automatically on COMMIT or ROLLBACK.
 *
 * @template T
 * @param {string} verifiedUserId - The verified UUID from server-side token verification
 * @param {(client: import('pg').PoolClient) => Promise<T>} callback - Async function executing queries
 * @returns {Promise<T>}
 */
export async function withUserTransaction(verifiedUserId, callback) {
  if (!verifiedUserId) {
    throw new Error('withUserTransaction requires a verified user UUID.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    // Set transaction-local claims so auth.uid() resolves to verifiedUserId, plus
    // app.user_id as a fallback. One query (not three) saves two network round trips per request.
    await client.query(
      `SELECT set_config('request.jwt.claim.sub', $1, true),
              set_config('request.jwt.claims', $2, true),
              set_config('app.user_id', $1, true);`,
      [verifiedUserId, JSON.stringify({ sub: verifiedUserId, role: 'authenticated' })]
    );

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

export default withUserTransaction;
