import { Router } from 'express';
import { requireAuth } from '../../middleware/requireAuth.js';
import { getMe } from './auth.controller.js';

const router = Router();

// GET /api/auth/me (Protected)
router.get('/me', requireAuth, getMe);

export default router;
