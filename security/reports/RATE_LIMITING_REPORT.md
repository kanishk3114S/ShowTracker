# Rate Limiting & Denial of Service Report

## Status: PASS

## Findings

1. **Multi-Tier Rate Limiting Architecture:**
   - Implemented in `server/src/middleware/rateLimit.js`:
     - Global API ceiling: 600 req/min per IP (`apiLimiter`).
     - Media discovery (search, trending, franchise): 60 req/min per IP (`mediaDiscoveryLimiter`).
     - Auth verification endpoints: 60 req/min per IP (`authLimiter`).
     - Username availability checks: 30 req/min per IP (`usernameCheckLimiter`).
   - Responds with HTTP 429 (`RATE_LIMITED`), standard `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` headers, and `Retry-After` seconds.

2. **Reverse Proxy & IP Spoofing Protection:**
   - In `server/src/app.js`:
     ```javascript
     const trustProxy = process.env.TRUST_PROXY ?? (process.env.NODE_ENV === 'production' ? '1' : '');
     if (trustProxy) app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true');
     ```
   - In production behind standard PaaS (Render, Railway), `trust proxy` is set to `1` hop, extracting client IP from `X-Forwarded-For` without blindly trusting spoofed multi-hop headers from arbitrary clients.

3. **In-Memory Map Hygiene:**
   - `createRateLimiter` sweeps expired entries every minute via an unref'd timer (`sweep.unref()`), preventing memory leaks over time.

## What's at risk
Without rate limiting, abusive automated scrapers could exhaust third-party API quotas (AniList, TMDB) or launch denial-of-service attacks against backend services.

## What's already secure
- Tiered limiters protecting upstream quotas and database queries.
- Proper HTTP 429 status and Retry-After headers.
- Reverse proxy trust configuration.

## Recommendations
- If horizontally scaling across multiple container instances in the future, migrate the rate limiting state from in-memory Maps to a distributed store such as Redis.
