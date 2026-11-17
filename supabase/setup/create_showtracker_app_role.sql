-- ============================================================================
-- SHOWTRACKER — RESTRICTED APPLICATION DATABASE ROLE SETUP
-- ============================================================================
-- This script creates the restricted `showtracker_app` PostgreSQL role.
-- 
-- IMPORTANT INSTRUCTIONS FOR THE PROJECT OWNER:
-- 1. Open your Supabase Dashboard -> SQL Editor.
-- 2. Replace '[SET_STRONG_PASSWORD_HERE]' below with a secure, generated password.
-- 3. Run this script once as the privileged 'postgres' user.
-- 4. Never commit or paste your actual password into Git or conversation logs.
-- 5. Copy the restricted role connection string into server/.env:
--    DATABASE_URL=postgresql://showtracker_app:YOUR_PASSWORD@HOST:PORT/postgres?sslmode=require
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'showtracker_app') THEN
        CREATE ROLE showtracker_app WITH
            LOGIN
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            NOREPLICATION
            NOBYPASSRLS
            PASSWORD '[SET_STRONG_PASSWORD_HERE]';
        RAISE NOTICE 'Role showtracker_app created successfully.';
    ELSE
        -- Ensure existing role does not have elevated privileges
        ALTER ROLE showtracker_app WITH
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            NOREPLICATION
            NOBYPASSRLS;
        RAISE NOTICE 'Role showtracker_app already exists. Privileges verified.';
    END IF;
END
$$;

-- Grant access to public schema
GRANT USAGE ON SCHEMA public TO showtracker_app;

-- Grant DML privileges on existing tables in public schema
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO showtracker_app;

-- Ensure future tables created in public schema inherit these privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO showtracker_app;

-- Grant sequence usage (for auto-incrementing counters if any are used)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO showtracker_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO showtracker_app;

-- Grant execute privileges on stored functions (e.g., handle_updated_at)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO showtracker_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO showtracker_app;

-- Grant usage on auth schema for auth.uid() function lookup
GRANT USAGE ON SCHEMA auth TO showtracker_app;
GRANT EXECUTE ON FUNCTION auth.uid() TO showtracker_app;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this query to verify the restricted role privileges:
SELECT
    rolname,
    rolcanlogin,
    rolsuper,
    rolcreatedb,
    rolcreaterole,
    rolbypassrls
FROM pg_roles
WHERE rolname = 'showtracker_app';
