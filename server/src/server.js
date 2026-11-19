import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import app from './app.js';
import { checkDatabaseConnection, closePool, warmPool, startPoolKeepAlive } from './config/database.js';
import * as tmdb from './providers/tmdb.provider.js';

const PORT = parseInt(process.env.PORT || '5000', 10);

// Browsers only talk to this API from the origins in CLIENT_URL. Forgetting it in production is the most common
// reason a deployed frontend loads but shows no data (every request is blocked by CORS), so say so loudly.
if (process.env.NODE_ENV === 'production' && !/^https:\/\//i.test(process.env.CLIENT_URL || '')) {
  console.warn('⚠️  CLIENT_URL is not set to the https:// address of your frontend. Browsers will block every API call (CORS).');
}

const server = app.listen(PORT, async () => {
  console.log('====================================================');
  console.log(`🎬 ShowTracker Backend API running on port ${PORT}`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
  console.log('====================================================');

  // Test database connection on startup
  console.log('🔍 Testing PostgreSQL connection...');
  const dbStatus = await checkDatabaseConnection();
  if (dbStatus.ok) {
    console.log(`✅ PostgreSQL Connected successfully!`);
    console.log(`   - Current Server Time (UTC): ${dbStatus.time}`);
    console.log(`   - Connected Database: ${dbStatus.database}`);
    console.log(`   - Connected User: ${dbStatus.user}`);
    if (!String(dbStatus.user).startsWith('showtracker_app')) {
      console.warn('⚠️  Runtime DATABASE_URL is NOT using the restricted showtracker_app role.');
      console.warn('   Row Level Security is bypassed by admin roles. Use showtracker_app.<project-ref> as the username.');
    }
  } else {
    console.warn(`⚠️ PostgreSQL Connection notice:`);
    console.warn(`   - Status: Disconnected / Not configured`);
    console.warn(`   - Detail: ${dbStatus.error}`);
    console.warn(`   - The API is still online for health monitoring and diagnostics.`);
  }
  console.log('====================================================');

  // Find out right away whether TMDB is reachable: if it is not, the first visitor already gets the fallback
  // providers instead of waiting for a timeout (the result opens or closes the TMDB circuit breaker).
  if (tmdb.isConfigured() && process.env.NODE_ENV !== 'test') tmdb.getGenres('movie', { fast: true }).catch(() => {});

  // Pre-open a few connections (first one is already open from the check above) and keep them alive.
  if (dbStatus.ok) {
    warmPool(3)
      .then((n) => console.log(`[Database] ${n} warm connections ready.`))
      .catch(() => {});
    startPoolKeepAlive();
  }
});

// Startup errors (most commonly: port already in use) must be readable, not a raw stack trace.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[Server] Port ${PORT} is already in use by another process.`);
    console.error('[Server] Another ShowTracker backend (or a hung one) is probably still running.');
    console.error(`[Server] Find it:  netstat -ano | findstr :${PORT}   (Windows)`);
    console.error('[Server] Stop it:  taskkill /PID <pid> /F, then start the server again.');
  } else {
    console.error('[Server] Failed to start:', err);
  }
  process.exit(1);
});

// Graceful shutdown handling (idempotent, with a hard deadline so a stuck connection can't block restarts)
let shuttingDown = false;
const handleShutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    console.error('[Server] Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 5000);
  forceExit.unref();

  server.close(async () => {
    console.log('[Server] HTTP server closed.');
    try {
      await closePool();
    } catch (err) {
      console.error('[Server] Error closing database pools:', err.message);
    }
    process.exit(0);
  });
  // Drop idle keep-alive sockets so close() can complete promptly.
  server.closeIdleConnections?.();
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGUSR2', () => handleShutdown('SIGUSR2'));

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled promise rejection:', reason);
});

export default server;
