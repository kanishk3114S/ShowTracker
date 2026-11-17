-- ============================================================================
-- SHOWTRACKER — PHASE 1 DATABASE & RLS TEST SUITE
-- ============================================================================
-- Run this script in the Supabase SQL Editor or via test runner.
-- Every test runs within a transaction that rolls back at the end,
-- leaving zero residue or test data in your database.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    v_user_a_id UUID := gen_random_uuid();
    v_user_b_id UUID := gen_random_uuid();
    v_count INTEGER;
    v_error_caught BOOLEAN;
BEGIN
    RAISE NOTICE '==================================================';
    RAISE NOTICE '🧪 RUNNING SHOWTRACKER PHASE 1 DATABASE TESTS';
    RAISE NOTICE '==================================================';

    -- ------------------------------------------------------------------------
    -- TEST 1: Verify Table Existence and Ownership
    -- ------------------------------------------------------------------------
    SELECT COUNT(*) INTO v_count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'TEST 1 FAILED: public.profiles table does not exist';
    END IF;
    RAISE NOTICE '✅ TEST 1 PASSED: public.profiles table exists in public schema.';

    -- ------------------------------------------------------------------------
    -- TEST 2: Verify showtracker_app Role & RLS Configuration
    -- ------------------------------------------------------------------------
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'showtracker_app') THEN
        SELECT rolbypassrls INTO v_error_caught
        FROM pg_roles
        WHERE rolname = 'showtracker_app';

        IF v_error_caught THEN
            RAISE EXCEPTION 'TEST 2 FAILED: showtracker_app must NOT have BYPASSRLS!';
        END IF;
        RAISE NOTICE '✅ TEST 2 PASSED: showtracker_app has NOBYPASSRLS.';
    ELSE
        RAISE NOTICE 'ℹ️ TEST 2 NOTICE: showtracker_app role not yet created (pending setup step).';
    END IF;

    -- Verify RLS is enabled on public.profiles
    SELECT COUNT(*) INTO v_count
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'profiles' AND rowsecurity = true;

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'TEST 2 FAILED: Row Level Security is NOT enabled on public.profiles';
    END IF;
    RAISE NOTICE '✅ TEST 2 PASSED: Row Level Security is active on public.profiles.';

    -- ------------------------------------------------------------------------
    -- TEST 3: Create Temporary Test Users in auth.users
    -- ------------------------------------------------------------------------
    -- Creating isolated test rows in auth.users for transaction duration
    INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
    VALUES 
        (v_user_a_id, 'test_user_a@showtracker.internal', '{"full_name": "User Alpha"}'::jsonb, NOW(), NOW()),
        (v_user_b_id, 'test_user_b@showtracker.internal', '{"full_name": "User Beta"}'::jsonb, NOW(), NOW());

    -- Verify handle_new_user trigger automatically created profiles
    SELECT COUNT(*) INTO v_count
    FROM public.profiles
    WHERE id IN (v_user_a_id, v_user_b_id);

    IF v_count <> 2 THEN
        RAISE EXCEPTION 'TEST 3 FAILED: Automatic profile creation trigger failed. Expected 2 profiles, got %', v_count;
    END IF;
    RAISE NOTICE '✅ TEST 3 PASSED: Automatic profile creation trigger works on auth.users registration.';

    -- ------------------------------------------------------------------------
    -- TEST 4: Check Constraints (Visibility & Username format)
    -- ------------------------------------------------------------------------
    -- 4a: Valid username update
    UPDATE public.profiles
    SET username = 'alpha_user', display_name = 'Alpha'
    WHERE id = v_user_a_id;
    RAISE NOTICE '✅ TEST 4a PASSED: Valid username accepted.';

    -- 4b: Invalid username format (uppercase)
    v_error_caught := FALSE;
    BEGIN
        UPDATE public.profiles
        SET username = 'INVALID_UPPERCASE'
        WHERE id = v_user_a_id;
    EXCEPTION WHEN check_violation THEN
        v_error_caught := TRUE;
    END;
    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'TEST 4b FAILED: Uppercase username was not rejected by check constraint';
    END IF;
    RAISE NOTICE '✅ TEST 4b PASSED: Invalid username format rejected.';

    -- 4c: Duplicate username (case-insensitive)
    v_error_caught := FALSE;
    BEGIN
        UPDATE public.profiles
        SET username = 'alpha_user'
        WHERE id = v_user_b_id;
    EXCEPTION WHEN unique_violation THEN
        v_error_caught := TRUE;
    END;
    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'TEST 4c FAILED: Duplicate username was not rejected by unique constraint';
    END IF;
    RAISE NOTICE '✅ TEST 4c PASSED: Duplicate username correctly rejected.';

    -- 4d: Invalid profile visibility
    v_error_caught := FALSE;
    BEGIN
        UPDATE public.profiles
        SET profile_visibility = 'SECRET'
        WHERE id = v_user_a_id;
    EXCEPTION WHEN check_violation THEN
        v_error_caught := TRUE;
    END;
    IF NOT v_error_caught THEN
        RAISE EXCEPTION 'TEST 4d FAILED: Invalid profile_visibility value accepted';
    END IF;
    RAISE NOTICE '✅ TEST 4d PASSED: Invalid visibility value rejected.';

    -- Set User A to PRIVATE profile, User B to PUBLIC profile
    UPDATE public.profiles
    SET profile_visibility = 'PRIVATE', username = 'user_alpha_private'
    WHERE id = v_user_a_id;

    UPDATE public.profiles
    SET profile_visibility = 'PUBLIC', username = 'user_beta_public'
    WHERE id = v_user_b_id;

    -- ------------------------------------------------------------------------
    -- TEST 5: Row Level Security (RLS) Policies
    -- ------------------------------------------------------------------------
    
    -- Context 5a: Anonymous / Visitor context (no auth.uid())
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('role', 'anon', true);

    -- Visitor should only see public profiles (User B), NOT User A (Private)
    SELECT COUNT(*) INTO v_count
    FROM public.profiles
    WHERE id IN (v_user_a_id, v_user_b_id);

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'TEST 5a FAILED: Visitor saw % profiles instead of 1 public profile.', v_count;
    END IF;
    RAISE NOTICE '✅ TEST 5a PASSED: Anonymous visitor can only view public profiles.';

    -- Context 5b: User A authenticated context
    PERFORM set_config('request.jwt.claim.sub', v_user_a_id::text, true);
    PERFORM set_config('role', 'authenticated', true);

    -- User A can see their own private profile AND User B's public profile (Total = 2)
    SELECT COUNT(*) INTO v_count
    FROM public.profiles
    WHERE id IN (v_user_a_id, v_user_b_id);

    IF v_count <> 2 THEN
        RAISE EXCEPTION 'TEST 5b FAILED: User A could not view their own private profile.';
    END IF;
    RAISE NOTICE '✅ TEST 5b PASSED: Authenticated user can view their own private profile.';

    -- Context 5c: User A attempts to update User B's profile
    UPDATE public.profiles
    SET bio = 'Hacked bio by User A'
    WHERE id = v_user_b_id;

    -- Verify User B's bio was NOT changed
    SELECT COUNT(*) INTO v_count
    FROM public.profiles
    WHERE id = v_user_b_id AND bio = 'Hacked bio by User A';

    IF v_count > 0 THEN
        RAISE EXCEPTION 'TEST 5c FAILED: User A was able to update User B profile!';
    END IF;
    RAISE NOTICE '✅ TEST 5c PASSED: RLS prevents User A from updating User B profile.';

    -- Context 5d: User A updates their own profile
    UPDATE public.profiles
    SET bio = 'Valid bio updated by owner'
    WHERE id = v_user_a_id;

    SELECT COUNT(*) INTO v_count
    FROM public.profiles
    WHERE id = v_user_a_id AND bio = 'Valid bio updated by owner';

    IF v_count <> 1 THEN
        RAISE EXCEPTION 'TEST 5d FAILED: User A was unable to update their own profile.';
    END IF;
    RAISE NOTICE '✅ TEST 5d PASSED: User A can successfully update their own profile.';

    RAISE NOTICE '==================================================';
    RAISE NOTICE '🎉 ALL PHASE 1 DATABASE & RLS TESTS PASSED!';
    RAISE NOTICE '==================================================';
END
$$;

-- Roll back all test data so database is untouched
ROLLBACK;
