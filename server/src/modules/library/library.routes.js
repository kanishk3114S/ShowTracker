import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import * as c from './library.controller.js';

/**
 * Every library route requires a verified user. `auth` is injectable only so
 * tests can supply fixed identities; production always uses requireAuth.
 */
export function createLibraryRouter({ auth = requireAuth } = {}) {
  const router = Router();
  router.use(auth);

  router.get('/', c.list);
  router.post('/', c.add);
  router.get('/stats', c.stats);
  router.get('/continue-watching', c.continueWatching);
  router.get('/recently-updated', c.recentlyUpdated);
  router.get('/check/:mediaId', c.check); // must stay above '/:id'
  router.patch('/:id', c.update);
  router.delete('/:id', c.remove);

  router.post('/:id/episodes/:episodeId/watched', c.markWatched);
  router.delete('/:id/episodes/:episodeId/watched', c.markUnwatched);
  router.post('/:id/seasons/:seasonId/watched', c.markSeason);

  return router;
}

export default createLibraryRouter();
