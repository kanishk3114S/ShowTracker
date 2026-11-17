-- ============================================================================
-- SHOWTRACKER — MIGRATION 003: SEASONS & EPISODES (shared catalog)
-- ============================================================================
-- Seasons and episodes belong to a media_items row and are SHARED by all users
-- (like media_items). A user's watched episodes live in migration 004.
--
-- Rows are created lazily by the backend the first time a user tracks a title.
-- Season 0 is allowed because TMDB uses it for "Specials".
-- ============================================================================

-- 1. seasons -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seasons (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_id      UUID NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
    season_number INT  NOT NULL,
    name          TEXT NOT NULL,
    overview      TEXT,
    poster_path   TEXT,
    air_date      DATE,
    episode_count INT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT seasons_media_season_unique UNIQUE (media_id, season_number),
    CONSTRAINT seasons_season_number_check CHECK (season_number >= 0),
    CONSTRAINT seasons_name_not_empty_check CHECK (char_length(btrim(name)) > 0),
    CONSTRAINT seasons_episode_count_check CHECK (episode_count IS NULL OR episode_count >= 0)
);

CREATE INDEX IF NOT EXISTS seasons_media_id_idx ON public.seasons (media_id);

DROP TRIGGER IF EXISTS set_seasons_updated_at ON public.seasons;
CREATE TRIGGER set_seasons_updated_at
    BEFORE UPDATE ON public.seasons
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. episodes ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.episodes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id       UUID NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
    episode_number  INT  NOT NULL,
    title           TEXT NOT NULL,
    overview        TEXT,
    air_date        DATE,
    runtime_minutes INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT episodes_season_episode_unique UNIQUE (season_id, episode_number),
    CONSTRAINT episodes_episode_number_check CHECK (episode_number > 0),
    CONSTRAINT episodes_title_not_empty_check CHECK (char_length(btrim(title)) > 0),
    CONSTRAINT episodes_runtime_check CHECK (runtime_minutes IS NULL OR runtime_minutes > 0)
);

CREATE INDEX IF NOT EXISTS episodes_season_id_idx ON public.episodes (season_id);

DROP TRIGGER IF EXISTS set_episodes_updated_at ON public.episodes;
CREATE TRIGGER set_episodes_updated_at
    BEFORE UPDATE ON public.episodes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Permissions -------------------------------------------------------------
REVOKE ALL ON public.seasons, public.episodes FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.seasons, public.episodes FROM showtracker_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seasons  TO showtracker_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.episodes TO showtracker_app;

-- 4. Row Level Security (shared catalog: only the backend role may touch it) --
ALTER TABLE public.seasons  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.episodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seasons_app_all ON public.seasons;
CREATE POLICY seasons_app_all ON public.seasons
    FOR ALL TO showtracker_app USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS episodes_app_all ON public.episodes;
CREATE POLICY episodes_app_all ON public.episodes
    FOR ALL TO showtracker_app USING (true) WITH CHECK (true);
