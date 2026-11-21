# Authentication Security Report

## Status: MEDIUM (Remediated / Plan Needed for Error Disclosure in Catch Block)

## Findings

1. **Authentication Mechanism:**
   - Client manages Google OAuth using Supabase Auth with PKCE flow (`client/src/lib/supabase.js`).
   - Session access tokens (JWTs) are sent to the Express API via the `Authorization: Bearer <token>` HTTP header.
   - The Express backend does not trust client-decoded JWT claims. It validates each token cryptographically server-side via `supabase.auth.getUser(accessToken)` in `server/src/middleware/requireAuth.js`.
   - Populates `req.user = { id: data.user.id, email: data.user.email }` on success.

2. **Unauthenticated Access Handling:**
   - Missing Authorization header returns HTTP 401 (`AUTH_REQUIRED`).
   - Empty Bearer token returns HTTP 401 (`INVALID_TOKEN`).
   - Expired or signature-invalid token returns HTTP 401 (`TOKEN_EXPIRED_OR_INVALID`).
   - Verified by integration tests in `test/api.test.js`.

3. **Vulnerability Finding (Medium Severity):**
   - In `server/src/middleware/requireAuth.js` line 36:
     ```javascript
     } catch (err) {
       next(new AppError('Authentication verification failed.', 401, 'AUTH_FAILED', err.message));
     }
     ```
   - In `server/src/middleware/errorHandler.js`, `AppError` instances have `isOperational: true`, so `err.details` is included in the response when not masked. If `err.message` contains internal network or Supabase service error details, it could be returned in the API error response.
   - Remediation: Sanitize `details` in `requireAuth.js` catch handler to `null` so internal error strings are never reflected to clients.

## What's at risk
If verification fails due to internal network or parsing errors, raw upstream error messages could leak infrastructure specifics to unauthorized callers.

## What's already secure
- Cryptographic server-side verification of all tokens via official Supabase client.
- Consistent 401 status codes across all failure modes.
- Authentication middleware runs before route handlers on all protected routes.

## Recommendations
- Remove `err.message` from `AppError` details in `requireAuth.js`.
