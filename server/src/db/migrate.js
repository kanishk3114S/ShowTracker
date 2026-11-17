import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { migrationPool } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../server/.env') });

async function runMigrations() {
  const client = await migrationPool.connect();
  try {
    console.log('🔄 Checking database connection and migration status (using MIGRATION connection)...');

    // Ensure migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS public._migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = path.resolve(__dirname, '../../../supabase/migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log(`Directory not found: ${migrationsDir}`);
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration file(s).`);

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT id FROM public._migrations WHERE name = $1',
        [file]
      );

      if (rows.length > 0) {
        console.log(`⏭️  Migration already applied: ${file}`);
        continue;
      }

      console.log(`⏳ Applying migration: ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO public._migrations (name) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`✅ Applied migration successfully: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration failed: ${file}`);
        throw err;
      }
    }

    console.log('🎉 All migrations up to date.');
  } finally {
    client.release();
    await migrationPool.end();
  }
}

runMigrations().catch(err => {
  console.error('Migration error:', err.message);
  process.exit(1);
});
