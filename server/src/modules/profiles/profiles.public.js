import { query } from '../../config/database.js';
import { withUserTransaction } from '../../db/withUserTransaction.js';
import { listLibrary } from '../library/library.service.js';
import { getOwnerStats, getPublicStats } from '../library/library.stats.js';

/**
 * Privacy rules for GET /api/users/:username
 *
 *  1. Profile PRIVATE, caller is not the owner  -> not visible at all (404, handled by RLS + caller)
 *  2. Profile PUBLIC, library PRIVATE, not owner -> identity only; library [], stats null
 *  3. Profile PUBLIC, library PUBLIC, not owner  -> identity + library + stats, NEVER notes
 *  4. Caller is the owner                        -> everything, including private notes
 *
 * Enforcement is layered:
 *  - the profiles RLS policy hides PRIVATE profiles from everyone but their owner
 *  - non-owners read libraries ONLY through public_library_entries (migration 005):
 *    a view that only contains PUBLIC/PUBLIC users and has no `notes` column
 *  - this module also maps public rows with an explicit field list (no spreading)
 */

const PROFILE_COLUMNS = `id, username, display_name, avatar_url, bio, profile_visibility, library_visibility, created_at`;
const findProfileSql = `SELECT ${PROFILE_COLUMNS} FROM public.profiles WHERE LOWER(username) = $1 LIMIT 1`;

const PUBLIC_SORTS = {
  updated_at: 'updated_at',
  title: 'LOWER(title)',
  rating: 'rating',
  release_date: 'release_date'
};

const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

/** Explicit allow-list mapping. `notes` is not selectable from the view, and is not mapped here either. */
export function mapPublicEntry(row) {
  return {
    id: row.id,
    mediaId: row.media_id,
    status: row.status,
    rating: row.rating === null ? null : Number(row.rating),
    isFavorite: row.is_favorite,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    media: {
      id: row.media_id,
      title: row.title,
      posterUrl: row.poster_path,
      mediaType: row.media_type,
      provider: row.provider ?? null,
      externalId: row.external_id ?? null,
      releaseDate: dateOnly(row.release_date),
      releaseYear: row.release_date ? new Date(row.release_date).getFullYear() : null,
      sourceRating: row.source_rating === null ? null : Number(row.source_rating)
    },
    watchedEpisodesCount: row.watched_episodes_count,
    totalEpisodes: row.media_type === 'MOVIE' ? null : row.total_episodes
  };
}

async function listPublicLibrary(userId, { status, mediaType, sort = 'updated_at', order = 'desc' }) {
  const where = ['user_id = $1'];
  const params = [userId];
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (mediaType) {
    params.push(mediaType);
    where.push(`media_type = $${params.length}`);
  }
  const direction = order === 'asc' ? 'ASC' : 'DESC';
  const { rows } = await query(
    `SELECT id, media_id, status, rating, is_favorite, started_at, completed_at, updated_at,
            title, poster_path, media_type, release_date, source_rating, provider, external_id,
            watched_episodes_count, total_episodes
       FROM public.public_library_entries
      WHERE ${where.join(' AND ')}
      ORDER BY ${PUBLIC_SORTS[sort] ?? PUBLIC_SORTS.updated_at} ${direction} NULLS LAST, updated_at DESC
      LIMIT 500`,
    params
  );
  return rows.map(mapPublicEntry);
}

const profilePayload = (profile, isOwner) => ({
  id: profile.id,
  username: profile.username,
  display_name: profile.display_name,
  avatar_url: profile.avatar_url,
  bio: profile.bio,
  profile_visibility: profile.profile_visibility,
  library_visibility: profile.library_visibility,
  created_at: profile.created_at,
  isOwner
});

/**
 * @returns {Promise<null | {profile, library, stats, library_is_private, isOwner}>}
 *          null when the profile does not exist or is not visible to the caller.
 */
export async function loadPublicProfile({ username, callerId, filters }) {
  // Signed-in callers look the profile up under their own identity so that an owner
  // can see their own PRIVATE profile (RLS lets a user read their own row).
  let profile;
  let ownerData = null;

  if (callerId) {
    ({ profile, ownerData } = await withUserTransaction(callerId, async (client) => {
      const { rows } = await client.query(findProfileSql, [username]);
      if (rows.length === 0) return { profile: null, ownerData: null };
      if (rows[0].id !== callerId) return { profile: rows[0], ownerData: null };
      return {
        profile: rows[0],
        ownerData: {
          library: await listLibrary(client, callerId, filters),
          stats: await getOwnerStats(client, callerId)
        }
      };
    }));
  } else {
    const { rows } = await query(findProfileSql, [username]);
    profile = rows[0] ?? null;
  }

  if (!profile) return null;

  // Defense in depth: even if a PRIVATE row somehow reached us, only its owner may see it.
  const isOwner = Boolean(callerId) && callerId === profile.id;
  if (profile.profile_visibility === 'PRIVATE' && !isOwner) return null;

  if (isOwner) {
    return {
      profile: profilePayload(profile, true),
      library: ownerData.library,
      stats: ownerData.stats,
      library_is_private: profile.library_visibility === 'PRIVATE',
      isOwner: true
    };
  }

  if (profile.library_visibility === 'PRIVATE') {
    // Nothing about the library is read at all: no titles, no progress, no statistics.
    return {
      profile: profilePayload(profile, false),
      library: [],
      stats: null,
      library_is_private: true,
      isOwner: false
    };
  }

  const [library, stats] = await Promise.all([listPublicLibrary(profile.id, filters), getPublicStats({ query }, profile.id)]);
  return {
    profile: profilePayload(profile, false),
    library,
    stats,
    library_is_private: false,
    isOwner: false
  };
}
