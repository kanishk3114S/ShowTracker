-- ============================================================================
-- SHOWTRACKER — MIGRATION 005: PRIVACY-SAFE PUBLIC LIBRARY VIEW
-- ============================================================================
-- user_library / user_episode_progress are owner-only under Row Level Security.
-- To show a user's library to visitors WITHOUT widening those policies (and
-- without ever being able to leak private notes), visitors read through this
-- view instead:
--
--   * it only returns rows of users whose profile AND library are both PUBLIC
--   * it has NO `notes` column at all, so notes cannot be selected through it,
--     no matter what query the application runs
--
-- The view runs with its owner's privileges (the admin role that runs
-- migrations), which is what allows it to read across users. The visibility
-- conditions are therefore part of the view definition itself.
-- ============================================================================

CREATE OR REPLACE VIEW public.public_library_entries AS
SELECT
    ul.id,
    ul.user_id,
    ul.media_id,
    ul.status,
    ul.rating,
    ul.is_favorite,
    ul.started_at,
    ul.completed_at,
    ul.created_at,
    ul.updated_at,
    mi.title,
    mi.poster_path,
    mi.media_type,
    mi.release_date,
    mi.source_rating,
    src.provider,
    src.external_id,
    COALESCE(w.cnt, 0)::int AS watched_episodes_count,
    COALESCE(NULLIF(t.cnt, 0)::int, (mi.metadata->>'totalEpisodes')::int) AS total_episodes,
    COALESCE(a.cnt, 0)::int AS episodes_watched_all
FROM public.user_library ul
JOIN public.profiles p
  ON p.id = ul.user_id
 AND p.profile_visibility = 'PUBLIC'
 AND p.library_visibility = 'PUBLIC'
JOIN public.media_items mi ON mi.id = ul.media_id
LEFT JOIN LATERAL (
    SELECT ms.provider, ms.external_id
      FROM public.media_sources ms
     WHERE ms.media_id = mi.id
     ORDER BY ms.created_at ASC
     LIMIT 1
) src ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
      FROM public.user_episode_progress uep
      JOIN public.episodes e ON e.id = uep.episode_id
      JOIN public.seasons s ON s.id = e.season_id
     WHERE uep.user_library_id = ul.id AND s.season_number > 0
) w ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
      FROM public.seasons s
      JOIN public.episodes e ON e.season_id = s.id
     WHERE s.media_id = ul.media_id AND s.season_number > 0
) t ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
      FROM public.user_episode_progress uep
     WHERE uep.user_library_id = ul.id
) a ON true;

COMMENT ON VIEW public.public_library_entries IS
    'Read-only public projection of user_library. Only PUBLIC profiles with PUBLIC libraries; never exposes notes.';

-- Supabase grants new relations to anon/authenticated by default; that would expose
-- this view through the public REST API. Only the backend role may read it.
REVOKE ALL ON public.public_library_entries FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.public_library_entries FROM showtracker_app;
GRANT SELECT ON public.public_library_entries TO showtracker_app;
