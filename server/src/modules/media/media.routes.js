import { Router } from 'express';
import { search, trending, genres, details } from './media.controller.js';

const router = Router();

// Public catalog endpoints: provider data is not user-specific, so no auth is required.
router.get('/search', search);
router.get('/trending', trending);
router.get('/genres', genres);
router.get('/details/:provider/:mediaType/:externalId', details);

export default router;
