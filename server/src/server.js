import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import app from './app.js';
import { checkDatabaseConnection, closePool } from './config/database.js';

const PORT = parseInt(process.env.PORT || '5000', 10);

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
  } else {
    console.warn(`⚠️ PostgreSQL Connection notice:`);
    console.warn(`   - Status: Disconnected / Not configured`);
    console.warn(`   - Detail: ${dbStatus.error}`);
    console.warn(`   - The API is still online for health monitoring and diagnostics.`);
  }
  console.log('====================================================');
});

// Graceful shutdown handling
const handleShutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log('[Server] HTTP server closed.');
    await closePool();
    process.exit(0);
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default server;
