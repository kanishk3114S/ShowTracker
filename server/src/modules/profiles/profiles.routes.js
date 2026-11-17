import { Router } from 'express';
import { requireAuth, optionalAuth } from '../../middleware/requireAuth.js';
import {
  checkUsernameAvailability,
  updateMyProfile,
  getPublicProfile
} from './profiles.controller.js';

const router = Router();

// GET /api/profiles/username-availability?username=... (Optional auth to recognize own username)
router.get('/username-availability', optionalAuth, checkUsernameAvailability);

// PATCH /api/profiles/me (Protected)
router.patch('/me', requireAuth, updateMyProfile);

// GET /api/users/:username (Public with privacy checks)
router.get('/users/:username', optionalAuth, getPublicProfile);

export default router;
