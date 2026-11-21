# API Security Report

## Status: PASS

## Findings

1. **Payload Size Limits:**
   - In `server/src/app.js`:
     ```javascript
     app.use(express.json({ limit: '100kb' }));
     app.use(express.urlencoded({ extended: true, limit: '100kb' }));
     ```
   - Request bodies are strictly capped at 100 kB, preventing large payload denial-of-service attempts.

2. **Input Validation:**
   - All input parameters (query parameters, path parameters, JSON request bodies) are parsed and validated using Zod schemas before entering service logic.
   - Unexpected fields are stripped, non-numeric values for IDs are rejected with 400 (`VALIDATION_ERROR`), and invalid UUIDs return structured error messages.

3. **HTTP Verb & Route Isolation:**
   - State-changing actions exclusively use `POST`, `PATCH`, `DELETE`.
   - `GET` endpoints are strictly read-only and idempotent.
   - Unrecognized routes are handled by centralized `notFoundHandler`, returning structured 404 JSON responses (`NOT_FOUND`).

4. **Error Masking:**
   - Centralized error handler masks non-operational database and system errors in production (`process.env.NODE_ENV === 'production'`), returning `{ success: false, error: { message: 'An unexpected internal error occurred.', code: 'INTERNAL_SERVER_ERROR' } }`.

## What's at risk
Unrestricted payload sizes or missing request validation could allow Denial of Service (DoS) attacks, memory exhaustion, or unexpected server crashes.

## What's already secure
- 100 kB JSON body limit enforced globally.
- Zod schema validation applied to all route inputs.
- Read-only GET methods prevent CSRF-based state changes.

## Recommendations
- Maintain Zod validation coverage across all newly introduced endpoints.
