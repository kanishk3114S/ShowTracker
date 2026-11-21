# External API Security Report

## Status: PASS

## Findings

1. **Provider Isolation & Client Separation:**
   - Client never calls external media providers (AniList, TMDB, TVmaze, TheTVDB) directly. All requests pass through the Express API backend.
   - Third-party API credentials (TMDB Bearer token, TheTVDB API key) remain strictly server-side and are never exposed in browser network requests.

2. **Timeout & Failure Handling:**
   - All upstream provider calls use `fetchWithTimeout` (`server/src/providers/providerError.js`) with an `AbortController` and configurable timeouts (default 14s, fast fallback 6s).
   - Network hangs, dropped connections, and timeouts throw normalized `ProviderError` instances with mapped HTTP status codes (502, 504, 429).
   - Single-provider outages do not crash the application. Fallback architecture gracefully serves cached catalog data or falls back from TMDB to TVmaze or TheTVDB.

3. **Rate Limit Handling:**
   - Both AniList and TMDB adapters monitor upstream rate-limit headers (`Retry-After`, `X-RateLimit-Reset`, `X-RateLimit-Remaining`).
   - When upstream quotas are exhausted (HTTP 429), adapters record local backoff windows and reject new outbound calls immediately, preventing abusive quota hammering.

4. **Data Validation:**
   - Raw data from external providers is validated and normalized in `services/mediaNormalizer.js` before being stored in PostgreSQL or returned to the client.
   - Ratings are normalized to a 0–10 scale, dates are validated to ISO YYYY-MM-DD format, and missing fields are set to `null` rather than fabricated.

## What's at risk
Unchecked external API failures could cause cascading server outages, thread pool exhaustion, credential leakage, or client crashes due to unexpected data formats.

## What's already secure
- Server-side token isolation.
- Automatic request timeout guards on every external call.
- Circuit breakers and fallback provider adapters.
- Comprehensive response normalization and input hygiene.

## Recommendations
- Continue enforcing timeouts and backoff handling on all external provider interactions.
