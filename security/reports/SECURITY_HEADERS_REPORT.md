# Security Headers & Content Security Policy (CSP) Report

## Status: MEDIUM (Remediated / Plan Needed for Render Blueprint Alignment)

## Findings

1. **Express Backend Security Headers:**
   - In `server/src/app.js`, `helmet` sets:
     - `Content-Security-Policy`: `default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`. (Appropriate for a JSON-only REST API).
     - `Strict-Transport-Security`: `max-age=31536000; includeSubDomains; preload`.
     - `X-Frame-Options`: `DENY` via frameguard.
     - `X-Content-Type-Options`: `nosniff`.
     - `Referrer-Policy`: `strict-origin-when-cross-origin`.
     - `X-Powered-By`: disabled via `app.disable('x-powered-by')`.

2. **Frontend Hosting Headers (Vercel):**
   - In `client/vercel.json`:
     - Comprehensive CSP with exact origins:
       - `default-src 'self'`
       - `script-src 'self'`
       - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
       - `img-src 'self' data: blob: https://image.tmdb.org https://s4.anilist.co https://static.tvmaze.com https://artworks.thetvdb.com https://*.supabase.co https://lh3.googleusercontent.com`
       - `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.onrender.com https://*.up.railway.app`
       - `font-src 'self' https://fonts.gstatic.com`
       - `object-src 'none'`
       - `base-uri 'self'`
       - `form-action 'self'`
       - `frame-ancestors 'none'`
     - `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` (`camera=(), microphone=(), geolocation=()`).

3. **Frontend Hosting Headers (Render Blueprint Gap):**
   - In `render.yaml`, lines 48-60, the frontend static service defines headers for `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Strict-Transport-Security`.
   - Finding: `Content-Security-Policy` and `Permissions-Policy` headers are missing from `render.yaml`! If deployed to Render static hosting, the CSP header would not be attached.
   - Remediation: Synchronize `Content-Security-Policy` and `Permissions-Policy` from `vercel.json` into `render.yaml`.

## What's at risk
Without a CSP header on CDN-hosted static files, any injected cross-site script could execute unimpeded, exfiltrate tokens, or load unauthorized resources.

## What's already secure
- Helmet enforces strict API headers in Express.
- Complete, robust CSP and Permissions-Policy in `vercel.json`.

## Recommendations
- Add `Content-Security-Policy` and `Permissions-Policy` headers to `render.yaml` for full parity across hosting providers.
