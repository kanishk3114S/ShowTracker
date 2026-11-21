# Secrets Exposure Security Report

## Status: PASS (With Defense-in-Depth Recommendations)

## Findings

1. **Environment Files & Git Tracking:**
   - Root `.gitignore` correctly ignores `.env`, `*.env`, `.env.local`, `.env.*.local`.
   - Verified with `git ls-files`: only `.env.example` files (`client/.env.example`, `server/.env.example`) are tracked in Git. No real `.env` file has ever been staged or committed.
   - Minor defense-in-depth finding: `client/.gitignore` lacked an explicit `.env` line (though covered by root `.gitignore`), and `server/` lacked its own local `.gitignore`.

2. **Frontend Codebase Inspection:**
   - Searched `client/src` for sensitive credential tokens: No API keys, database connection strings, or service tokens are embedded in frontend code.
   - Frontend environment variables in `client/.env.example` and `client/src`:
     - `VITE_API_URL`: points to Express backend `/api`.
     - `VITE_SUPABASE_URL`: Supabase project URL (public).
     - `VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase anon/publishable key (safe for browser use with RLS).
     - `VITE_SITE_URL`: public URL used for OpenGraph preview tags.
   - No private provider keys (e.g. TMDB Bearer Token, TheTVDB key) are prefixed with `VITE_` or referenced in client code.

3. **Backend Codebase Inspection:**
   - Secrets (`DATABASE_URL`, `MIGRATION_DATABASE_URL`, `TMDB_API_READ_ACCESS_TOKEN`, `TVDB_API_KEY`) are accessed strictly via `process.env` on the Node.js server.
   - Server `.env.example` contains only safe placeholder strings (`YOUR_PASSWORD`, `YOUR_PROJECT_REF`, `replace_me`).
   - `render.yaml` sets all sensitive environment variables with `sync: false` to ensure credentials must be manually supplied in Render's secrets vault.

4. **Git History Inspection:**
   - Evaluated full repository commit log and commit diffs for patterns (`sk_live`, `sk_test`, `Bearer ey`, `password=`, `postgres://`).
   - No credentials or live tokens have been committed in repository history.

5. **Source Map Configuration:**
   - `client/vite.config.js` does not enable production source maps (`build.sourcemap: false` is standard default in Vite).
   - Recommendation: Explicitly declare `sourcemap: false` in `vite.config.js` `build` options.

## What's at risk
If credentials or tokens were exposed in the frontend or Git history, attackers could bypass application controls, query backend data stores, exhaust third-party API quotas, or manipulate records.

## What's already secure
- Zero hardcoded secrets in frontend or backend source files.
- Separation of client publishable keys and backend read access tokens.
- Git history is clean of credentials.
- All database connection strings are confined to server-side runtime environments.

## Recommendations
1. Add `.env` and `*.env` explicitly to `client/.gitignore` and create `server/.gitignore`.
2. Explicitly specify `sourcemap: false` in `client/vite.config.js` `build` configuration.
