# Production Hardening & Upcoming Episodes Changelog

All notable changes made during the Master Production Hardening, Vibe Check Security Audit, and Upcoming Episodes Implementation are documented below.

---

## [Security & Hardening]

### Server Security Remediations
- **`server/src/middleware/requireAuth.js`**:
  - Removed internal `err.message` reflection in JWT verification catch block. Returns clean `401 Unauthorized` without internal error leakage.
- **`server/src/modules/health/health.controller.js`**:
  - Masked sensitive system metadata in production: Node.js version, database name, connected database user/role, database schema, and internal database exception details.
- **`server/src/app.js`**:
  - Hardened CORS origin allowlist to strictly prevent `http://localhost:5173` from qualifying when `NODE_ENV === 'production'`.
  - Removed software version disclosure string (`version: '1.0.0'`) from root `GET /` route.
- **`server/.gitignore`**:
  - Created strict git ignore covering `.env`, `.env.*`, certificates, logs, and coverage reports.
- **`render.yaml`**:
  - Synchronized static frontend security headers with `client/vercel.json`, adding `Content-Security-Policy` and `Permissions-Policy` to static deployment routing.

### Client Security Remediations
- **`client/vite.config.js`**:
  - Explicitly configured `build: { sourcemap: false }` to prevent production client source code reconstruction.
- **`client/.gitignore`**:
  - Hardened to explicitly ignore `.env`, `*.env`, `.env.local`, and `.env.production`.

---

## [Feature: Upcoming Episodes (Rolling 28-Day Window)]

### Backend Implementation
- **`server/src/providers/anilist.provider.js`**:
  - Implemented `AIRING_SCHEDULES_QUERY` GraphQL document.
  - Exported `getAnimeAiringSchedules(ids, nowSec, endSec)` for single-request batch schedule retrieval of up to 50 anime concurrently.
- **`server/src/modules/library/radar.service.js`**:
  - Defined `UPCOMING_WINDOW_DAYS = 28` and `UPCOMING_WINDOW_MS = 28 * 24 * 60 * 60 * 1000`.
  - Implemented `calculateUpcomingStatus(targetMs, nowMs, isDay)` to calculate chronological buckets (`TODAY`, `TOMORROW`, `THIS_WEEK`, `NEXT_WEEK`, `LATER`).
  - Expanded `listRadarCandidates` query to inspect all relevant library statuses (`WATCHING`, `PLAN_TO_WATCH`, `COMPLETED`, `ON_HOLD`, `REWATCHING`, `DROPPED`).
  - Added multi-episode retrieval pipeline:
    1. AniList batch `airingSchedules` GraphQL query.
    2. Catalog PostgreSQL query across `public.episodes` and `public.seasons` within the 28-day window.
    3. Metadata fallback for single future releases.
  - Added episode deduplication by unique show + episode composite key.
  - Added rich episode schema: `id`, `entryId`, `mediaId`, `provider`, `mediaType`, `title`, `posterUrl`, `seasonNumber`, `episodeNumber`, `episodeTitle`, `overview`, `airDate`, `releaseDate`, `releaseTime`, `airingAt`, `precision`, `timeUntilAiring`, `status`.
  - Returned `windowDays: 28` in response object.

### Frontend Implementation
- **`client/src/pages/Upcoming/Upcoming.jsx`**:
  - Created dedicated full-featured Upcoming Episodes page.
  - Implemented `groupUpcomingItems` to partition episodes into non-empty chronological sections: "Today", "Tomorrow", "This week", "Next week", and "Later in the next 28 days".
  - Implemented `UpcomingCard` with poster fallback (`PosterImage`), show title, `Sxx Exx`, episode title, overview synopsis, release date, release time, and live ticking countdown (`useNow`).
  - Implemented status badges: `Airing`, `New Season`, and `Hiatus Return`.
  - Implemented type filtering pills (All, Anime, TV Shows) with dynamic counts.
  - Implemented `UpcomingSkeleton`, `EmptyState`, and `ProviderErrorState` with retry.
- **`client/src/routes/pages.js`**:
  - Added `Upcoming` lazy loader to `pageLoaders`.
  - Added `/upcoming` route to route prefetching and `prefetchRouteData`.
- **`client/src/App.jsx`**:
  - Added `/upcoming` route wrapped with `ProtectedRoute`.
- **`client/src/components/layout/TopHeader.jsx`**:
  - Added "Upcoming" navigation link for authenticated users.
- **`client/src/components/layout/MobileNav.jsx`**:
  - Added "Upcoming" navigation item with `CalendarClock` icon to mobile bottom dock.
- **`client/src/components/dashboard/ReleaseRadar.jsx`**:
  - Updated card links to point to `/upcoming` with label "View all upcoming".

---

## [Testing & Quality Assurance]

- **`server/test/upcoming-episodes.test.js`**:
  - Created automated test suite covering:
    - `calculateUpcomingStatus` time bucket categorization.
    - 28-day rolling window duration.
    - Category A: Running show with multiple episodes in next 28 days.
    - Category B: Announced upcoming season with confirmed premiere date.
    - Category C: Show on hiatus with confirmed return date.
    - Category D: Completed / cancelled show with no future dates excluded.
    - Window boundary enforcement (> 28 days excluded).
    - Library isolation (only user's own saved shows returned).
  - Result: **8 / 8 tests passed**.
- **`server/test/release-radar.test.js`**:
  - Verified backward compatibility: all existing tests pass without regressions.
- **Client Build & Lint**:
  - `oxlint`: 0 errors.
  - `vite build`: Succeeded in 6.20s with clean code-split chunks.

---

## [Security Audit Reports & Documentation]

- `PROJECT_ARCHITECTURE.md`: Complete system architecture map.
- `AI-CHECKLIST.md`: Vibe Check framework rules and categories.
- `manual-checklist.md`: Manual verification checklist.
- `security/AUDIT_SUMMARY.md`: Summary of the 18 security categories.
- `security/MANUAL_VERIFICATION.md`: Verification steps and findings.
- `security/reports/`: 12 category audit reports.
- `docs/UPCOMING_EPISODES_IMPLEMENTATION.md`: Technical specification for Upcoming Episodes.
- `PRODUCTION_READINESS.md`: Production readiness assessment and deployment checklist.
