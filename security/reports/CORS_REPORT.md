# Cross-Origin Resource Sharing (CORS) Report

## Status: MEDIUM (Remediated / Plan Needed for Production Origin Allowlist)

## Findings

1. **Current CORS Configuration:**
   - In `server/src/app.js`:
     ```javascript
     const clientOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
       .split(',')
       .map((o) => o.trim().replace(/\/$/, ''))
       .filter(Boolean);
     app.use(
       cors({
         origin: [...new Set([...clientOrigins, 'http://localhost:5173', 'http://127.0.0.1:5173'])],
         credentials: true,
         methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
         allowedHeaders: ['Content-Type', 'Authorization']
       })
     );
     ```
2. **Analysis & Vulnerability Findings:**
   - Wildcard `*` origin is **NOT** used, and arbitrary origins are not reflected.
   - Allowed methods and headers are explicitly restricted (`methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']`, `allowedHeaders: ['Content-Type', 'Authorization']`).
   - Finding: In `server/src/app.js`, `http://localhost:5173` and `http://127.0.0.1:5173` are unconditionally appended to the CORS origin allowlist, even when `NODE_ENV === 'production'`.
   - In production, local development origins should only be included if explicitly specified in `CLIENT_URL`. When running in production, the origin list should be strictly confined to verified deployment domains.

## What's at risk
Permitting `localhost` origins in production could allow locally running rogue scripts or test servers on a developer's machine to communicate with the production API with credentials.

## What's already secure
- Explicit origin allowlist (no wildcard `*`).
- Strict HTTP methods and allowed headers restriction.
- CORS preflight OPTIONS requests are handled gracefully and bypass rate limit counters.

## Recommendations
- Modify `server/src/app.js` so that `localhost` and `127.0.0.1` are only included in the default CORS allowlist when `NODE_ENV !== 'production'`.
