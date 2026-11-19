-- ============================================================================
-- SHOWTRACKER — MIGRATION 009: TVMAZE AND TVDB AS CATALOG SOURCES
-- ============================================================================
-- A title is still identified by ONE internal id (media_items.id); user libraries, groups and
-- episode progress only ever reference that id (and episodes.id), never a provider id.
-- media_sources lists every provider record a title is known by. TMDB stays the primary source;
-- when it is slow or down, TVMaze or TheTVDB can supply the data, and the extra mapping is stored
-- here so the next lookup is direct. Nothing about existing rows changes.
-- ============================================================================

ALTER TABLE public.media_sources DROP CONSTRAINT IF EXISTS media_sources_provider_check;
ALTER TABLE public.media_sources
    ADD CONSTRAINT media_sources_provider_check
    CHECK (provider IN ('ANILIST', 'TMDB', 'TVMAZE', 'TVDB'));
