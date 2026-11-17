import { pool, checkDatabaseConnection } from '../config/database.js';

async function verify() {
  console.log('====================================================');
  console.log('🔍 SHOWTRACKER PHASE 1 DATABASE VERIFICATION');
  console.log('====================================================');

  try {
    const health = await checkDatabaseConnection();
    if (!health.ok) {
      console.error('❌ Connection Failed:', health.error);
      console.log('👉 Please ensure DATABASE_URL in server/.env points to your Supabase project.');
      process.exit(1);
    }

    console.log('✅ PostgreSQL Connection: OK');
    console.log(`   - Server Time (UTC): ${health.time}`);
    console.log(`   - Database: ${health.database}`);
    console.log(`   - Database User: ${health.user}`);
    console.log(`   - Default Schema: ${health.schema || 'public'}`);

    const client = await pool.connect();
    try {
      // 1. Check profiles table
      const tableRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
        ORDER BY ordinal_position;
      `);

      if (tableRes.rows.length === 0) {
        console.warn('⚠️ Table public.profiles not found yet. Run migrations to create it.');
      } else {
        console.log(`✅ Table public.profiles exists with ${tableRes.rows.length} columns:`);
        tableRes.rows.forEach(col => {
          console.log(`   - ${col.column_name.padEnd(20)} ${col.data_type.padEnd(15)} (Nullable: ${col.is_nullable})`);
        });
      }

      // 2. Check RLS status
      const rlsRes = await client.query(`
        SELECT tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'profiles';
      `);
      if (rlsRes.rows.length > 0 && rlsRes.rows[0].rowsecurity) {
        console.log('✅ Row Level Security: ENABLED on public.profiles');
      } else {
        console.warn('⚠️ Row Level Security: NOT enabled on public.profiles');
      }

      // 3. Check showtracker_app role
      const roleRes = await client.query(`
        SELECT rolname, rolcanlogin, rolsuper, rolbypassrls
        FROM pg_roles
        WHERE rolname = 'showtracker_app';
      `);
      if (roleRes.rows.length > 0) {
        const r = roleRes.rows[0];
        console.log(`✅ Role showtracker_app found:`);
        console.log(`   - Can Login: ${r.rolcanlogin}`);
        console.log(`   - Superuser: ${r.rolsuper} (Must be false)`);
        console.log(`   - Bypass RLS: ${r.rolbypassrls} (Must be false)`);
      } else {
        console.log('ℹ️ Role showtracker_app: Not yet created (run supabase/setup/create_showtracker_app_role.sql)');
      }

    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Verification error:', err.message);
  } finally {
    await pool.end();
  }
}

verify();
