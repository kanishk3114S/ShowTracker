import { AppError } from '../../middleware/errorHandler.js';

/**
 * Library business logic. Every function takes a `client` that is ALREADY inside
 * withUserTransaction(userId, ...), so Row Level Security sees the right user.
 * Queries also filter by user_id explicitly (defense in depth: RLS is the safety
 * net, not the only check).
 *
 * Progress rules:
 *  - watched counts are always derived with COUNT(*), never stored
 *  - specials (season 0) can be tracked but do not count toward progress/completion
 */

// Sort is chosen from this fixed map; request values never reach the SQL text.
const SORTS = {
  updated_at: 'ul.updated_at',
  title: 'LOWER(mi.title)',
  rating: 'ul.rating',
  release_date: 'mi.release_date'
};

const ENTRY_SELECT = `
  SELECT ul.id, ul.media_id, ul.status, ul.rating, ul.is_favorite, ul.notes,
         ul.started_at, ul.completed_at, ul.rewatch_count, ul.created_at, ul.updated_at,
         mi.title, mi.poster_path, mi.backdrop_path, mi.media_type, mi.release_date, mi.source_rating,
         src.provider, src.external_id,
         COALESCE(w.cnt, 0)::int AS watched_episodes_count,
         COALESCE(NULLIF(t.cnt, 0)::int, (mi.metadata->>'totalEpisodes')::int) AS total_episodes
    FROM public.user_library ul
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
`;

const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export function mapEntry(row) {
  return {
    id: row.id,
    mediaId: row.media_id,
    status: row.status,
    rating: row.rating === null ? null : Number(row.rating),
    isFavorite: row.is_favorite,
    notes: row.notes,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    rewatchCount: row.rewatch_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    media: {
      id: row.media_id,
      title: row.title,
      posterUrl: row.poster_path,
      backdropUrl: row.backdrop_path ?? null,
      mediaType: row.media_type,
      provider: row.provider ?? null,
      externalId: row.external_id ?? null,
      releaseDate: row.release_date ? dateOnly(row.release_date) : null,
      releaseYear: row.release_date ? new Date(row.release_date).getFullYear() : null,
      sourceRating: row.source_rating === null ? null : Number(row.source_rating)
    },
    watchedEpisodesCount: row.watched_episodes_count,
    totalEpisodes: row.media_type === 'MOVIE' ? null : row.total_episodes
  };
}

const notFound = () => new AppError('Library entry not found.', 404, 'LIBRARY_ENTRY_NOT_FOUND');

async function fetchEntry(client, userId, entryId) {
  const { rows } = await client.query(`${ENTRY_SELECT} WHERE ul.id = $1 AND ul.user_id = $2`, [entryId, userId]);
  if (rows.length === 0) throw notFound();
  return mapEntry(rows[0]);
}

export async function listLibrary(client, userId, { status, mediaType, sort, order, groupId, limit = 500 }) {
  const where = ['ul.user_id = $1'];
  const params = [userId];
  if (status) {
    params.push(status);
    where.push(`ul.status = $${params.length}`);
  }
  if (mediaType) {
    params.push(mediaType);
    where.push(`mi.media_type = $${params.length}`);
  }
  if (groupId) {
    // Only the caller's own group can match: RLS hides other users' links, and the entry is already user-scoped.
    params.push(groupId);
    where.push(
      `EXISTS (SELECT 1 FROM public.library_group_items gi WHERE gi.group_id = $${params.length} AND gi.library_entry_id = ul.id)`
    );
  }
  const direction = order === 'asc' ? 'ASC' : 'DESC';
  const orderBy = `${Object.hasOwn(SORTS, sort) ? SORTS[sort] : SORTS.updated_at} ${direction} NULLS LAST, ul.updated_at DESC`;

  const { rows } = await client.query(
    `${ENTRY_SELECT} WHERE ${where.join(' AND ')} ORDER BY ${orderBy} LIMIT ${Math.min(Math.max(Number(limit) || 500, 1), 500)}`,
    params
  );
  return rows.map(mapEntry);
}

