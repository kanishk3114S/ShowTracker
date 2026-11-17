import { AppError } from '../../middleware/errorHandler.js';
import { withUserTransaction } from '../../db/withUserTransaction.js';
import * as service from './library.service.js';
import { getOwnerStats } from './library.stats.js';
import {
  addLibrarySchema,
  updateLibrarySchema,
  listLibraryQuerySchema,
  entryParamsSchema,
  mediaParamsSchema,
  episodeParamsSchema,
  seasonParamsSchema
} from './library.validation.js';

function parse(schema, input, message = 'Validation failed.') {
  const result = schema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    throw new AppError(message, 400, 'VALIDATION_ERROR', details);
  }
  return result.data;
}

/** Wraps a handler: parse -> run inside the user's transaction -> JSON, errors to the central handler. */
const handler = (run, status = 200) => async (req, res, next) => {
  try {
    const data = await withUserTransaction(req.user.id, (client) => run(client, req));
    // Library data is private: never let shared caches keep it.
    res.set('Cache-Control', 'private, no-store').status(status).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const list = handler((client, req) =>
  service.listLibrary(client, req.user.id, parse(listLibraryQuerySchema, req.query, 'Invalid library filters.'))
);

export const check = handler((client, req) =>
  service.checkEntry(client, req.user.id, parse(mediaParamsSchema, req.params).mediaId)
);

export const add = handler(
  (client, req) => service.addEntry(client, req.user.id, parse(addLibrarySchema, req.body)),
  201
);

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

export const stats = handler((client, req) => getOwnerStats(client, req.user.id));

export const continueWatching = handler((client, req) =>
  service.listLibrary(client, req.user.id, {
    status: 'WATCHING',
    sort: 'updated_at',
    order: 'desc',
    limit: SHELF_SIZE
  })
);

export const recentlyUpdated = handler((client, req) =>
  service.listLibrary(client, req.user.id, { sort: 'updated_at', order: 'desc', limit: SHELF_SIZE })
);
