# ShowTracker — Manual Security Verification Guide

This guide details the manual verification steps for the project owner to validate the security posture of ShowTracker in staging or production.

---

## 1. Automated External Scanner (Vibe Check)

Run the standalone scanner against your deployed environment:

```bash
# If frontend and backend are hosted on the same domain:
python skills/vibe-check/scripts/check.py https://your-production-app.com --json

# If frontend (Vercel) and backend (Render/Railway) are on separate domains:
python skills/vibe-check/scripts/check.py https://your-frontend.vercel.app --api https://your-backend.onrender.com/api/health --json
```

**Checks Performed:**
- Publicly exposed `.env`, `.git/`, `.bak`, or database dumps.
- Public source maps (`.js.map`).
- Security headers: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`.
- CORS configuration: rejects unauthorized / reflected origins with credentials.
- Error disclosure and debug endpoints.

---

## 2. Secrets & Credential Verification

1. **Browser Network Inspection:**
   - Open browser DevTools (`F12`) -> **Network** tab.
   - Navigate to `/explore`, `/trending`, and open an anime or TV show detail page.
   - Verify that all requests go to `http://localhost:5000/api/...` or `https://<your-backend>/api/...`.
   - Verify that no requests go directly to `api.themoviedb.org` with a `Bearer` token.
   - Verify that the TMDB token is never present in any request URL, header, or response body.

2. **Frontend Bundle Search:**
   - In DevTools -> **Sources** or inspect `client/dist/assets/*.js`.
   - Search for `TMDB_API_READ_ACCESS_TOKEN`, `DATABASE_URL`, or `showtracker_app`.
   - Confirm none of these strings exist in the client JavaScript bundle.

3. **Source Maps Exposure:**
   - Request `https://your-frontend.vercel.app/assets/index-[hash].js.map`.
   - Verify that the server returns HTTP 404 (source maps are disabled in `vite.config.js`).

---

## 3. Database & RLS Isolation

1. **Verify Role Permissions in Supabase SQL Editor:**
   Run as `postgres`:
   ```sql
   SELECT grantee, table_name, privilege_type 
   FROM information_schema.role_table_grants 
   WHERE grantee = 'showtracker_app';
   ```
   Confirm that `showtracker_app` has only `SELECT`, `INSERT`, `UPDATE`, `DELETE` and cannot drop or alter tables.

2. **Cross-User Isolation Test:**
   - Sign in as **User A** (Account 1) in an incognito window and save a show with private notes.
   - Sign in as **User B** (Account 2) in another window.
   - Attempt to call:
     ```bash
     curl -H "Authorization: Bearer <USER_B_TOKEN>" https://your-backend/api/library/<USER_A_ENTRY_ID>
     ```
   - Confirm the API responds with HTTP 404 (`LIBRARY_ENTRY_NOT_FOUND`). User B cannot access User A's entry or notes.

---

## 4. Cross-Site Scripting (XSS) Verification

1. In User Settings or Library Notes, input the following test string:
   ```html
   <script>alert('xss')</script><b>Bold Title</b> & test "quotes"
   ```
2. Save the change and reload the page.
3. Verify that no alert box fires.
4. Verify that text displays cleanly escaped as plain text without rendering arbitrary markup.

---

## 5. CORS Verification

Send an OPTIONS preflight request from an unauthorized origin:
```bash
curl -I -X OPTIONS https://your-backend.onrender.com/api/health \
  -H "Origin: https://evil-attacker-site.com" \
  -H "Access-Control-Request-Method: GET"
```
**Expected Result:**
The response must **NOT** return `Access-Control-Allow-Origin: https://evil-attacker-site.com`.

---

## 6. Rate Limiting Verification

Run a rapid loop of 65 requests to `/api/media/search?q=test`:
```bash
for i in {1..65}; do curl -s -o /dev/null -w "%{http_code}\n" https://your-backend/api/media/search?q=test; done
```
**Expected Result:**
The first 60 requests return HTTP 200; requests 61–65 return HTTP 429 with `Retry-After` header.

---

## 7. External Provider Resilience

1. Temporarily invalidate or clear `TMDB_API_READ_ACCESS_TOKEN` in `server/.env`.
2. Open a TV show detail page (e.g. Breaking Bad or The Last of Us).
3. **Expected Result:**
   - Show details and episodes still load via TVmaze fallback.
   - The application does not crash.
   - Anime discovery (AniList) continues working without interruption.