export async function checkEntry(client, userId, mediaId) {
  const { rows } = await client.query(`${ENTRY_SELECT} WHERE ul.media_id = $1 AND ul.user_id = $2`, [mediaId, userId]);
  if (rows.length === 0) return { entry: null, watchedEpisodeIds: [] };

  const watched = await client.query(
    'SELECT episode_id FROM public.user_episode_progress WHERE user_library_id = $1',
    [rows[0].id]
  );
  return { entry: mapEntry(rows[0]), watchedEpisodeIds: watched.rows.map((r) => r.episode_id) };
}

export async function addEntry(client, userId, { mediaId, status, rating, isFavorite, notes }) {
  const media = await client.query('SELECT id FROM public.media_items WHERE id = $1', [mediaId]);
  if (media.rows.length === 0) throw new AppError('That title is not in the catalog.', 404, 'MEDIA_NOT_FOUND');

  const { rows } = await client.query(
    `INSERT INTO public.user_library
        (user_id, media_id, status, rating, is_favorite, notes, started_at, completed_at)
     VALUES ($1, $2, $3::text, $4, $5, $6,
        CASE WHEN $3::text IN ('WATCHING', 'REWATCHING', 'COMPLETED') THEN NOW() END,
        CASE WHEN $3::text = 'COMPLETED' THEN NOW() END)
     ON CONFLICT (user_id, media_id) DO NOTHING
     RETURNING id`,
    [userId, mediaId, status, rating ?? null, isFavorite ?? false, notes ?? null]
  );
  if (rows.length === 0) {
    throw new AppError('This title is already in your library.', 409, 'ALREADY_IN_LIBRARY');
  }
  return fetchEntry(client, userId, rows[0].id);
}

export async function updateEntry(client, userId, entryId, patch) {
  const current = await client.query(
    'SELECT status FROM public.user_library WHERE id = $1 AND user_id = $2 FOR UPDATE',
    [entryId, userId]
  );
  if (current.rows.length === 0) throw notFound();

  const sets = [];
  const params = [entryId, userId];
  const add = (sql, value) => {
    params.push(value);
    const placeholder = `$${params.length}`;
    sets.push(sql.replaceAll('$$', () => placeholder));
  };

  if (patch.rating !== undefined) add('rating = $$', patch.rating);
  if (patch.isFavorite !== undefined) add('is_favorite = $$', patch.isFavorite);
  if (patch.notes !== undefined) add('notes = $$', patch.notes);
  if (patch.status !== undefined) {
    add('status = $$::text', patch.status);
    const idx = params.length;
    sets.push(
      `started_at = CASE WHEN $${idx}::text IN ('WATCHING', 'REWATCHING', 'COMPLETED') THEN COALESCE(started_at, NOW()) ELSE started_at END`,
      `completed_at = CASE WHEN $${idx}::text = 'COMPLETED' THEN COALESCE(completed_at, NOW()) ELSE NULL END`
    );
    if (patch.status === 'REWATCHING' && current.rows[0].status !== 'REWATCHING') {
      sets.push('rewatch_count = rewatch_count + 1');
    }
  }

  await client.query(`UPDATE public.user_library SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2`, params);
  return fetchEntry(client, userId, entryId);
}

export async function removeEntry(client, userId, entryId) {
  const { rowCount } = await client.query('DELETE FROM public.user_library WHERE id = $1 AND user_id = $2', [
    entryId,
    userId
  ]);
  if (rowCount === 0) throw notFound();
  return { id: entryId, removed: true };
}

// ---------------------------------------------------------- episode tracking --

/** Locks the user's entry row so concurrent progress changes on it are serialized. */
async function lockEntryForProgress(client, userId, entryId) {
  const { rows } = await client.query(
    `SELECT ul.id, ul.status, ul.media_id, mi.media_type
       FROM public.user_library ul
       JOIN public.media_items mi ON mi.id = ul.media_id
      WHERE ul.id = $1 AND ul.user_id = $2
      FOR UPDATE OF ul`,
    [entryId, userId]
  );
  if (rows.length === 0) throw notFound();
  if (rows[0].media_type === 'MOVIE') {
    throw new AppError(
      'Movies do not have episodes. Mark the movie as Completed instead.',
      400,
      'CANNOT_TRACK_EPISODES_FOR_MOVIE'
    );
  }
  return rows[0];
}

