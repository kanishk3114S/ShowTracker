import { withUserTransaction } from '../../db/withUserTransaction.js';
import { AppError } from '../../middleware/errorHandler.js';

/**
 * GET /api/auth/me
 * Returns verified authenticated user identity, their ShowTracker profile,
 * and onboarding status (needsOnboarding = true if username is null).
 */
export async function getMe(req, res, next) {
  try {
    const userId = req.user.id;
    const email = req.user.email;

    const profile = await withUserTransaction(userId, async (client) => {
      // 1. Fetch profile for the authenticated user under their RLS context
      const selectQuery = `
        SELECT
          id,
          username,
          display_name,
          avatar_url,
          bio,
          profile_visibility,
          library_visibility,
          created_at,
          updated_at
        FROM public.profiles
        WHERE id = $1;
      `;
      let result = await client.query(selectQuery, [userId]);

      // 2. Fallback: If for any reason the trigger had not created the row yet,
      // create it safely with ON CONFLICT DO NOTHING
      if (result.rows.length === 0) {
        const insertQuery = `
          INSERT INTO public.profiles (
            id,
            username,
            display_name,
            profile_visibility,
            library_visibility
          ) VALUES ($1, NULL, NULL, 'PUBLIC', 'PUBLIC')
          ON CONFLICT (id) DO NOTHING
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
        const insertResult = await client.query(insertQuery, [userId]);
        if (insertResult.rows.length > 0) {
          result = insertResult;
        } else {
          result = await client.query(selectQuery, [userId]);
        }
      }

      return result.rows[0];
    });

    if (!profile) {
      return next(new AppError('Profile could not be resolved.', 404, 'PROFILE_NOT_FOUND'));
    }

    res.json({
      success: true,
      user: {
        id: userId,
        email: email
      },
      profile: profile,
      needsOnboarding: profile.username === null
    });
  } catch (err) {
    next(err);
  }
}
