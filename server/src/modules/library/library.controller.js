import { AppError } from '../../middleware/errorHandler.js';
import { withUserTransaction } from '../../db/withUserTransaction.js';
import * as service from './library.service.js';
import { getOwnerStats } from './library.stats.js';
import { getUpcoming } from './radar.service.js';
import { getSeasonsForMedia } from '../../services/episodeCatalog.service.js';
import {
  addLibrarySchema,
  updateLibrarySchema,
  listLibraryQuerySchema,
  entryParamsSchema,
  mediaParamsSchema,
  episodeParamsSchema,
  seasonParamsSchema
} from './library.validation.js';

export function parse(schema, input, message = 'Validation failed.') {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw new AppError(message, 400, 'VALIDATION_ERROR', details);
  }
  return result.data;
}

/** Wraps a handler: parse -> run inside the user's transaction -> JSON, errors to the central handler. */
export const handler = (run, status = 200, { readOnly = false } = {}) => async (req, res, next) => {
  try {
    const data = await withUserTransaction(req.user.id, (client) => run(client, req), { readOnly });
    // Library data is private: never let shared caches keep it.
    res.set('Cache-Control', 'private, no-store').status(status).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const list = handler(
  (client, req) =>
    service.listLibrary(client, req.user.id, parse(listLibraryQuerySchema, req.query, 'Invalid library filters.')),
  200,
  { readOnly: true }
);

export const check = handler(
  (client, req) => service.checkEntry(client, req.user.id, parse(mediaParamsSchema, req.params).mediaId),
  200,
  { readOnly: true }
);

export const add = async (req, res, next) => {
  try {
    const body = parse(addLibrarySchema, req.body);
    const data = await withUserTransaction(req.user.id, (client) => service.addEntry(client, req.user.id, body));
    // Anime are tracked as a whole series: load every season in the background so totals (e.g. 12 / 49) are right
    // from the first library view. Best effort; the episode tracker triggers the same (de-duplicated) sync.
    if (data.media.mediaType === 'ANIME' && process.env.NODE_ENV !== 'test') getSeasonsForMedia(data.mediaId).catch(() => {});
    res.set('Cache-Control', 'private, no-store').status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const update = handler((client, req) =>
  service.updateEntry(client, req.user.id, parse(entryParamsSchema, req.params).id, parse(updateLibrarySchema, req.body))
);

export const remove = handler((client, req) =>
  service.removeEntry(client, req.user.id, parse(entryParamsSchema, req.params).id)
);

export const markWatched = handler((client, req) => {
  const { id, episodeId } = parse(episodeParamsSchema, req.params);
  return service.setEpisodeWatched(client, req.user.id, id, episodeId, true);
});

export const markUnwatched = handler((client, req) => {
  const { id, episodeId } = parse(episodeParamsSchema, req.params);
  return service.setEpisodeWatched(client, req.user.id, id, episodeId, false);
});

export const markSeason = handler((client, req) => {
  const { id, seasonId } = parse(seasonParamsSchema, req.params);
  return service.markSeasonWatched(client, req.user.id, id, seasonId);
});

// ------------------------------------------------ dashboard data (private) --

const SHELF_SIZE = 10;

export const stats = handler((client, req) => getOwnerStats(client, req.user.id), 200, { readOnly: true });

/**
 * Release Radar: upcoming episodes of the user's WATCHING / PLAN_TO_WATCH anime and TV, soonest first.
 * Not wrapped in `handler`: stale airing data is refreshed from the providers (catalog writes) after the
 * user's read-only transaction has ended.
 */
export const upcoming = async (req, res, next) => {
  try {
    const allEpisodes = req.query.single !== 'true' && req.query.radar !== 'true';
    const data = await getUpcoming(req.user.id, { allEpisodes });
    res.set('Cache-Control', 'private, no-store').json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const continueWatching = handler(
  (client, req) =>
    service.listLibrary(client, req.user.id, {
      status: 'WATCHING',
      sort: 'updated_at',
      order: 'desc',
      limit: SHELF_SIZE
    }),
  200,
  { readOnly: true }
);

export const recentlyUpdated = handler(
  (client, req) => service.listLibrary(client, req.user.id, { sort: 'updated_at', order: 'desc', limit: SHELF_SIZE }),
  200,
  { readOnly: true }
);
