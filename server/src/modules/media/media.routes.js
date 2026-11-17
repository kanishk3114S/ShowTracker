import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { search, trending, genres, details, seasons } from './media.controller.js';

const router = Router();

// Public catalog endpoints: provider data is not user-specific, so no auth is required.
router.get('/search', search);
router.get('/trending', trending);
router.get('/genres', genres);
router.get('/details/:provider/:mediaType/:externalId', details);

// Seasons + episodes for a catalog title. Requires sign-in because it can trigger provider calls and catalog writes.
router.get('/:mediaId/seasons', requireAuth, seasons);

export default router;
