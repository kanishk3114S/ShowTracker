# Error Handling & Information Disclosure Report

## Status: MEDIUM (Remediated / Plan Needed for Version & Health Endpoint Disclosure)

## Findings

1. **Production Error Masking:**
   - Centralized error handler `errorHandler.js` checks `process.env.NODE_ENV !== 'production'`.
   - In production, non-operational errors (such as unexpected database connection dropouts or syntax bugs) are masked with a generic message:
     `{ success: false, error: { message: 'An unexpected internal error occurred.', code: 'INTERNAL_SERVER_ERROR' } }`
   - Stack traces are strictly suppressed in production (`...(isDevelopment && err.stack ? { stack: err.stack } : {})`).
   - Detailed error information is logged server-side only via `console.error`.

2. **Vulnerability Finding A: Verbose Health Endpoint in Production:**
   - In `server/src/modules/health/health.controller.js`:
     ```javascript
     services: {
       server: {
         status: 'healthy',
         nodeVersion: process.version  // <--- Exposes exact Node version (e.g. v22.14.0)
       },
       database: {
         status: dbStatus.ok ? 'connected' : 'disconnected',
         engine: 'PostgreSQL',
         ...(dbStatus.ok
           ? {
               serverTime: dbStatus.time,
               database: dbStatus.database,  // <--- Exposes database name
               connectedAs: dbStatus.user,   // <--- Exposes database role
               schema: dbStatus.schema       // <--- Exposes schema
             }
           : {
               error: dbStatus.error,        // <--- Leaks raw DB connection error
               hint: 'Check DATABASE_URL in server/.env or ensure PostgreSQL is running.' // <--- Leaks env var names
             })
       }
     }
     ```
   - In production, disclosing internal database names, role names, schema names, exact Node.js runtime versions, and database error messages with environment variable names represents an information disclosure vulnerability.

3. **Vulnerability Finding B: Root Route Version Disclosure:**
   - In `server/src/app.js`:
     ```javascript
     app.get('/', (req, res) => {
       res.json({
         message: 'ShowTracker API is active. Health check available at /api/health',
         version: '1.0.0', // <--- Exposes software version
         endpoints: { ... }
       });
     });
     ```
   - Discloses software version number publicly.

## What's at risk
Information disclosure aids attackers in mapping backend infrastructure, identifying specific version CVEs, or learning internal database topology.

## What's already secure
- Centralized error handler suppresses database errors and stack traces in production.
- `app.disable('x-powered-by')` removes the `X-Powered-By: Express` header.

## Recommendations
1. Modify `health.controller.js` to suppress `nodeVersion`, `database`, `connectedAs`, `schema`, `error`, and `hint` when `NODE_ENV === 'production'`.
2. Remove `version` from the root route response in `app.js`.
