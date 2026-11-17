/**
 * Live library statistics. Nothing is stored: every number is computed from
 * user_library / user_episode_progress at request time, so it can never drift.
 *
 * The aggregation is written once and fed by a "source" relation so the owner
 * path (their own rows, under RLS) and the public path (the privacy-safe
 * public_library_entries view) produce identical numbers.
 */

const MEDIA_TYPES = ['ANIME', 'TV', 'MOVIE'];
const STATUSES = ['WATCHING', 'COMPLETED', 'PLAN_TO_WATCH', 'ON_HOLD', 'DROPPED', 'REWATCHING'];

// Both sources expose: media_type, status, rating, episodes_watched. Parameter $1 is the user id.
const OWNER_SOURCE = `
  SELECT mi.media_type, ul.status, ul.rating,
         (SELECT COUNT(*) FROM public.user_episode_progress uep WHERE uep.user_library_id = ul.id) AS episodes_watched
    FROM public.user_library ul
    JOIN public.media_items mi ON mi.id = ul.media_id
   WHERE ul.user_id = $1`;

const PUBLIC_SOURCE = `
  SELECT media_type, status, rating, episodes_watched_all AS episodes_watched
    FROM public.public_library_entries
   WHERE user_id = $1`;

const statsSql = (source) => `
  WITH lib AS (${source})
  SELECT
    (SELECT COALESCE(json_agg(g), '[]'::json)
       FROM (SELECT media_type, status, COUNT(*)::int AS n FROM lib GROUP BY media_type, status) g) AS groups,
    (SELECT COALESCE(SUM(episodes_watched), 0)::int FROM lib) AS episodes_watched,
    (SELECT ROUND(AVG(rating)::numeric, 1) FROM lib WHERE rating IS NOT NULL) AS average_rating,
    (SELECT COUNT(rating)::int FROM lib) AS rated_count,
    (SELECT COUNT(*)::int FROM lib) AS total_items`;

function shapeStats(row) {
  const byType = Object.fromEntries(MEDIA_TYPES.map((t) => [t, 0]));
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const g of row.groups) {
    if (g.media_type in byType) byType[g.media_type] += g.n;
    if (g.status in byStatus) byStatus[g.status] += g.n;
  }
  return {
    totalItems: row.total_items,
    byType,
    byStatus,
    completed: byStatus.COMPLETED,
    watching: byStatus.WATCHING,
    episodesWatched: row.episodes_watched,
    averageRating: row.average_rating === null ? null : Number(row.average_rating),
    ratedCount: row.rated_count
  };
}

/** Stats for the signed-in user. `client` must be inside withUserTransaction(userId). */
export async function getOwnerStats(client, userId) {
  const { rows } = await client.query(statsSql(OWNER_SOURCE), [userId]);
  return shapeStats(rows[0]);
}

/** Stats for a visitor. Only ever sees rows the public view allows (public profile + public library). */
export async function getPublicStats(db, userId) {
  const { rows } = await db.query(statsSql(PUBLIC_SOURCE), [userId]);
  return shapeStats(rows[0]);
}
