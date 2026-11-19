/**
 * Minimal in-memory fixed-window rate limiter (no dependency).
 *
 * It protects the free AniList / TMDB quotas and the username lookup from abuse.
 * State is local to one Node process (fine for a single instance; use a shared
 * store such as Redis if the API is ever scaled horizontally).
 *
 * Over the limit it answers HTTP 429 with the API's usual JSON error shape and a
 * `Retry-After` header (seconds). Standard `RateLimit-*` headers are always sent.
 *
 * Disabled while NODE_ENV=test so suites that fire many requests are unaffected;
 * set RATE_LIMIT_FORCE=true to switch it back on (the production smoke test does).
 */
export function createRateLimiter({ name, windowMs = 60_000, max }) {
  const hits = new Map(); // `${ip}` -> { count, resetAt }

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs);
  sweep.unref();

  const middleware = (req, res, next) => {
    if (process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_FORCE !== 'true') return next();
    if (req.method === 'OPTIONS') return next(); // CORS preflight is not a real request

    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil((entry.resetAt - now) / 1000)));

    if (entry.count > max) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Too many requests. Please wait ${retryAfter} second${retryAfter === 1 ? '' : 's'} and try again.`,
          retryAfterSeconds: retryAfter,
          limiter: name
        }
      });
    }
    return next();
  };

  middleware.reset = () => hits.clear();
  return middleware;
}

/** 60 requests / minute / IP: protects the provider quotas behind search and trending. */
export const mediaDiscoveryLimiter = createRateLimiter({ name: 'media-discovery', max: 60 });
/** Sign-in/identity endpoints: 60 / minute / IP (a page load needs 1) blocks token-guessing floods. */
export const authLimiter = createRateLimiter({ name: 'auth', max: 60 });
/** A generous ceiling for the whole API (600 / minute / IP): stops scripted hammering, never a person. */
export const apiLimiter = createRateLimiter({ name: 'api', max: 600 });
/** 30 requests / minute / IP for the (unauthenticated-capable) username availability lookup. */
export const usernameCheckLimiter = createRateLimiter({ name: 'username-availability', max: 30 });
