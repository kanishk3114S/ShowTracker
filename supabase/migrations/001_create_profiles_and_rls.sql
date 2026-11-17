-- ============================================================================
-- SHOWTRACKER — MIGRATION 001: PROFILES & ROW LEVEL SECURITY
-- ============================================================================
-- Description:
-- 1. Creates `public.profiles` referencing Supabase Auth `auth.users(id)`.
-- 2. Sets up username validation, unique indexing, and visibility constraints.
-- 3. Implements auto-updating `updated_at` trigger.
-- 4. Implements automatic profile creation trigger on `auth.users`.
-- 5. Enables and forces Row Level Security (RLS) with SELECT, INSERT, and UPDATE policies.
-- ============================================================================

-- Step 1: Create the profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(40),
    display_name VARCHAR(80),
    avatar_url TEXT,
    bio VARCHAR(300),
    profile_visibility TEXT NOT NULL DEFAULT 'PUBLIC',
    library_visibility TEXT NOT NULL DEFAULT 'PUBLIC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT profiles_profile_visibility_check
        CHECK (profile_visibility IN ('PUBLIC', 'PRIVATE')),

    CONSTRAINT profiles_library_visibility_check
        CHECK (library_visibility IN ('PUBLIC', 'PRIVATE')),

    -- Username rule: 3-30 lowercase characters, numbers, and underscores
    CONSTRAINT profiles_username_format_check
        CHECK (username IS NULL OR (username ~ '^[a-z0-9_]{3,30}$' AND username = LOWER(username)))
);

-- Step 2: Create Indexes
-- Case-insensitive unique index for usernames (ignores NULL values during onboarding)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx
    ON public.profiles (LOWER(username))
    WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_created_at_idx
    ON public.profiles (created_at DESC);

-- Step 3: Automatically update `updated_at` column
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Step 4: Automatically create profile on new Supabase Auth user registration
-- SECURITY DEFINER runs with the privileges of the function creator (postgres)
-- to allow inserting into public.profiles upon auth.users creation.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        display_name,
        avatar_url,
        username,
        profile_visibility,
        library_visibility
    ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NULL),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL),
        NULL, -- Username is chosen by the user during Phase 2 onboarding
        'PUBLIC',
        'PUBLIC'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Step 5: Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Step 6: RLS Policies for public.profiles

-- Policy 1: SELECT
-- A user can view their own profile regardless of visibility.
-- Anyone (visitors, unauthenticated, other users) can view public profiles.
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
CREATE POLICY "Profiles select policy"
    ON public.profiles
    FOR SELECT
    TO public, showtracker_app, authenticated, anon
    USING (
        profile_visibility = 'PUBLIC'
        OR (auth.uid() IS NOT NULL AND auth.uid() = id)
    );

-- Policy 2: INSERT
-- A user can only insert a profile matching their own verified authentication UUID.
DROP POLICY IF EXISTS "Profiles insert policy" ON public.profiles;
CREATE POLICY "Profiles insert policy"
    ON public.profiles
    FOR INSERT
    TO public, showtracker_app, authenticated
    WITH CHECK (
        auth.uid() IS NOT NULL AND auth.uid() = id
    );

-- Policy 3: UPDATE
-- A user can only update their own profile, and cannot transfer ownership.
DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy"
    ON public.profiles
    FOR UPDATE
    TO public, showtracker_app, authenticated
    USING (
        auth.uid() IS NOT NULL AND auth.uid() = id
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND auth.uid() = id
    );

-- Step 7: Grant permissions to showtracker_app role if it exists
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'showtracker_app') THEN
        GRANT USAGE ON SCHEMA public TO showtracker_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO showtracker_app;
        GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO showtracker_app;
    END IF;
END
$$;
