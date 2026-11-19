import { pool } from '../config/database.js';

/**
 * Database-first title details.
 *
 * Opening a details page stores the full normalized record in `media_items.metadata.snapshot`
 * (see mediaPersistence.service.js). Later visits are answered from PostgreSQL while the snapshot
 * is fresh, so a slow or unreachable provider cannot block a title the app already knows. When the
 * snapshot is stale the provider is asked again, and if THAT fails the stale snapshot is served
 * rather than an error.
 */
const AIRING = new Set(['RELEASING', 'NOT_YET_RELEASED', 'Returning Series', 'In Production', 'Planned', 'Pilot']);
const FRESH_AIRING_MS = 20 * 60 * 1000; // a running show changes often (next episode, counts)
const FRESH_SETTLED_MS = 6 * 60 * 60 * 1000;
const FRESH_FALLBACK_MS = 10 * 60 * 1000; // data from a fallback provider: ask TMDB again soon

/** The stored snapshot of a title, or null. Never throws: a database problem just means "ask the provider". */
export async function readStoredDetails(provider, mediaType, externalId, db = pool) {
  try {
    const { rows } = await db.query(
      `SELECT mi.id, mi.metadata->'snapshot' AS snapshot
         FROM public.media_sources ms
         JOIN public.media_items mi ON mi.id = ms.media_id
        WHERE ms.provider = $1 AND ms.provider_media_type = $2 AND ms.external_id = $3
        LIMIT 1`,
      [provider, mediaType, String(externalId)]
    );
    const snapshot = rows[0]?.snapshot;
    if (!snapshot?.media?.title || typeof snapshot.savedAt !== 'number') return null;
    return { id: rows[0].id, media: snapshot.media, savedAt: snapshot.savedAt };
  } catch (err) {
    console.warn('[Catalog] Could not read the stored title:', err.message);
    return null;
  }
}

export function isSnapshotFresh(stored, now = Date.now()) {
  if (!stored) return false;
  const fromFallback = Boolean(stored.media.dataSource) && stored.media.dataSource !== stored.media.provider;
  const ttl = fromFallback ? FRESH_FALLBACK_MS : AIRING.has(stored.media.status) ? FRESH_AIRING_MS : FRESH_SETTLED_MS;
  return now - stored.savedAt < ttl;
}
