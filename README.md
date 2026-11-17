<div align="center">

# 🎬 ShowTracker

**One account. One library. Everything you watch.**

Discover anime, movies and TV shows from one cinematic interface, powered by real data from AniList and TMDB.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-22-5FA04E?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![Postgres](https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?logo=supabase&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)

</div>

---

## ✨ Features

| | Status |
|---|---|
| 🔐 **Google sign-in** with Supabase Auth (PKCE), username onboarding, profile & privacy settings | ✅ Done |
| 👤 **Public profiles** with per-user privacy controls | ✅ Done |
| 🛡️ **Row Level Security** with a restricted database role and transaction-scoped user identity | ✅ Done |
| 🔎 **Unified search** across anime (AniList), movies and TV (TMDB) with genre and year filters | ✅ Done |
| 🔥 **Trending** lists (TMDB daily/weekly, AniList trending ranking) | ✅ Done |
| 🎞️ **Detail pages** with posters, backdrops, genres, ratings, runtime, seasons and related anime | ✅ Done |
| 🗂️ **Shared media catalog** stored in PostgreSQL as titles are opened | ✅ Done |
| 📚 **Personal library**: watch status, ratings, favorites, private notes | ✅ Done |
| ✅ **Episode tracking** for anime and TV (seasons, per-episode and per-season, auto status) | ✅ Done |
| 🌐 Public library sharing, followers, social features | 🛠️ Planned (Phase 5+) |

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, JavaScript (ESM), Tailwind CSS v3, React Router v7, Axios, Lucide |
| **Backend** | Node.js 22, Express (ESM), Zod, Helmet, CORS, Morgan |
| **Database** | Supabase PostgreSQL via `pg.Pool` (parameterized SQL, no ORM) |
| **Auth** | Supabase Auth (Google OAuth) verified server-side |
| **Providers** | AniList GraphQL (anime), TMDB REST v3 (movies & TV) |
| **Tooling** | nodemon, concurrently, Node's built-in test runner, supertest, oxlint |

---

## 🏗️ Architecture

The browser never talks to AniList or TMDB. Everything goes through the Express API, which keeps the TMDB token private, normalizes both providers into one shape, caches responses, and stores titles in the shared catalog.

```mermaid
flowchart LR
    U([User]) --> R[React + Vite<br/>:5173]
    R -- "/api/media/*" --> E[Express API<br/>:5000]
    R -- "OAuth session" --> S[Supabase Auth]
    E -- "token check" --> S
    E --> C{{In-memory<br/>TTL cache}}
    C --> A[AniList GraphQL]
    C --> T[TMDB REST]
    E -- "showtracker_app role<br/>RLS enforced" --> D[(Supabase<br/>PostgreSQL)]
```

### Sign-in flow

```mermaid
sequenceDiagram
    actor User
    participant React
    participant Supabase as Supabase Auth
    participant Express
    participant DB as PostgreSQL

    User->>React: Continue with Google
    React->>Supabase: signInWithOAuth(google)
    Supabase-->>React: Session via /auth/callback
    React->>Express: GET /api/auth/me (Bearer token)
    Express->>Supabase: getUser(token)
    Express->>DB: withUserTransaction(userId) → profile
    Express-->>React: { user, profile, needsOnboarding }
```

### Media provider architecture

| Media type | Provider | Adapter |
|---|---|---|
| Anime | AniList (GraphQL, no key) | [`anilist.provider.js`](server/src/providers/anilist.provider.js) |
| Movies, TV | TMDB v3 (bearer token) | [`tmdb.provider.js`](server/src/providers/tmdb.provider.js) |

- [`mediaNormalizer.js`](server/src/services/mediaNormalizer.js) converts both into one object: ratings on a 0–10 scale, ISO dates, missing data left as `null` (never invented).
- [`mediaCatalog.service.js`](server/src/services/mediaCatalog.service.js) routes by media type, caches responses, and keeps successful results when one provider fails.
- [`mediaPersistence.service.js`](server/src/services/mediaPersistence.service.js) upserts a title into the catalog when its detail page opens (transaction + advisory lock, so no duplicates).

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 22+ and **npm** 10+
- A free **Supabase** project
- A free **TMDB** account (for movies and TV)

### Install

```bash
npm run install:all
```

### Environment variables

**`client/.env`**

```env
VITE_API_URL=http://localhost:5000/api
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

**`server/.env`** (see [`server/.env.example`](server/.env.example))

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173

SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key

# Runtime connection used by Express: the RESTRICTED role (note the .PROJECT_REF suffix)
DATABASE_URL=postgresql://showtracker_app.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-YOUR_REGION.pooler.supabase.com:5432/postgres?sslmode=require

# Migration connection used only for DDL (admin role)
MIGRATION_DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-YOUR_REGION.pooler.supabase.com:5432/postgres?sslmode=require

# TMDB "API Read Access Token" (backend only, never a VITE_ variable)
TMDB_API_READ_ACCESS_TOKEN=your_tmdb_read_access_token
```

