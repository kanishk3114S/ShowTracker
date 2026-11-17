import { supabase } from '../config/supabase.js';
import { AppError } from './errorHandler.js';

/**
 * Express middleware to verify Supabase Auth Bearer access tokens.
 * Extracts the token, verifies it securely with Supabase Auth via auth.getUser(token),
 * and populates req.user = { id: data.user.id, email: data.user.email }.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Authentication required. Missing or malformed Bearer token.', 401, 'AUTH_REQUIRED'));
    }

    const accessToken = authHeader.split(' ')[1]?.trim();
    if (!accessToken) {
      return next(new AppError('Authentication required. Empty bearer token provided.', 401, 'INVALID_TOKEN'));
    }

    // Verify token with Supabase Auth
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data?.user) {
      return next(new AppError(error?.message || 'Invalid or expired access token.', 401, 'TOKEN_EXPIRED_OR_INVALID'));
    }

    // Set verified identity on req.user (trusted UUID and email)
    req.user = {
      id: data.user.id,
      email: data.user.email
    };

    next();
  } catch (err) {
    next(new AppError('Authentication verification failed.', 401, 'AUTH_FAILED', err.message));
  }
}

/**
 * Optional authentication middleware:
 * Populates req.user if a valid Bearer token is provided, but continues without error if unauthenticated.
 */
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const accessToken = authHeader.split(' ')[1]?.trim();
    if (!accessToken) {
      req.user = null;
      return next();
    }

    const { data } = await supabase.auth.getUser(accessToken);
    if (data?.user) {
      req.user = {
        id: data.user.id,
        email: data.user.email
      };
    } else {
      req.user = null;
    }

    next();
  } catch {
    req.user = null;
    next();
  }
}

export default {
  requireAuth,
  optionalAuth
};
