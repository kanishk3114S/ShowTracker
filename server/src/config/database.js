import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;

const appConnectionString = process.env.DATABASE_URL;
const migrationConnectionString = process.env.MIGRATION_DATABASE_URL || appConnectionString;

function createPoolConfig(connStr) {
  if (!connStr) return null;
  const isLocalhost = Boolean(
    connStr.includes('localhost') || connStr.includes('127.0.0.1')
  );

  // Strip sslmode query param so pg-connection-string does not force verify-full
  let cleanConnStr = connStr;
  if (!isLocalhost && cleanConnStr.includes('sslmode=')) {
    cleanConnStr = cleanConnStr.replace(/[?&]sslmode=[^&]+/, '');
  }

  const config = {
    connectionString: cleanConnStr,
    max: 10,
    // Opening a connection to the (remote) database costs ~2s, so keep a few warm:
    // connections up to `min` are never closed for being idle, TCP keep-alive stops
    // NATs/poolers silently dropping them, and warmPool() opens them at startup.
    min: 3,
    // Warm idle connections must not keep a short-lived script (tests, migrations) from exiting;
    // the HTTP server keeps the real backend process alive on its own.
    allowExitOnIdle: true,
    idleTimeoutMillis: 10 * 60 * 1000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    connectionTimeoutMillis: 10000
  };

  if (!isLocalhost) {
    config.ssl = {
      rejectUnauthorized: false
    };
  }

  return config;
}

// Runtime application pool (intended for showtracker_app role)
export const pool = new Pool(createPoolConfig(appConnectionString) || {});

pool.on('error', (err) => {
  console.error('[PostgreSQL App Pool Error]:', err.message);
});

// Migration pool (intended for administrative / DDL operations)
export const migrationPool = migrationConnectionString !== appConnectionString
  ? new Pool(createPoolConfig(migrationConnectionString) || {})
  : pool;

if (migrationPool !== pool) {
  migrationPool.on('error', (err) => {
    console.error('[PostgreSQL Migration Pool Error]:', err.message);
  });
}

/**
 * Execute parameterized query using the runtime pool.
 */
export const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SQL Query] ${duration}ms | rows: ${res.rowCount} | query: ${text.trim().split('\n')[0]}`);
  }
  return res;
};

/**
 * Safe database health check executing SELECT NOW().
 */
export const checkDatabaseConnection = async () => {
  if (!appConnectionString) {
    return {
      ok: false,
      error: 'DATABASE_URL environment variable is not defined.'
    };
  }

  try {
    const result = await pool.query(
      'SELECT NOW() AS current_time, current_database() AS database_name, current_user AS database_user, current_schema() AS current_schema;'
    );
    const row = result.rows[0];
    return {
      ok: true,
      time: row.current_time,
      database: row.database_name,
      user: row.database_user,
      schema: row.current_schema
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message || err.code || (err ? String(err) : 'Failed to connect to PostgreSQL server')
    };
  }
};

/**
 * Opens `count` connections at once and returns them to the pool, so the first
 * real requests do not each pay the cold-connection cost.
 */
export const warmPool = async (count = 3) => {
  if (!appConnectionString) return 0;
  const clients = await Promise.allSettled(Array.from({ length: count }, () => pool.connect()));
  let opened = 0;
  for (const outcome of clients) {
    if (outcome.status === 'fulfilled') {
      opened += 1;
      outcome.value.release();
    }
  }
  return opened;
};

let keepAliveTimer = null;
/** Pings the warm connections every few minutes so they stay open between bursts of use. */
export const startPoolKeepAlive = (everyMs = 4 * 60 * 1000, count = 3) => {
  if (keepAliveTimer || !appConnectionString) return;
  keepAliveTimer = setInterval(() => {
    Promise.allSettled(
      Array.from({ length: count }, async () => {
        const client = await pool.connect();
        try {
          await client.query('SELECT 1');
        } finally {
          client.release();
        }
      })
    ).catch(() => {});
  }, everyMs);
  keepAliveTimer.unref();
};

/**
 * Gracefully close pools upon server termination.
 */
export const closePool = async () => {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  await pool.end();
  if (migrationPool !== pool) {
    await migrationPool.end();
  }
  console.log('[PostgreSQL] Connection pools closed.');
};

export default {
  pool,
  migrationPool,
  query,
  checkDatabaseConnection,
  warmPool,
  startPoolKeepAlive,
  closePool
};