> **IPv4 note:** Supabase direct connections (`db.<ref>.supabase.co`) are IPv6-only. On an IPv4 network use the **Session Pooler** URI from *Supabase Dashboard → Connect*. If your password contains special characters such as `@`, URL-encode them (`@` → `%40`).

> **Never commit `.env` files.** They are git-ignored.

### TMDB token

1. Create an account at [themoviedb.org](https://www.themoviedb.org) and open *Settings → API*.
2. Copy the **API Read Access Token** (the long one, not the short API key).
3. Put it in `server/.env` and restart the backend.

Without a token, anime still works and movie/TV sections show a clear "TMDB is not configured" message. AniList needs no configuration.

### Google sign-in setup

1. **Google Cloud Console** → *APIs & Services → Credentials → OAuth client ID* (Web application).
   - Authorized JavaScript origin: `http://localhost:5173`
   - Authorized redirect URI: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
2. **Supabase Dashboard** → *Authentication → Providers → Google*: enable it and paste the client ID and secret.
3. *Authentication → URL Configuration*: Site URL `http://localhost:5173`, redirect URL `http://localhost:5173/auth/callback`.

### Database setup

1. In the Supabase **SQL Editor**, run [`supabase/setup/create_showtracker_app_role.sql`](supabase/setup/create_showtracker_app_role.sql) (set a strong password first). This creates the restricted `showtracker_app` role (`NOSUPERUSER`, `NOBYPASSRLS`).
2. Apply migrations:

   ```bash
   npm run db:migrate
   ```

3. Verify:

   ```bash
   npm run db:verify
   ```

### Run

```bash
npm run dev          # backend (nodemon) + frontend together
```

- App: <http://localhost:5173>
- API health: <http://localhost:5000/api/health> (also shown at `/health` in the app)

---

## 🔌 API

All media endpoints are public `GET` requests. Responses look like `{ "success": true, "data": ... }`.

| Endpoint | Purpose |
|---|---|
| `/api/media/search?q=&type=ALL\|ANIME\|MOVIE\|TV&page=&genre=&year=` | Search by title, or browse by popularity when `q` is empty (`q` needs 2+ characters) |
| `/api/media/trending?type=&window=day\|week&page=` | TMDB daily/weekly trending; anime uses AniList's trending ranking (no time window) |
| `/api/media/details/:provider/:mediaType/:externalId` | Details, e.g. `/ANILIST/ANIME/1`, `/TMDB/MOVIE/27205`. `?refresh=1` bypasses the cache |
| `/api/media/genres?type=` | Genre names for filters |

Search and trending return `groups` (one per media type), so one failing provider never hides the others. Provider errors are normalized (`PROVIDER_RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `MEDIA_NOT_FOUND`, …).

### Library & episode tracking (signed-in users only)

Send `Authorization: Bearer <supabase access token>`. All data is private (`Cache-Control: no-store`).

| Endpoint | Purpose |
|---|---|
| `GET /api/library?status=&mediaType=&sort=updated_at\|title\|rating\|release_date&order=` | Your library with derived progress (`watchedEpisodesCount` / `totalEpisodes`) |
| `GET /api/library/check/:mediaId` | Your entry for a title (or `null`) plus watched episode ids |
| `POST /api/library` | Add `{ mediaId, status?, rating?, isFavorite?, notes? }`. Duplicate returns `409` |
| `PATCH /api/library/:id` | Update status, rating (0-10), favorite, notes |
| `DELETE /api/library/:id` | Remove from your library (deletes your progress, never catalog data) |
| `GET /api/media/:mediaId/seasons` | Seasons and episodes (loaded from TMDB/AniList on first use) |
| `POST` / `DELETE /api/library/:id/episodes/:episodeId/watched` | Mark an episode watched / unwatched |
| `POST /api/library/:id/seasons/:seasonId/watched` | Mark a whole season watched |

`mediaId` is the `catalogId` returned by the details endpoint. Rules enforced by the API: movies never get episode progress (`CANNOT_TRACK_EPISODES_FOR_MOVIE`), an episode must belong to the entry's own title (`INVALID_EPISODE_FOR_MEDIA`), counts are always derived with `COUNT(*)`, and specials (season 0) don't count toward progress. Status moves automatically: first watched episode makes *Plan to Watch* become *Watching*; finishing every regular episode makes it *Completed*; un-watching one reverts it to *Watching*.

TMDB supplies real seasons and episodes. AniList has no per-episode data, so anime gets `Season 1` with `Episode 1..N` generated from its episode count (or the episodes already aired for a running show).

Account endpoints: `GET /api/auth/me`, `PATCH /api/profiles/me`, `GET /api/profiles/username-availability`, `GET /api/users/:username`.

### Caching & rate limits

A small in-memory TTL cache (max 500 entries) keeps trending for 10 min, search for 90 s, details for 30 min and genre lists for 24 h. It is local to one Node process and cleared on restart; Redis is the upgrade path if you ever run several backend instances.

AniList documents 90 requests/minute (currently degraded to 30). The adapter reads `X-RateLimit-*` and `Retry-After`, refuses further calls after a 429 until the wait is over, and never retries automatically.

---

## 🗄️ Database

| Migration | Contents |
|---|---|
| [`001_create_profiles_and_rls.sql`](supabase/migrations/001_create_profiles_and_rls.sql) | `profiles`, RLS policies, auto-profile trigger |
| [`002_create_media_catalog.sql`](supabase/migrations/002_create_media_catalog.sql) | `media_items`, `media_sources`, `genres`, `media_genres` |
| [`003_create_seasons_and_episodes.sql`](supabase/migrations/003_create_seasons_and_episodes.sql) | `seasons`, `episodes` (shared catalog) |
| [`004_create_user_library_and_progress.sql`](supabase/migrations/004_create_user_library_and_progress.sql) | `user_library`, `user_episode_progress` (per-user, RLS forced) |

```mermaid
erDiagram
    media_items ||--o{ media_sources : "provider ids"
    media_items ||--o{ media_genres : "tagged"
    genres ||--o{ media_genres : "used by"
    media_items ||--o{ seasons : has
    seasons ||--o{ episodes : has
    profiles ||--o{ user_library : owns
    media_items ||--o{ user_library : "tracked as"
    user_library ||--o{ user_episode_progress : records
    episodes ||--o{ user_episode_progress : "watched"
```

The catalog (including seasons and episodes) is **shared** data: one row per title, the same for everyone. Library and progress rows are **per user** and protected by Row Level Security, so a user can only ever read or change their own. Full schema, keys, many-to-many explanation and example queries: [`DB_Schema.MD`](DB_Schema.MD).

**Security model:** the API connects as `showtracker_app`, which cannot bypass Row Level Security. User identity is set per transaction (`withUserTransaction`) and never leaks between pooled connections. `anon` and `authenticated` have no direct access to catalog tables.

---

## 🧪 Testing

```bash
cd server
npm test            # API tests + mocked media tests + library integration tests (needs the database; ~2-3 min)
npm run test:db     # real-database checks for migration 002 (constraints, grants, upserts)
npm run test:live   # REAL AniList and TMDB calls + catalog persistence (TMDB needs a token)

cd ../client
npm run build       # production build
npm run lint
```

`test/library.test.js` runs the real routes, SQL and Row Level Security as the `showtracker_app` role with two disposable users (authentication and provider HTTP are substituted; the users and test titles are deleted afterwards).

Mocked tests prove our logic; `test:live` proves the providers actually respond as expected. They are reported separately on purpose.

---

## 🛠️ Development notes

**Nodemon** watches only `server/src` ([`server/nodemon.json`](server/nodemon.json)). If the backend exits with *"Port 5000 is already in use"*, an older backend is still running:

```bash
netstat -ano | findstr :5000
taskkill /PID <pid> /F
```

**Project layout**

```
client/src/
  components/{layout,media}   shared UI (cards, tabs, filters, skeletons, header, footer)
  pages/                      Landing, Dashboard, Explore, Trending, MediaDetails, Credits, ...
  hooks/useApiResource.js     debounce + abort/stale-response protection
  services/api.js             the only module that calls the backend
server/src/
  providers/                  AniList + TMDB adapters
  services/                   normalizer, catalog orchestration, persistence
  modules/                    health, auth, profiles, media (routes/controllers/validation)
  db/                         migration runner, withUserTransaction
supabase/migrations/          versioned SQL
```

---

## 🙏 Credits & attribution

<img src="client/public/tmdb-logo.svg" alt="TMDB" height="16" />

This product uses the TMDB API but is not endorsed or certified by TMDB.

Movie and TV data, posters and ratings come from [TMDB](https://www.themoviedb.org). Anime data and images come from [AniList](https://anilist.co). All titles, images and descriptions belong to their respective owners. TMDB's free API is for **non-commercial** use with attribution; commercial use requires a license from TMDB.

---

<div align="center">
<sub>Built with React, Express and PostgreSQL · Phase 4 complete</sub>
</div>
