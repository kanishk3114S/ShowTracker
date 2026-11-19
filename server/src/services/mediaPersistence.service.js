import { pool } from '../config/database.js';

/**
 * Saves one detailed media record into the shared catalog tables.
 *
 * Idempotent: calling it repeatedly for the same provider record updates the
 * existing rows instead of creating duplicates. It uses:
 *  - the UNIQUE (provider, provider_media_type, external_id) constraint on media_sources
 *  - a transaction-scoped advisory lock, so two simultaneous requests for the
 *    same title cannot both decide "it doesn't exist yet" and insert twice
 *
 * Titles are NEVER merged because their names look alike; identity is the
 * provider's own id.
 *
 * @param {object} media  normalized media object (see mediaNormalizer.js)
 * @returns {Promise<string>} the media_items.id (UUID)
 */
/** Source records other than the primary one are bookkeeping for media_sources, not part of the stored title. */
const withoutLinks = ({ alsoKnownAs, ...rest }) => rest; // eslint-disable-line no-unused-vars

/**
 * Records that a title is also known by another provider (TVMaze, TheTVDB ...). The title keeps its single
 * internal id; this only adds a lookup row. A provider record already linked to ANOTHER title is left alone.
 */
export async function linkSource(mediaId, provider, mediaType, externalId, db = pool) {
  await db.query(
    `INSERT INTO public.media_sources (media_id, provider, provider_media_type, external_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (provider, provider_media_type, external_id) DO NOTHING`,
    [mediaId, provider, mediaType, String(externalId)]
  );
}

/**
 * The same title may be reached through different providers (TMDB normally; TVMaze / TheTVDB when TMDB is
 * unreachable). It must still be ONE title for the user, so a record that has no source row yet is matched to
 * an existing title before a new one is created:
 *   - same IMDb id (certain), or
 *   - exactly the same title (case-insensitive) AND the same release year (and nothing else matches)
 * A candidate that is already linked to a DIFFERENT record of this same provider is never used (two distinct
 * TMDB entries are two titles). Returns the id of the single match, or null.
 */
async function findUnifiableTitle(client, media) {
  if (media.provider === 'ANILIST' || !['TV', 'MOVIE'].includes(media.mediaType)) return null;
  const imdb = media.externalIds?.imdb ?? null;
  const year = Number.isInteger(media.releaseYear) ? media.releaseYear : null;
  const { rows } = await client.query(
    `SELECT mi.id
       FROM public.media_items mi
      WHERE mi.media_type = $1
        AND (
              ($2::text IS NOT NULL AND mi.metadata->'externalIds'->>'imdb' = $2::text)
           OR ($4::int IS NOT NULL AND LOWER(mi.title) = LOWER($3) AND EXTRACT(YEAR FROM mi.release_date)::int = $4::int)
        )
        AND NOT EXISTS (SELECT 1 FROM public.media_sources s WHERE s.media_id = mi.id AND s.provider = $5)
      LIMIT 2`,
    [media.mediaType, imdb, media.title, year, media.provider]
  );
  return rows.length === 1 ? rows[0].id : null;
}