/** Derives counts with COUNT(*), then applies the automatic status rules. */
async function reconcile(client, entry, event) {
  const { rows } = await client.query(
    `SELECT
       (SELECT COUNT(*) FROM public.user_episode_progress uep
          JOIN public.episodes e ON e.id = uep.episode_id
          JOIN public.seasons s ON s.id = e.season_id
         WHERE uep.user_library_id = $1 AND s.season_number > 0)::int AS watched,
       (SELECT COUNT(*) FROM public.seasons s
          JOIN public.episodes e ON e.season_id = s.id
         WHERE s.media_id = $2 AND s.season_number > 0)::int AS total`,
    [entry.id, entry.media_id]
  );
  const { watched, total } = rows[0];

  let status = entry.status;
  let startedNow = false;
  let completion = null; // 'set' | 'clear'

  if (event !== 'unwatched' && status === 'PLAN_TO_WATCH') {
    status = 'WATCHING';
    startedNow = true;
  }
  if (event !== 'unwatched' && total > 0 && watched >= total && status !== 'COMPLETED' && status !== 'REWATCHING') {
    status = 'COMPLETED';
    completion = 'set';
    startedNow = startedNow || false;
  }
  if (event === 'unwatched' && status === 'COMPLETED' && watched < total) {
    status = 'WATCHING';
    completion = 'clear';
  }

  const { rows: updated } = await client.query(
    `UPDATE public.user_library
        SET status = $2::text,
            started_at = CASE WHEN $3::boolean OR ($2::text IN ('WATCHING', 'COMPLETED') AND started_at IS NULL)
                              THEN COALESCE(started_at, NOW()) ELSE started_at END,
            completed_at = CASE $4::text WHEN 'set' THEN NOW() WHEN 'clear' THEN NULL ELSE completed_at END
      WHERE id = $1
      RETURNING status, started_at, completed_at`,
    [entry.id, status, startedNow, completion]
  );
  return {
    status: updated[0].status,
    startedAt: updated[0].started_at,
    completedAt: updated[0].completed_at,
    watchedEpisodesCount: watched,
    totalEpisodes: total || null
  };
}

async function assertEpisodeBelongsToEntry(client, userId, entryId, episodeId) {
  const { rows } = await client.query(
    `SELECT e.id FROM public.episodes e
       JOIN public.seasons s ON s.id = e.season_id
       JOIN public.user_library ul ON ul.media_id = s.media_id
      WHERE e.id = $1 AND ul.id = $2 AND ul.user_id = $3`,
    [episodeId, entryId, userId]
  );
  if (rows.length === 0) {
    throw new AppError('That episode does not belong to this title.', 400, 'INVALID_EPISODE_FOR_MEDIA');
  }
}

export async function setEpisodeWatched(client, userId, entryId, episodeId, watched) {
  const entry = await lockEntryForProgress(client, userId, entryId);
  await assertEpisodeBelongsToEntry(client, userId, entryId, episodeId);

  if (watched) {
    await client.query(
      `INSERT INTO public.user_episode_progress (user_library_id, episode_id)
       VALUES ($1, $2) ON CONFLICT (user_library_id, episode_id) DO NOTHING`,
      [entryId, episodeId]
    );
  } else {
    await client.query('DELETE FROM public.user_episode_progress WHERE user_library_id = $1 AND episode_id = $2', [
      entryId,
      episodeId
    ]);
  }
  return reconcile(client, entry, watched ? 'watched' : 'unwatched');
}

export async function markSeasonWatched(client, userId, entryId, seasonId) {
  const entry = await lockEntryForProgress(client, userId, entryId);

  const season = await client.query(
    `SELECT s.id FROM public.seasons s
       JOIN public.user_library ul ON ul.media_id = s.media_id
      WHERE s.id = $1 AND ul.id = $2 AND ul.user_id = $3`,
    [seasonId, entryId, userId]
  );
  if (season.rows.length === 0) {
    throw new AppError('That season does not belong to this title.', 400, 'INVALID_SEASON_FOR_MEDIA');
  }

  const inserted = await client.query(
    `INSERT INTO public.user_episode_progress (user_library_id, episode_id)
     SELECT $1, e.id FROM public.episodes e WHERE e.season_id = $2
     ON CONFLICT (user_library_id, episode_id) DO NOTHING`,
    [entryId, seasonId]
  );
  const progress = await reconcile(client, entry, 'season');
  return { ...progress, markedCount: inserted.rowCount };
}
