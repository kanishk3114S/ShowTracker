# Dependency Security Report

## Status: LOW (Audit Findings Reviewed)

## Findings

1. **Client Dependencies:**
   - Ran `npm audit` in `client/`:
     - Result: `found 0 vulnerabilities`.
   - Core packages:
     - `react` 19.3.1, `react-dom` 19.3.1
     - `react-router-dom` 7.18.5
     - `axios` 1.21.1
     - `motion` 14.14.0
     - `@supabase/supabase-js` 2.119.0
     - `lucide-react` 1.73.0
     - `vite` 8.3.6

2. **Server Dependencies:**
   - Ran `npm audit` in `server/`:
     - Result: 2 moderate vulnerabilities in devDependency `nodemon` -> `minimatch` (potential DoS via globparts amplification, GHSA-g3hv-75wg-m249).
     - Production runtime dependencies (`express`, `pg`, `helmet`, `cors`, `zod`, `morgan`, `dotenv`, `@supabase/supabase-js`) have **zero vulnerabilities**.
     - `nodemon` is used exclusively during local development (`npm run dev`) and is not bundled or executed in production (`npm start` runs `node src/server.js`).

3. **Lockfile Integrity:**
   - Both `client/package-lock.json` and `server/package-lock.json` are present and committed.

## What's at risk
Vulnerable production dependencies could be leveraged for supply chain compromise, ReDoS, or remote execution.

## What's already secure
- Zero vulnerabilities across all production runtime packages in both client and server.
- All package versions pinned and locked.

## Recommendations
- Run `npm update nodemon` or `npm audit fix` in `server/` to upgrade `nodemon` to a version that depends on fixed `minimatch`.
