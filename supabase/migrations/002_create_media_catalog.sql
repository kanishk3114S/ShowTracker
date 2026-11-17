-- ============================================================================
-- SHOWTRACKER — MIGRATION 002: SHARED MEDIA CATALOG
-- ============================================================================
-- Tables:
--   media_items   one row per title (anime / movie / TV), provider-neutral
--   media_sources which external provider record(s) a title came from
--   genres        shared genre names
--   media_genres  many-to-many link between media_items and genres
--
-- The catalog is SHARED data: every user sees the same rows. Personal data
-- (watch status, ratings, progress) will live in separate user-scoped tables
-- in Phase 4 and will reference media_items(id).
--
-- Run with the MIGRATION (admin) connection:  npm run db:migrate
-- ============================================================================

-- 1. media_items -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_type     TEXT NOT NULL,
    title          TEXT NOT NULL,
    original_title TEXT,
    overview       TEXT,
    poster_path    TEXT,          -- full poster image URL (provider-hosted)
    backdrop_path  TEXT,          -- full backdrop image URL (provider-hosted)
    release_date   DATE,
    source_rating  NUMERIC(4,2),  -- provider's public rating, normalized to 0-10
    popularity     NUMERIC,
    metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT media_items_media_type_check
        CHECK (media_type IN ('ANIME', 'MOVIE', 'TV')),
    CONSTRAINT media_items_title_not_empty_check
        CHECK (char_length(btrim(title)) > 0),
    CONSTRAINT media_items_source_rating_range_check
        CHECK (source_rating IS NULL OR (source_rating >= 0 AND source_rating <= 10))
);

CREATE INDEX IF NOT EXISTS media_items_type_idx ON public.media_items (media_type);
CREATE INDEX IF NOT EXISTS media_items_release_date_idx ON public.media_items (release_date);

DROP TRIGGER IF EXISTS set_media_items_updated_at ON public.media_items;
CREATE TRIGGER set_media_items_updated_at
    BEFORE UPDATE ON public.media_items
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. media_sources -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_sources (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id            UUID NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
    provider            TEXT NOT NULL,
    provider_media_type TEXT NOT NULL,
    external_id         TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT media_sources_provider_check
        CHECK (provider IN ('ANILIST', 'TMDB')),
    CONSTRAINT media_sources_provider_media_type_check
        CHECK (provider_media_type IN ('ANIME', 'MOVIE', 'TV')),
    CONSTRAINT media_sources_external_id_not_empty_check
        CHECK (char_length(btrim(external_id)) > 0),
    -- The same provider record can never be imported twice.
    -- TMDB movie 550 and TMDB tv 550 are different titles, hence provider_media_type.
    CONSTRAINT media_sources_provider_unique
        UNIQUE (provider, provider_media_type, external_id)
);

CREATE INDEX IF NOT EXISTS media_sources_media_id_idx ON public.media_sources (media_id);

DROP TRIGGER IF EXISTS set_media_sources_updated_at ON public.media_sources;
CREATE TRIGGER set_media_sources_updated_at
    BEFORE UPDATE ON public.media_sources
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. genres ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.genres (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT genres_name_not_empty_check CHECK (char_length(btrim(name)) > 0)
);

-- "Action" and "action" are the same genre.
CREATE UNIQUE INDEX IF NOT EXISTS genres_name_lower_idx ON public.genres (LOWER(name));

-- 4. media_genres (many-to-many) ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_genres (
    media_id UUID NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
    genre_id UUID NOT NULL REFERENCES public.genres(id) ON DELETE CASCADE,
    PRIMARY KEY (media_id, genre_id)
);

CREATE INDEX IF NOT EXISTS media_genres_genre_id_idx ON public.media_genres (genre_id);

-- 5. Permissions -------------------------------------------------------------
-- Supabase grants new tables to anon/authenticated by default, which would
-- expose them through the public REST API. The catalog is only meant to be
-- reached through the Express backend, so remove that access explicitly.
REVOKE ALL ON public.media_items, public.media_sources, public.genres, public.media_genres
    FROM anon, authenticated, PUBLIC;

-- Reset the backend role, then grant only what the catalog service needs.
-- No DELETE on items/sources/genres; media_genres needs DELETE so a title's
-- genre links can be refreshed when the provider changes them.
REVOKE ALL ON public.media_items, public.media_sources, public.genres, public.media_genres
    FROM showtracker_app;
GRANT SELECT, INSERT, UPDATE ON public.media_items   TO showtracker_app;
GRANT SELECT, INSERT, UPDATE ON public.media_sources TO showtracker_app;
GRANT SELECT, INSERT         ON public.genres        TO showtracker_app;
GRANT SELECT, INSERT, DELETE ON public.media_genres  TO showtracker_app;

-- 6. Row Level Security ------------------------------------------------------
-- Catalog rows are shared, so policies are not per-user. They exist so that
-- only the backend role can touch the tables, and so RLS stays on by default.
ALTER TABLE public.media_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genres        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_genres  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS media_items_app_select ON public.media_items;
DROP POLICY IF EXISTS media_items_app_insert ON public.media_items;
DROP POLICY IF EXISTS media_items_app_update ON public.media_items;
CREATE POLICY media_items_app_select ON public.media_items FOR SELECT TO showtracker_app USING (true);
CREATE POLICY media_items_app_insert ON public.media_items FOR INSERT TO showtracker_app WITH CHECK (true);
CREATE POLICY media_items_app_update ON public.media_items FOR UPDATE TO showtracker_app USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS media_sources_app_select ON public.media_sources;
DROP POLICY IF EXISTS media_sources_app_insert ON public.media_sources;
DROP POLICY IF EXISTS media_sources_app_update ON public.media_sources;
CREATE POLICY media_sources_app_select ON public.media_sources FOR SELECT TO showtracker_app USING (true);
CREATE POLICY media_sources_app_insert ON public.media_sources FOR INSERT TO showtracker_app WITH CHECK (true);
CREATE POLICY media_sources_app_update ON public.media_sources FOR UPDATE TO showtracker_app USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS genres_app_select ON public.genres;
DROP POLICY IF EXISTS genres_app_insert ON public.genres;
CREATE POLICY genres_app_select ON public.genres FOR SELECT TO showtracker_app USING (true);
CREATE POLICY genres_app_insert ON public.genres FOR INSERT TO showtracker_app WITH CHECK (true);

DROP POLICY IF EXISTS media_genres_app_select ON public.media_genres;
DROP POLICY IF EXISTS media_genres_app_insert ON public.media_genres;
DROP POLICY IF EXISTS media_genres_app_delete ON public.media_genres;
CREATE POLICY media_genres_app_select ON public.media_genres FOR SELECT TO showtracker_app USING (true);
CREATE POLICY media_genres_app_insert ON public.media_genres FOR INSERT TO showtracker_app WITH CHECK (true);
CREATE POLICY media_genres_app_delete ON public.media_genres FOR DELETE TO showtracker_app USING (true);
