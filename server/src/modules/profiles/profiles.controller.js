import { withUserTransaction } from '../../db/withUserTransaction.js';
import { query } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
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
      return next(new AppError('Invalid username query parameter.', 400, 'VALIDATION_ERROR', parseResult.error.errors));
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
      return next(new AppError('Validation failed.', 400, 'VALIDATION_ERROR', parseResult.error.errors));
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
 * Public profile viewer with privacy enforcement.
 */
export async function getPublicProfile(req, res, next) {
  try {
    const rawUsername = req.params.username;
    if (!rawUsername) {
      return next(new AppError('Username parameter is required.', 400, 'MISSING_USERNAME'));
    }

    const normalized = rawUsername.toLowerCase().trim();
    const callerId = req.user?.id || null;

    // Public safe projection: never expose email, passwords, or internal auth metadata
    const profileRes = await query(
      `SELECT
        id,
        username,
        display_name,
        avatar_url,
        bio,
        profile_visibility,
        library_visibility,
        created_at
      FROM public.profiles
      WHERE LOWER(username) = $1
      LIMIT 1;`,
      [normalized]
    );

    if (profileRes.rows.length === 0) {
      return next(new AppError('User not found.', 404, 'USER_NOT_FOUND'));
    }

    const profile = profileRes.rows[0];
    const isOwner = callerId && callerId === profile.id;

    // Privacy rule: if profile_visibility is PRIVATE and caller is not owner, return 404
    if (profile.profile_visibility === 'PRIVATE' && !isOwner) {
      return next(new AppError('User not found or profile is private.', 404, 'USER_NOT_FOUND'));
    }

    res.json({
      success: true,
      profile: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
        profile_visibility: profile.profile_visibility,
        library_visibility: profile.library_visibility,
        created_at: profile.created_at,
        isOwner: Boolean(isOwner)
      }
    });
  } catch (err) {
    next(err);
  }
}
