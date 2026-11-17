-- ============================================================================
-- SHOWTRACKER — MIGRATION 004: USER LIBRARY & EPISODE PROGRESS (user-scoped)
-- ============================================================================
-- Unlike the shared catalog, every row here belongs to one user. Row Level
-- Security guarantees a user can only ever see and change their own rows.
--
-- The watched-episode COUNT is never stored: it is always derived with
-- COUNT(*) from user_episode_progress.
-- ============================================================================

-- 1. user_library ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_library (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    media_id       UUID NOT NULL REFERENCES public.media_items(id) ON DELETE RESTRICT,
    status         TEXT NOT NULL DEFAULT 'PLAN_TO_WATCH',
    rating         NUMERIC(3,1),
    is_favorite    BOOLEAN NOT NULL DEFAULT false,
    notes          TEXT,
    started_at     TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    rewatch_count  INT NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT user_library_user_media_unique UNIQUE (user_id, media_id),
    CONSTRAINT user_library_status_check
        CHECK (status IN ('PLAN_TO_WATCH', 'WATCHING', 'COMPLETED', 'ON_HOLD', 'DROPPED', 'REWATCHING')),
    CONSTRAINT user_library_rating_check
        CHECK (rating IS NULL OR (rating >= 0 AND rating <= 10)),
    CONSTRAINT user_library_notes_length_check
        CHECK (notes IS NULL OR char_length(notes) <= 2000),
    CONSTRAINT user_library_rewatch_count_check CHECK (rewatch_count >= 0)
);

CREATE INDEX IF NOT EXISTS user_library_user_id_idx        ON public.user_library (user_id);
CREATE INDEX IF NOT EXISTS user_library_user_status_idx    ON public.user_library (user_id, status);
CREATE INDEX IF NOT EXISTS user_library_media_id_idx       ON public.user_library (media_id);

DROP TRIGGER IF EXISTS set_user_library_updated_at ON public.user_library;
CREATE TRIGGER set_user_library_updated_at
    BEFORE UPDATE ON public.user_library
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. user_episode_progress ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_episode_progress (
    user_library_id UUID NOT NULL REFERENCES public.user_library(id) ON DELETE CASCADE,
    episode_id      UUID NOT NULL REFERENCES public.episodes(id) ON DELETE CASCADE,
    watched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_library_id, episode_id)
);

CREATE INDEX IF NOT EXISTS user_episode_progress_episode_id_idx ON public.user_episode_progress (episode_id);

-- 3. Permissions -------------------------------------------------------------
REVOKE ALL ON public.user_library, public.user_episode_progress FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.user_library, public.user_episode_progress FROM showtracker_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_library          TO showtracker_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_episode_progress TO showtracker_app;

-- 4. Row Level Security ------------------------------------------------------
ALTER TABLE public.user_library          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_library          FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.user_episode_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_episode_progress FORCE  ROW LEVEL SECURITY;

-- auth.uid() resolves to the verified user set by withUserTransaction().
DROP POLICY IF EXISTS user_library_select ON public.user_library;
DROP POLICY IF EXISTS user_library_insert ON public.user_library;
DROP POLICY IF EXISTS user_library_update ON public.user_library;
DROP POLICY IF EXISTS user_library_delete ON public.user_library;

CREATE POLICY user_library_select ON public.user_library
    FOR SELECT TO showtracker_app USING (auth.uid() = user_id);
CREATE POLICY user_library_insert ON public.user_library
    FOR INSERT TO showtracker_app WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_library_update ON public.user_library
    FOR UPDATE TO showtracker_app USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY user_library_delete ON public.user_library
    FOR DELETE TO showtracker_app USING (auth.uid() = user_id);

-- Progress rows are owned through the library entry they belong to.
DROP POLICY IF EXISTS user_episode_progress_select ON public.user_episode_progress;
DROP POLICY IF EXISTS user_episode_progress_insert ON public.user_episode_progress;
DROP POLICY IF EXISTS user_episode_progress_delete ON public.user_episode_progress;

CREATE POLICY user_episode_progress_select ON public.user_episode_progress
    FOR SELECT TO showtracker_app
    USING (EXISTS (SELECT 1 FROM public.user_library ul
                    WHERE ul.id = user_library_id AND ul.user_id = auth.uid()));
CREATE POLICY user_episode_progress_insert ON public.user_episode_progress
    FOR INSERT TO showtracker_app
    WITH CHECK (EXISTS (SELECT 1 FROM public.user_library ul
                         WHERE ul.id = user_library_id AND ul.user_id = auth.uid()));
CREATE POLICY user_episode_progress_delete ON public.user_episode_progress
    FOR DELETE TO showtracker_app
    USING (EXISTS (SELECT 1 FROM public.user_library ul
                    WHERE ul.id = user_library_id AND ul.user_id = auth.uid()));
