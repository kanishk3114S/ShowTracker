-- ============================================================================
-- SHOWTRACKER — MIGRATION 006: AVATARS STORAGE BUCKET
-- ============================================================================
-- Profile pictures are uploaded from the browser straight to Supabase Storage.
--
--   * bucket `avatars` is PUBLIC for reads (avatars are shown on public profiles)
--   * 5 MB limit, JPEG / PNG / WebP only (also enforced again in the client)
--   * writes are restricted by Row Level Security: a signed-in user may only
--     create, replace or delete objects inside their OWN folder: `<user id>/...`
--
-- Everything is guarded so this file is a harmless no-op on a plain PostgreSQL
-- database that has no Supabase `storage` schema (for example local test DBs),
-- and it never aborts the migration run if the migration role lacks the
-- privilege to manage storage policies (it prints a notice instead; create the
-- bucket and policies from the Supabase dashboard in that case).
-- ============================================================================

DO $$
BEGIN
    IF to_regclass('storage.buckets') IS NULL OR to_regclass('storage.objects') IS NULL THEN
        RAISE NOTICE 'Supabase storage schema not found: skipping avatars bucket setup.';
        RETURN;
    END IF;

    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('avatars', 'avatars', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
    ON CONFLICT (id) DO UPDATE
        SET public = TRUE,
            file_size_limit = 5242880,
            allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

    DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
    CREATE POLICY "avatars_public_read" ON storage.objects
        FOR SELECT TO public
        USING (bucket_id = 'avatars');

    DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
    CREATE POLICY "avatars_owner_insert" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

    DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
    CREATE POLICY "avatars_owner_update" ON storage.objects
        FOR UPDATE TO authenticated
        USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
        WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

    DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
    CREATE POLICY "avatars_owner_delete" ON storage.objects
        FOR DELETE TO authenticated
        USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'Not enough privilege to configure storage policies: create the public "avatars" bucket and owner-folder policies in the Supabase dashboard.';
END
$$;