export async function upsertMediaFromDetails(media, db = pool) {
  if (!media?.provider || !media?.externalId || !media?.mediaType || !media?.title) {
    throw new Error('upsertMediaFromDetails requires provider, externalId, mediaType and title.');
  }

  const metadata = {
    status: media.status ?? null,
    format: media.format ?? null,
    season: media.season ?? null,
    totalEpisodes: media.totalEpisodes ?? null,
    totalSeasons: media.totalSeasons ?? null,
    runtimeMinutes: media.runtimeMinutes ?? null,
    releaseYear: media.releaseYear ?? null,
    endDate: media.endDate ?? null,
    sourceRatingName: media.sourceRatingName ?? null,
    sourceUrl: media.sourceUrl ?? null,
    // Release Radar: next episode (AniList: unix seconds; TMDB: calendar date)
    nextAiring: media.nextAiring?.airingAt ?? null,
    nextAiringEpisode: media.nextAiring?.episode ?? null,
    nextAirDate: media.nextEpisode?.airDate ?? null,
    nextAirEpisode: media.nextEpisode?.episode ?? null,
    nextAirSeason: media.nextEpisode?.season ?? null,
    ...(media.externalIds ? { externalIds: media.externalIds } : {}),
    dataSource: media.dataSource ?? media.provider,
    // The whole normalized record, so a later visit can be served from the database (catalogSnapshot.service.js)
    snapshot: { savedAt: Date.now(), media: withoutLinks(media) }
  };

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `${media.provider}:${media.mediaType}:${media.externalId}`
    ]);

    const existing = await client.query(
      `SELECT media_id FROM public.media_sources
        WHERE provider = $1 AND provider_media_type = $2 AND external_id = $3`,
      [media.provider, media.mediaType, media.externalId]
    );

    const fields = [
      media.title,
      media.originalTitle ?? null,
      media.overview ?? null,
      media.posterUrl ?? null,
      media.backdropUrl ?? null,
      media.releaseDate ?? null,
      media.sourceRating ?? null,
      media.popularity ?? null,
      JSON.stringify(metadata)
    ];

    let mediaId;
    let unified = false;
    if (existing.rows.length > 0) {
      mediaId = existing.rows[0].media_id;
    } else {
      mediaId = await findUnifiableTitle(client, media);
      if (mediaId) {
        unified = true;
        await client.query(
          `INSERT INTO public.media_sources (media_id, provider, provider_media_type, external_id) VALUES ($1, $2, $3, $4)
           ON CONFLICT (provider, provider_media_type, external_id) DO NOTHING`,
          [mediaId, media.provider, media.mediaType, media.externalId]
        );
      }
    }
    // A record found by identity is refreshed; one matched to an existing title only refreshes it when the
    // newcomer is the primary source (TMDB), never when a thinner fallback record would overwrite richer data.
    const refreshExisting = mediaId && (!unified || media.provider === 'TMDB');
    if (mediaId && !refreshExisting) {
      await client.query('COMMIT');
      return mediaId;
    }
    if (mediaId) {
      await client.query(
        `UPDATE public.media_items
            SET title = $1, original_title = $2, overview = $3, poster_path = $4, backdrop_path = $5,
                release_date = $6, source_rating = $7, popularity = $8,
                metadata = COALESCE(metadata, '{}'::jsonb) || $9::jsonb
          WHERE id = $10`,
        [...fields, mediaId]
      );
    } else {
      const inserted = await client.query(
        `INSERT INTO public.media_items
           (media_type, title, original_title, overview, poster_path, backdrop_path,
            release_date, source_rating, popularity, metadata)
         VALUES ($10, $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
         RETURNING id`,
        [...fields, media.mediaType]
      );
      mediaId = inserted.rows[0].id;
      await client.query(
        `INSERT INTO public.media_sources (media_id, provider, provider_media_type, external_id)
         VALUES ($1, $2, $3, $4)`,
        [mediaId, media.provider, media.mediaType, media.externalId]
      );
    }

    await syncGenres(client, mediaId, media.genres ?? []);

    for (const other of media.alsoKnownAs ?? []) {
      await client.query(
        `INSERT INTO public.media_sources (media_id, provider, provider_media_type, external_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (provider, provider_media_type, external_id) DO NOTHING`,
        [mediaId, other.provider, other.mediaType ?? media.mediaType, String(other.externalId)]
      );
    }

    await client.query('COMMIT');
    return mediaId;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Makes media_genres match the provider's current genre list exactly. */
async function syncGenres(client, mediaId, genreNames) {
  // De-duplicate case-insensitively, keep the first spelling.
  const unique = new Map();
  for (const name of genreNames) {
    const trimmed = String(name ?? '').trim();
    if (trimmed && !unique.has(trimmed.toLowerCase())) unique.set(trimmed.toLowerCase(), trimmed);
  }
  const names = [...unique.values()];
  const lowered = [...unique.keys()];

  if (names.length > 0) {
    await client.query(
      `INSERT INTO public.genres (name) SELECT unnest($1::text[]) ON CONFLICT ((LOWER(name))) DO NOTHING`,
      [names]
    );
  }
  const genreRows = names.length
    ? await client.query(`SELECT id FROM public.genres WHERE LOWER(name) = ANY($1::text[])`, [lowered])
    : { rows: [] };
  const genreIds = genreRows.rows.map((r) => r.id);

  // Remove links the provider no longer reports, then add missing ones.
  await client.query(`DELETE FROM public.media_genres WHERE media_id = $1 AND genre_id <> ALL($2::uuid[])`, [
    mediaId,
    genreIds
  ]);
  if (genreIds.length > 0) {
    await client.query(
      `INSERT INTO public.media_genres (media_id, genre_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
      [mediaId, genreIds]
    );
  }
}

export default { upsertMediaFromDetails };
