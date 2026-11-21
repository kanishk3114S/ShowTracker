-- ============================================================================
-- SHOWTRACKER — MIGRATION 010: PRODUCTION PERFORMANCE TUNING & INDEXES
-- ============================================================================
-- Adds targeted indexes to eliminate sequential scans on high-traffic read paths:
-- 1. media_sources: lateral joins for canonical provider/external_id, provider existence checks
-- 2. media_items: IMDb identifier lookups, case-insensitive title search, media_type filtering
-- 3. episodes: air_date range searches for upcoming releases & release radar
-- 4. user_library: rating sort & favorite filters
-- 5. profiles: public visibility lookups for public library view
-- ============================================================================

-- 1. media_sources: lateral ordering & provider lookup
-- Speeds up: SELECT ms.provider, ms.external_id FROM media_sources ms WHERE ms.media_id = mi.id ORDER BY ms.created_at ASC LIMIT 1
CREATE INDEX IF NOT EXISTS media_sources_media_created_idx
    ON public.media_sources (media_id, created_at ASC);

-- Speeds up: NOT EXISTS (SELECT 1 FROM media_sources s WHERE s.media_id = mi.id AND s.provider = $5)
CREATE INDEX IF NOT EXISTS media_sources_media_provider_idx
    ON public.media_sources (media_id, provider);

-- 2. media_items: fast catalog unifications & title searches
-- Functional index on IMDb ID stored inside metadata JSONB
CREATE INDEX IF NOT EXISTS media_items_imdb_idx
    ON public.media_items ((metadata->'externalIds'->>'imdb'))
    WHERE (metadata->'externalIds'->>'imdb') IS NOT NULL;

-- Case-insensitive title index for search and title matching
CREATE INDEX IF NOT EXISTS media_items_title_lower_idx
    ON public.media_items (LOWER(title));

-- Composite index for media_type and lowercase title matching
CREATE INDEX IF NOT EXISTS media_items_type_title_idx
    ON public.media_items (media_type, LOWER(title));

-- 3. episodes: air_date range queries for Upcoming Episodes and Release Radar
-- Speeds up: WHERE e.air_date >= $1 AND e.air_date <= $2
CREATE INDEX IF NOT EXISTS episodes_air_date_idx
    ON public.episodes (air_date)
    WHERE air_date IS NOT NULL;

-- Composite index for season_id + air_date
CREATE INDEX IF NOT EXISTS episodes_season_air_date_idx
    ON public.episodes (season_id, air_date);

-- 4. user_library: user ratings & favorite filters
-- Speeds up sorting by user rating
CREATE INDEX IF NOT EXISTS user_library_user_rating_idx
    ON public.user_library (user_id, rating DESC NULLS LAST, updated_at DESC);

-- Partial index for favorite titles
CREATE INDEX IF NOT EXISTS user_library_user_favorite_idx
    ON public.user_library (user_id, updated_at DESC)
    WHERE is_favorite = true;

-- 5. profiles: partial index for public profile / library view joins
CREATE INDEX IF NOT EXISTS profiles_public_visibility_idx
    ON public.profiles (id)
    WHERE profile_visibility = 'PUBLIC' AND library_visibility = 'PUBLIC';

-- 6. Refresh planner statistics
ANALYZE public.media_items;
ANALYZE public.media_sources;
ANALYZE public.seasons;
ANALYZE public.episodes;
ANALYZE public.user_library;
ANALYZE public.profiles;
