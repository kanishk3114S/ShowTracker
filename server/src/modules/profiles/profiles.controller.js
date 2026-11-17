import { withUserTransaction } from '../../db/withUserTransaction.js';
import { query } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import { loadPublicProfile } from './profiles.public.js';
import { listLibraryQuerySchema } from '../library/library.validation.js';
import { 
  updateProfileSchema, 
  checkUsernameSchema, 
  usernameRegex 
} from './profiles.validation.js';

/**
 * GET /api/profiles/username-availability?username=...
 * Check if a requested username is available.
 */
export async function checkUsernameAvailability(req, res, next) {
  try {
    const parseResult = checkUsernameSchema.safeParse(req.query);
    if (!parseResult.success) {
      return next(new AppError('Invalid username query parameter.', 400, 'VALIDATION_ERROR', parseResult.error.issues));
    }

    const rawUsername = parseResult.data.username;
    const normalized = rawUsername.toLowerCase().trim();

    if (!usernameRegex.test(normalized)) {
      return res.json({
        success: true,
        available: false,
        username: normalized,
        reason: 'Username must be 3-30 characters with only lowercase letters, numbers, and underscores.'
      });
    }

    // Query case-insensitively
    const result = await query(
      'SELECT id FROM public.profiles WHERE LOWER(username) = $1 LIMIT 1;',
      [normalized]
    );

    // If a row exists, it's taken unless it belongs to the authenticated caller
    let isAvailable = result.rows.length === 0;
    if (!isAvailable && req.user && result.rows[0].id === req.user.id) {
      isAvailable = true; // User's own username
    }

    res.json({
      success: true,
      available: isAvailable,
      username: normalized
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/profiles/me
 * Update authenticated user's ShowTracker profile.
 */
export async function updateMyProfile(req, res, next) {
  try {
    const userId = req.user.id;

    const parseResult = updateProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      return next(new AppError('Validation failed.', 400, 'VALIDATION_ERROR', parseResult.error.issues));
    }

    const {
      username,
      display_name,
      avatar_url,
      bio,
      profile_visibility,
      library_visibility
    } = parseResult.data;

    const updatedProfile = await withUserTransaction(userId, async (client) => {
      // 1. If username is provided, check for conflicts
      if (username) {
        const conflictCheck = await client.query(
          'SELECT id FROM public.profiles WHERE LOWER(username) = $1 AND id <> $2 LIMIT 1;',
          [username, userId]
        );
        if (conflictCheck.rows.length > 0) {
          throw new AppError('That username is already taken. Please choose another.', 409, 'USERNAME_TAKEN');
        }
      }

      // 2. Build parameterized dynamic update query
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (username !== undefined) {
        updates.push(`username = $${paramIndex++}`);
        values.push(username);
      }
      if (display_name !== undefined) {
        updates.push(`display_name = $${paramIndex++}`);
        values.push(display_name);
      }
      if (avatar_url !== undefined) {
        updates.push(`avatar_url = $${paramIndex++}`);
        values.push(avatar_url || null);
      }
      if (bio !== undefined) {
        updates.push(`bio = $${paramIndex++}`);
        values.push(bio);
      }
      if (profile_visibility !== undefined) {
        updates.push(`profile_visibility = $${paramIndex++}`);
        values.push(profile_visibility);
      }
      if (library_visibility !== undefined) {
        updates.push(`library_visibility = $${paramIndex++}`);
        values.push(library_visibility);
      }

      if (updates.length === 0) {
        throw new AppError('No fields provided for update.', 400, 'EMPTY_UPDATE');
      }

      values.push(userId);
      const updateSql = `
        UPDATE public.profiles
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING
          id,
          username,
          display_name,
          avatar_url,
          bio,
          profile_visibility,
          library_visibility,
          created_at,
          updated_at;
      `;

      try {
        const res = await client.query(updateSql, values);
        if (res.rows.length === 0) {
          throw new AppError('Profile not found.', 404, 'PROFILE_NOT_FOUND');
        }
        return res.rows[0];
      } catch (dbErr) {
        if (dbErr.code === '23505') { // unique_violation
          throw new AppError('That username is already taken.', 409, 'USERNAME_TAKEN');
        }
        if (dbErr.code === '23514') { // check_violation
          throw new AppError('Data violated constraint rules.', 400, 'CONSTRAINT_VIOLATION', dbErr.message);
        }
        throw dbErr;
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      profile: updatedProfile
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/:username
 * Public profile viewer with strict privacy enforcement (see profiles.public.js).
 * Responds 404 both for unknown usernames and for private profiles viewed by
 * anyone but their owner, so the endpoint reveals nothing extra.
 */
export async function getPublicProfile(req, res, next) {
  try {
    const rawUsername = req.params.username;
    if (!rawUsername) {
      return next(new AppError('Username parameter is required.', 400, 'MISSING_USERNAME'));
    }

    const username = rawUsername.toLowerCase().trim();
    // Usernames are 3-30 chars of [a-z0-9_]; anything else cannot exist, so skip the database.
    if (!usernameRegex.test(username)) {
      return next(new AppError('User not found.', 404, 'USER_NOT_FOUND'));
    }

    const parsed = listLibraryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(new AppError('Invalid library filters.', 400, 'VALIDATION_ERROR', details));
    }

    const result = await loadPublicProfile({
      username,
      callerId: req.user?.id || null,
      filters: parsed.data
    });
    if (!result) return next(new AppError('User not found.', 404, 'USER_NOT_FOUND'));

    // The response differs per viewer (owner vs stranger), so shared caches must not keep it.
    res.set('Cache-Control', 'private, no-store').json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}
