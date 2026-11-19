<div align="center">

# 🎬 ShowTracker

**One account. One library. Everything you watch.**

Discover anime, movies and TV shows from one cinematic interface, powered by real data from AniList and TMDB.
Track what you watch, episode by episode, and share a profile you are proud of.

<br />

<img src="docs/screenshots/landing.jpg" alt="ShowTracker landing page: a floating collage of anime, movie and TV posters beside the headline 'Your watchlist. Your stories. Your universe.'" width="100%" />

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-22-5FA04E?logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![Postgres](https://img.shields.io/badge/PostgreSQL-Supabase-3ECF8E?logo=supabase&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss&logoColor=white)

[Features](#-features) · [Screenshots](#-screenshots) · [Profiles](#-profiles--avatars) · [Architecture](#-architecture) · [Getting started](#-getting-started) · [API](#-api) · [Testing](#-testing)

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
| 📊 **Live statistics** (titles, episodes watched, completions, average rating), *Continue watching* and *Recently updated* shelves | ✅ Done |
| 🔒 **Independent privacy**: profile and library visibility are separate switches; notes are never public | ✅ Done |
| 🖼️ **Profile pictures**: upload from your device (drag and drop, instant preview, auto-crop) to Supabase Storage | ✅ Done |
| 🏅 **Profile showcase**: featured favorites, milestone badges, viewing mix, poster-tinted banner | ✅ Done |
| ⚡ **Instant navigation**: stale-while-revalidate cache that survives a page reload, optimistic episode and status updates with rollback toasts | ✅ Done |
| 🎞️ **Cinema & anime touches**: 35mm sprocket edges, ghost kanji watermarks, broadcast "AIRING" pills, festival-laurel ratings of 8.5 and up | ✅ Done |
| 🏭 **Production hardening**: rate limiting, strict CSP, production indexes, vendor chunking, deploy configs | ✅ Done |
| 🎬 **Cinematic Editorial Premium UI**: design system, motion, responsive shell and mobile dock | ✅ Done |
| 🌐 Followers, social feeds, recommendations | 🛠️ Planned (later phases) |

---

## 📸 Screenshots

Real captures of the running app (live AniList and TMDB data).

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/trending.jpg" alt="Trending page: a featured hero framed by 35mm sprocket holes with a ghost kanji watermark, an AIRING pill and a laurel-rimmed rating" /></td>
    <td width="50%"><img src="docs/screenshots/explore.jpg" alt="Explore page showing search results for Attack on Titan, with laurel-rimmed ratings on titles rated 8.5 and up" /></td>
  </tr>
  <tr>
    <td align="center"><sub><b>Trending</b>: TMDB daily/weekly lists and AniList's ranking, with a featured hero</sub></td>
    <td align="center"><sub><b>Explore</b>: unified search across anime, movies and TV with genre and year filters</sub></td>
  </tr>
</table>

<img src="docs/screenshots/details.jpg" alt="Title page for a currently airing anime: amber projector glow, a faint 物語 watermark, a rating chip and an AIRING pill" width="100%" />

<sub><b>Title page</b>: amber projector glow, a ghost <code>『物語』</code> watermark, rating chip and a live <code>AIRING · 12 EPS</code> broadcast pill</sub>

### On your phone

The layout adapts to small screens with a bottom dock that never covers content, a footer that stays above it, and no horizontal scrolling.

<table>
  <tr>
    <td width="33%"><img src="docs/screenshots/mobile-landing.jpg" alt="Mobile landing page" /></td>
    <td width="33%"><img src="docs/screenshots/mobile-trending.jpg" alt="Mobile trending page" /></td>
    <td width="33%"><img src="docs/screenshots/mobile-explore.jpg" alt="Mobile explore page with the bottom dock" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Home</sub></td>
    <td align="center"><sub>Trending</sub></td>
    <td align="center"><sub>Explore</sub></td>
  </tr>
</table>

---

## 👤 Profiles & avatars

Every user gets a public page at `/u/<username>`, controlled by two **independent** privacy switches (profile and library). Owners get an *Edit profile & privacy* dialog right on the page.

| | |
|---|---|
| 🖼️ **Avatar upload** | Click or drag a JPEG, PNG or WebP (max 5 MB). You get an instant circular preview; the image is centre-cropped to a 512 px square, re-encoded, and uploaded to the public `avatars` Supabase Storage bucket under your own `<user id>/` folder. The previous file is cleaned up. |
| 🔗 **Graceful fallback** | If storage is unavailable, paste an image link instead, with a live preview. |
| ❤️ **Featured favorites** | Your favorite titles (best rated first) as a poster shelf. With no favorites it shows your top rated titles. |
| 🏅 **Milestone badges** | Earned tiers for titles saved, titles finished, episodes watched and titles rated, plus the next locked goal with progress. |
| 📊 **Viewing mix** | Share of anime, movies and TV in the library and your average rating. |
| 🎨 **Poster-tinted banner** | The banner is built from your top title's artwork. |

Storage is protected by Row Level Security ([migration 006](supabase/migrations/006_create_avatars_storage.sql)): anyone can read avatars, but a signed-in user can only write inside their own folder. Notes always stay private.

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, JavaScript (ESM), Tailwind CSS v3, React Router v7, Axios, Lucide, Motion |
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

## 🚢 Deployment

ShowTracker is two small apps plus Supabase: a **static React frontend** (Vercel or Netlify), an **Express API** (Render or Railway) and your **Supabase project** (database, auth, storage).

### Hardening that ships with the API

| Area | What it does |
|---|---|
| **Rate limits** (per IP, in-memory) | `/api/media/search` and `/api/media/trending` share **60 requests/min** (protects the TMDB and AniList quotas); `/api/profiles/username-availability` allows **30/min**. Over the limit: HTTP **429**, JSON `{ success:false, error:{ code:"RATE_LIMITED", retryAfterSeconds } }` and a `Retry-After` header. `RateLimit-*` headers are always sent. |
| **Headers** | Helmet with a strict CSP for a JSON-only server (`default-src 'none'`, `frame-ancestors 'none'`), HSTS, `nosniff`, no `X-Powered-By`, `Referrer-Policy: no-referrer`. |
| **CORS** | Only `CLIENT_URL` (comma-separate several) plus the local dev origins. |
| **Shutdown** | On `SIGTERM`/`SIGINT` the server stops accepting requests, drains, ends both database pools and exits 0 (hard stop after 5 s). |
| **Proxy awareness** | `TRUST_PROXY` (default `1` in production) so the limiter sees the visitor, not the platform proxy. |

The limiter is a dependency-free fixed window kept in memory, which is right for a single instance. If you scale to several instances, move it to a shared store such as Redis.

### 1. Database (Supabase)

1. Run the one-time role script from [Database setup](#database-setup).
2. Apply migrations from your own machine (this needs `MIGRATION_DATABASE_URL`, which never has to live on the host):

   ```bash
   npm run db:migrate
   ```

3. **Storage check:** *Supabase Dashboard → Storage* shows a bucket named `avatars` marked **Public**. Migration 006 creates it; if your role could not, create it by hand (public, 5 MB limit, `image/jpeg`, `image/png`, `image/webp`) and add the four owner-folder policies from the migration.

### 2. Backend on Render (or Railway)

| Setting | Value |
|---|---|
| Root directory | `server` |
| Build command | `npm install` |
| Start command | `npm start` |
| Health check path | `/api/health` |

Environment variables (see [`server/.env.example`](server/.env.example)): `NODE_ENV=production`, `CLIENT_URL=https://<your-frontend>.vercel.app`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL` (the restricted `showtracker_app` pooler URI), `TMDB_API_READ_ACCESS_TOKEN`. Render sets `PORT` itself. Do **not** add the service-role key or `MIGRATION_DATABASE_URL`.

### 3. Frontend on Vercel (or Netlify)

| Setting | Value |
|---|---|
| Root directory | `client` |
| Build command | `npm run build` |
| Output directory | `dist` |

Environment variables (see [`client/.env.example`](client/.env.example)): `VITE_API_URL=https://<your-backend>.onrender.com/api`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SITE_URL=https://<your-frontend>.vercel.app` so link previews get absolute image URLs.

Single-page routing is already configured: [`client/vercel.json`](client/vercel.json) for Vercel and [`client/public/_redirects`](client/public/_redirects) for Netlify, so deep links such as `/u/yourname` do not 404.

### 4. Wire up sign-in for production

1. **Supabase → Authentication → URL Configuration:** set **Site URL** to `https://<your-frontend>.vercel.app` and add **Redirect URLs** `https://<your-frontend>.vercel.app/**` (keep `http://localhost:5173/**` for local work).
2. **Google Cloud Console → APIs & Services → Credentials → your OAuth client:**
   - **Authorized JavaScript origins:** `https://<your-frontend>.vercel.app`
   - **Authorized redirect URIs:** `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback` (the Supabase callback, **not** your frontend)
3. Redeploy the frontend after setting its variables (Vite bakes them in at build time).

### 5. Smoke test the live API

```bash
cd server
npm run test:smoke      # health, security headers, CORS and rate limiting against the app
```

Then open `https://<your-backend>.onrender.com/api/health` (expect `"status":"healthy"`), sign in on the frontend, upload an avatar and tick an episode.

> Render's free tier sleeps after inactivity, so the first request after a pause can take about 30 seconds. The app shows its normal loading states while it wakes.

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

| `GET /api/library/stats` | Live statistics: `totalItems`, `byType`, `byStatus`, `episodesWatched`, `averageRating`, `completed`, `watching` |
| `GET /api/library/continue-watching` | Up to 10 `WATCHING` titles, most recently updated first (with artwork and progress) |
| `GET /api/library/recently-updated` | The 10 most recently updated titles of any status |

`mediaId` is the `catalogId` returned by the details endpoint. Rules enforced by the API: movies never get episode progress (`CANNOT_TRACK_EPISODES_FOR_MOVIE`), an episode must belong to the entry's own title (`INVALID_EPISODE_FOR_MEDIA`), counts are always derived with `COUNT(*)`, and specials (season 0) don't count toward progress. Status moves automatically: first watched episode makes *Plan to Watch* become *Watching*; finishing every regular episode makes it *Completed*; un-watching one reverts it to *Watching*.

TMDB supplies real seasons and episodes. AniList has no per-episode data, so anime gets `Season 1` with `Episode 1..N` generated from its episode count (or the episodes already aired for a running show).

Account endpoints: `GET /api/auth/me`, `PATCH /api/profiles/me` (display name, bio, avatar URL, `profile_visibility`, `library_visibility`), `GET /api/profiles/username-availability`.

### Public profiles and privacy

`GET /api/users/:username` (optional sign-in) returns `{ profile, library, stats, library_is_private, isOwner }`. What the caller gets depends on the profile's two **independent** switches:

| Situation | Response |
|---|---|
| Profile **private**, caller is not the owner | `404` (indistinguishable from an unknown username) |
| Profile public, library **private**, not the owner | identity only: `library: []`, `stats: null`, `library_is_private: true` |
| Profile public, library public, not the owner | identity + library + statistics, **never notes** |
| Caller is the owner | everything, including private notes, whatever the switches say |

Enforcement is layered: the `profiles` RLS policy hides private profiles; visitors read libraries **only** through the `public_library_entries` view (migration 005), which contains just public/public users and has no `notes` column at all, so notes cannot be selected through it; and the response is built from an explicit field list.

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
| [`005_create_public_library_view.sql`](supabase/migrations/005_create_public_library_view.sql) | `public_library_entries` view: the only way visitors read a library (no `notes` column) |
| [`006_create_avatars_storage.sql`](supabase/migrations/006_create_avatars_storage.sql) | Public `avatars` Storage bucket (5 MB, images only) with owner-folder write policies |
| [`007_production_performance_indexes.sql`](supabase/migrations/007_production_performance_indexes.sql) | Library `(user_id, status, updated_at DESC)` and `(user_id, updated_at DESC)`, catalog `(source_rating DESC, release_date DESC)`. Episode-progress, season and episode lookups are already covered by their primary/unique keys, so no duplicate indexes were added |

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

## 🎨 Design system

**Restrained and cinematic:** neutral near-black surfaces, white type, and exactly **one accent: warm gold**. Color is reserved for meaning, so the artwork is the most colorful thing on every screen. No decorative gradients, no rainbow glows.

| Token | Value | Used for |
|---|---|---|
| `ink-base` / `surface` / `raised` | `#09090B` / `#111113` / `#18181B` | page, cards, inputs and menus |
| `ink-line` / `edge` | `#1F1F23` / `#2A2A30` | hairlines, component borders |
| `fg` / `muted` / `subtle` | `#FAFAFA` / `#A1A1AA` / `#71717A` | text hierarchy |
| `accent` | `#F2B33D` (hover `#F7C566`) | primary button, active tab and nav, ratings, progress, checked episodes, links |
| status dots | emerald (watching), sky (completed), zinc (plan), amber (on hold), red (dropped) | one small dot on a neutral pill |

Media types (Anime / Movie / TV Show) are told apart by their label, not by a color.

**Cinema and anime details (tasteful, never loud):** 35mm sprocket perforations on hero banners and dialog headers (`.sprockets`); ghost typography at about 4-5% opacity behind headings (`『物語』` stories on anime sections, `『記録』` chronicles on dashboard and profile, `『書庫』` archive on the library, `FEATURE FILM` and `SCENE 01 · 24FPS` for movies and TV, in a Mincho serif); a soft amber projector bloom on hero backdrops; a monospace broadcast pill (`● AIRING · 12 EPS`, with a pulsing radar dot) on titles that are still releasing; an amber rim light on poster hover; and a festival-laurel rating chip with a twinkling star for ratings of **8.5 and up**. Components live in `client/src/components/cinema/`.

**Texture:** fine film grain, a faint dot matrix and micro grid in hero areas, a single very soft warm light at the top of the page, and neutral frosted-glass panels with a 1px top highlight (`client/src/index.css`: `bg-dots`, `bg-grid`, `mask-radial`, `glass`, `glass-lite`, `sheen`). The only gradients left are black scrims over artwork so titles stay legible.

**Motion (Phase 6):** a sliding pill on every tab group (shared `layoutId`), spring tap feedback on all buttons (`whileTap`), posters that spring up on hover and press in on tap, a pop-and-ping when an episode is ticked, a shimmer and gold confetti when the last episode completes a title, an episode list that collapses with an animated height, route changes that fade and slide, and toast notifications.

**Motion (kept):** staggered entrances, sliding tab and nav indicators, card lift with a slow poster zoom, button press and hover sheen, count-up stat numbers, animated progress fills, circular check pop, a pulsing "live" dot on Watching, modal springs and a floating hero collage. All of it honors `prefers-reduced-motion`.

Reusable primitives in `client/src/components/ui/`: `Button`, `Badge` / `CategoryBadge` / `StatusBadge`, `Card`, `Modal` (focus trap, ESC, scroll lock, focus restore), `Tabs`, `Switch`, `ProgressBar`, `CountUp`, `Skeleton`, `Avatar`, `Logo`, and the `Reveal` / `Stagger` helpers. Tokens live in `client/tailwind.config.js` and `components/ui/theme.js`.

**Application frame:** one shared shell (sticky glass header with user menu on desktop, bottom dock on phones, footer with TMDB attribution) wraps every page except sign-in callback, onboarding and diagnostics.

## ⚡ Speed

The database lives far away (a round trip is ~0.3 s and opening a connection ~2.5 s from some locations), so the app is built to avoid waiting:

- **Instant return visits.** An in-memory stale-while-revalidate cache (`client/src/lib/queryCache.js`) shows the last known data immediately and refreshes it quietly in the background. Changing your library or profile marks private data stale; signing out wipes everything.
- **Survives a refresh.** Your private data (library, stats, shelves, episode lists) is also mirrored into `sessionStorage`: this tab only, never `localStorage`, wiped on sign-out or account switch, and always revalidated on load. A refreshed Dashboard or Library renders instantly instead of showing skeletons. If the fresh response is identical to what is on screen, nothing re-renders.
- **Optimistic by default.** Ticking an episode, changing a status or rating, or moving a card between status tabs updates the screen at once; the request follows in the background, and a failure undoes the change and shows a toast.
- **Prefetch before you click.** Page code is downloaded in idle time after the first paint; hovering (or focusing/touching) a navigation link or poster starts loading its page data too. A hovered title opens in ~150 ms instead of several seconds.
- **Instant app start.** Your profile (name, avatar, username, privacy flags; never tokens) is remembered in `localStorage`, so a returning signed-in user sees the app immediately while it is confirmed in the background.
- **Fewer database round trips.** The per-user transaction sends `BEGIN` and the identity claims together and, for reads, does not wait for the closing `COMMIT` (writes always do). A typical read request is about 2x faster.
- **Warm connections.** The backend keeps three connections open (TCP keep-alive, periodic ping, pre-opened at startup) so requests don't pay the cold-connection cost. Titles already saved to the catalog are not saved again for 6 hours.
- **Small bundle.** Pages are code-split; the main bundle is ~130 kB gzipped.

`node test/bench-latency.mjs` (in `server/`) measures the transaction improvement against your real database.

## 🧪 Testing

```bash
cd server
npm test            # API + mocked media tests + library and stats/privacy integration tests (needs the database; ~5 min)
npm run test:smoke  # production smoke: health, security headers, CORS, rate limiting (needs DATABASE_URL)
npm run test:db     # real-database checks for migration 002 (constraints, grants, upserts)
npm run test:live   # REAL AniList and TMDB calls + catalog persistence (TMDB needs a token)

cd ../client
npm run build       # production build
npm run lint
```

`test/library.test.js` and `test/stats-privacy.test.js` run the real routes, SQL and Row Level Security as the `showtracker_app` role with two disposable users (authentication and provider HTTP are substituted; the users and test titles are deleted afterwards).

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
  components/cinema/          ghost watermarks, broadcast pill, festival-laurel rating chip
  components/profile/         avatar uploader, edit-profile dialog, favorites / milestones / viewing mix
  lib/avatarUpload.js         validate, crop, compress and upload avatars to Supabase Storage
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
<sub>Built with React, Express and PostgreSQL · Phase 6 complete</sub>
</div>
