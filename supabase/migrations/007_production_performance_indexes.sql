-- ============================================================================
-- SHOWTRACKER — MIGRATION 007: PRODUCTION PERFORMANCE INDEXES
-- ============================================================================
-- Adds only indexes that serve a real query and do not already exist.
-- Every statement is IF NOT EXISTS, so re-running is harmless.
--
-- ADDED
--   user_library (user_id, status, updated_at DESC)
--       "my library filtered by status, newest first", Continue watching
--       (status = WATCHING ORDER BY updated_at DESC) and the status counts.
--       Replaces the need to sort after reading every row of a status.
--   user_library (user_id, updated_at DESC)
--       the default unfiltered library list and "Recently updated" shelf.
--   media_items (source_rating DESC NULLS LAST, release_date DESC NULLS LAST)
--       catalog discovery ordered by rating, then newest.
--
-- DELIBERATELY NOT ADDED (already covered, a second copy would only slow writes)
--   user_episode_progress (user_library_id, episode_id)
--       this is the table's PRIMARY KEY (migration 004).
--   seasons (media_id, season_number)
--       UNIQUE constraint seasons_media_season_unique (migration 003).
--   episodes (season_id, episode_number)
--       UNIQUE constraint episodes_season_episode_unique (migration 003).
-- ============================================================================

CREATE INDEX IF NOT EXISTS user_library_user_status_updated_idx
    ON public.user_library (user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS user_library_user_updated_idx
    ON public.user_library (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS media_items_rating_release_idx
    ON public.media_items (source_rating DESC NULLS LAST, release_date DESC NULLS LAST);

ANALYZE public.user_library;
ANALYZE public.media_items;
