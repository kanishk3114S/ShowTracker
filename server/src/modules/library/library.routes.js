import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import * as c from './library.controller.js';
import * as g from './groups.controller.js';

/**
 * Every library route requires a verified user. `auth` is injectable only so
 * tests can supply fixed identities; production always uses requireAuth.
 */
export function createLibraryRouter({ auth = requireAuth } = {}) {
  const router = Router();
  router.use(auth);

  // Custom groups (many-to-many shelves). Registered first so '/groups' is never read as an entry id.
  router.get('/groups', g.list);
  router.post('/groups', g.create);
  router.patch('/groups/:id', g.update);
  router.delete('/groups/:id', g.remove);
  router.post('/groups/:id/items', g.addItem);
  router.delete('/groups/:id/items/:libraryEntryId', g.removeItem);
  router.get('/items/:libraryEntryId/groups', g.entryGroups);

  router.get('/', c.list);
  router.post('/', c.add);
  router.get('/stats', c.stats);
  router.get('/continue-watching', c.continueWatching);
  router.get('/upcoming', c.upcoming); // must stay above '/:id'
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
