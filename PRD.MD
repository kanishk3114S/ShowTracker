# ShowTracker — Product Requirements & Build Guide

**Document type:** Product Requirements Document (PRD) + beginner-friendly architecture and database guide  
**Version:** 2.0  
**Date:** 15 November 2026  
**Status:** Ready for Phase 0: Supabase project and application foundation  
**Audience:** Project owner and Antigravity coding agent

> **Product promise:** One account. One library. Everything you watch.

ShowTracker is a personal entertainment tracker for anime, movies and TV series. Users discover titles, add them to one personal library, track individual episodes, rate titles, see watching statistics and share a public profile when they choose.

This PRD is written for a developer who knows JavaScript, React, Node/Express and SQL, but is new to PostgreSQL and Supabase. The coding agent must explain important decisions in plain language and build one reviewable milestone at a time.

---

# 1. Product overview

## 1.1 The problem

People track anime, films and TV shows in different places or rely on memory. They want one place to answer:

- What am I watching right now?
- Which episode did I reach?
- Which shows and movies have I completed?
- What do I plan to watch next?
- How much have I watched?
- What does my entertainment profile look like?

ShowTracker brings those records into one account and one consistent library.

## 1.2 Product vision

Build a polished, friendly and reliable entertainment-tracking website inspired by the convenience of TV Time and anime catalog experiences, while keeping each user's tracking data under ShowTracker's control.

This is a real application, not a static poster gallery. Every visible action must work or be clearly marked as unavailable.

## 1.3 Target users

1. Anime fans who want to track episodes, completed anime and watch plans.
2. Film fans who want a record of watched movies and a movie watchlist.
3. TV-series fans who want season-by-season and episode-by-episode progress.
4. People who watch all three and want one unified library.

## 1.4 Product principles

- **One unified library:** anime, movies and TV use one catalog model, with category-specific behavior where needed.
- **User data belongs to ShowTracker:** AniList and TMDB provide catalog metadata; ShowTracker stores statuses, ratings, notes, privacy settings and progress.
- **Progress is accurate:** watched episodes are individual database rows, not a manually edited counter.
- **Privacy is real:** profile visibility and library visibility are separate. Private data must never leak through public APIs or statistics.
- **Understandable engineering:** use plain JavaScript, readable SQL, small services and clear names.
- **Build the useful core first:** no microservices, AI recommendations, social feed or Redis requirement in the MVP.
- **Supabase is infrastructure, not the application brain:** Supabase hosts PostgreSQL and manages authentication; Express still owns ShowTracker business logic.

---

# 2. Product scope

## 2.1 MVP: first usable release

### Account and profile

- Sign in with Google using Supabase Auth.
- Create a ShowTracker profile after first sign-in.
- Let the user choose a unique username and display name.
- Show avatar, username, bio and joined date.
- Let the user sign out through Supabase Auth.
- Keep the user signed in using the Supabase Auth client session lifecycle.

### Discover and search

- Search anime through AniList.
- Search movies and TV shows through TMDB.
- Filter search by Anime, Movies or TV Shows.
- Display title, poster, release year, overview, genres and source rating when available.
- Show a detail page before a user adds an item to their library.
- Provide trending/popular sections using provider-supported time windows. Do not label weekly trending as a verified monthly trend.

### Personal library

- Add a title to the signed-in user's library.
- Prevent duplicate entries for the same user and media item.
- Update a title's status.
- Remove a title from the user's library.
- Rate a title from 0 to 10.
- Mark a title as a favorite.
- Add a private personal note.
- Filter by media type and status.
- Sort by recently updated, title or rating.

Supported statuses:

| Status | Meaning |
|---|---|
| `PLAN_TO_WATCH` | Saved for later |
| `WATCHING` | Currently watching |
| `COMPLETED` | Finished |
| `ON_HOLD` | Paused for now |
| `DROPPED` | Stopped watching |
| `REWATCHING` | Watching again |

Movies do not have episode progress. The UI must not show episode controls for movies.

### Episode tracking

- Support seasons and episodes for TV shows.
- Support episode tracking for anime.
- If a provider only supplies a total episode count, create simple numbered episodes so the user can still mark them watched.
- Let users mark one episode watched or unwatched.
- Display progress such as `7 / 12 episodes` when the total is known.
- Display season-level progress when season data exists.
- Keep progress after sign-out and sign-in.
- Do not allow episode progress for movies.

### Dashboard and statistics

- Show counts for anime, movies and TV shows in the library.
- Show counts by status.
- Show currently watching and recently updated titles.
- Show total watched episodes.
- Calculate statistics from saved records; do not create a statistics table in the MVP.

### Profiles and privacy

- Public profile page at `/u/:username`.
- Separate `profile_visibility` and `library_visibility` settings.
- A public profile may have a private library.
- If a library is private, public endpoints must not return its titles, ratings, notes, episode progress or library-derived statistics.
- The authenticated owner can always access their own library.
- Email address and authentication identifiers must never appear in public profile responses.

## 2.2 Not in the first release

Do not implement these until the core tracker is stable:

- Followers, following and social activity feed.
- Public written reviews and comments.
- Custom collections such as “Best mystery anime”.
- Notifications and airing reminders.
- Recommendation algorithms or AI features.
- Import from MyAnimeList, AniList or other tracking accounts.
- Mobile applications.
- Redis unless a measured need appears.
- Microservices or a separate analytics service.

These are future features, not MVP blockers.

---

# 3. Main user journeys

## 3.1 First-time user

1. Visitor opens ShowTracker.
2. Visitor selects **Continue with Google**.
3. React calls Supabase Auth's Google OAuth flow.
4. Supabase Auth completes Google sign-in and returns the user to the configured ShowTracker redirect URL.
5. The Supabase client establishes and manages the user's session.
6. React sends the Supabase access token to Express in an `Authorization: Bearer <token>` header when calling protected APIs.
7. Express verifies the token with Supabase Auth and obtains the trusted Supabase user ID.
8. If the user has no ShowTracker profile, show username onboarding.
9. User lands on their dashboard.

Supabase Auth owns Google identity and authentication sessions. ShowTracker owns the public profile and all entertainment-tracking data.

## 3.2 Add an anime or show

1. User opens Explore.
2. User selects Anime or TV Shows and searches for a title.
3. ShowTracker calls the correct provider through Express.
4. User opens the detail page.
5. User chooses **Add to Library** and selects a status.
6. Express verifies the user, finds or creates the internal media record, stores the provider ID and creates the library entry in a database transaction.
7. User opens the episode tracker and marks episodes watched.

## 3.3 Track an episode

1. User opens a title in their library.
2. Page loads its season and episode list.
3. User clicks an episode's watched control.
4. Express verifies the token and derives the user ID from the verified identity, not from request-body input.
5. Database checks enforce the user's row-level access policy; service logic also verifies the episode belongs to the media item in the library entry.
6. Backend inserts or deletes the progress row.
7. Frontend refreshes the watched state and progress count.

Watched-episode rows are the source of truth. Calculate the count with `COUNT(*)`; do not separately store a counter that can drift out of sync.

## 3.4 Public profile with a private library

1. Visitor opens `/u/someusername`.
2. Express reads the profile using a public-safe query.
3. If the profile is private, return a not-found or private-profile response according to the product's chosen UX.
4. If the profile is public, return only approved profile fields.
5. Express separately checks library visibility.
6. If the library is private, return no library entries and no library-derived statistics.

A public profile does not automatically mean a public library.

---

# 4. Pages and navigation

| Page | Purpose | Main actions |
|---|---|---|
| Landing | Explain the product and invite sign-in | Google sign-in |
| Dashboard | Personal overview | Continue watching, view recent items |
| Explore | Search catalog | Search, filter, open details |
| Trending | Discover popular titles | Choose Anime, Movies or TV |
| Media details | Show one title's information | Add/update library entry |
| My Library | Personal media collection | Filter, sort, update status, remove |
| Episode tracker | Track a season's episodes | Mark watched/unwatched |
| Public profile | Share profile information | View public library only when allowed |
| Settings | Manage profile and privacy | Update bio, username and visibility |

Suggested navigation: Home, Explore, Trending, My Library, Profile/Settings.

## 4.1 Visual direction

- Dark-first interface with a warm, playful accent color.
- Poster artwork is prominent, but text remains readable.
- Rounded cards, restrained glow, subtle motion and clear status colors.
- Strong empty states, loading skeletons and useful error messages.
- Do not copy TV Time or another product's exact branding or screen design.
- Support keyboard focus, accessible labels and adequate color contrast.
- Responsive desktop and mobile layouts.

The interface can feel fun; the data model and interactions must remain serious.

---

# 5. Technology decisions

## 5.1 Chosen stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React + Vite, JavaScript | User interface |
| Styling | Tailwind CSS | Responsive visual system |
| Routing | React Router | Page navigation |
| API state | TanStack Query | Loading, caching and refetching server data |
| HTTP | Axios | Calls to Express API |
| Supabase client | `@supabase/supabase-js` | Google sign-in and browser session management |
| Icons / motion | Lucide React + Framer Motion | UI polish |
| Backend | Node.js + Express, JavaScript | REST API and business logic |
| Database host | Supabase | Managed PostgreSQL project |
| Database | PostgreSQL | Relational data, constraints, joins and transactions |
| Database access | `pg` (node-postgres) | Write and understand SQL directly |
| Migrations | `node-pg-migrate` or reviewed versioned SQL migrations | Version-controlled schema changes |
| Authentication | Supabase Auth + Google provider | Google identity, tokens and session lifecycle |
| Validation | Zod | Validate request bodies, params and query strings |
| Testing | Vitest + Supertest | Unit and API tests |
| Future cache | Redis, only if justified | Shared cache/rate limiting later |

**Do not use Prisma or another ORM in this version.** Use `pg.Pool`, parameterized SQL (`$1`, `$2`, etc.) and readable query modules. This is intentional: the project owner wants to understand PostgreSQL and be able to explain every important query.

## 5.2 SQL vs PostgreSQL vs Supabase, in plain English

These are different things:

- **SQL:** the language used to ask a relational database to read or change data. Your existing `SELECT`, `JOIN`, `INSERT`, `UPDATE`, `DELETE`, `GROUP BY` and subquery knowledge still applies.
- **PostgreSQL:** the database software that stores the rows and executes SQL. It adds features and types such as UUID, `TIMESTAMPTZ`, `JSONB`, indexes, transactions and constraints.
- **Supabase:** a managed platform that runs a PostgreSQL database and adds tools such as Auth, Storage, Realtime, a dashboard and API services.

For ShowTracker, Supabase hosts PostgreSQL. We will still write SQL ourselves and connect to the database from Express using `pg`.

## 5.3 PostgreSQL terms we will learn while building

Think of the database as a filing cabinet:

- **Supabase project:** the hosted project containing our PostgreSQL database and Supabase services.
- **Database:** the named database inside the project (Supabase projects commonly provide a database named `postgres`; we do not need to create another database for the MVP).
- **Schema:** a namespace/folder inside a database. We will use `public` for ShowTracker application tables. Supabase also manages schemas such as `auth`.
- **Table:** a structured collection of rows, e.g. `profiles`.
- **Row:** one record.
- **Column:** one property.
- **Primary key:** the unique identity of a row.
- **Foreign key:** a rule connecting a row to another table.
- **Index:** an additional lookup structure that can speed up reads.
- **Transaction:** a group of SQL operations that succeed together or roll back together.
- **Migration:** a versioned change to the database structure.
- **RLS:** Row Level Security, a PostgreSQL feature that decides which rows a database role may read or change.

SQL is still SQL. We will learn each PostgreSQL-specific feature only when the project needs it.

## 5.4 Why PostgreSQL, not MongoDB?

ShowTracker has clear relationships:

- A user has many library entries.
- A library entry points to one media item.
- A media item can have multiple provider IDs.
- A TV show has seasons; seasons have episodes.
- A library entry can have many watched-episode records.
- Media items can have many genres, and a genre can belong to many media items.

These are natural relational relationships. PostgreSQL expresses them with foreign keys, unique constraints and JOINs. Your existing SQL knowledge is directly useful.

## 5.5 Why Supabase for this project?

Supabase gives us a hosted PostgreSQL database and managed authentication without requiring us to install and maintain a database server locally. We can use its SQL Editor and Table Editor to inspect our work while still writing real SQL in the codebase.

We will use:

- **Supabase PostgreSQL:** permanent application data.
- **Supabase Auth:** Google sign-in, user identities and auth sessions.
- **Supabase dashboard:** database connection details, SQL Editor, Table Editor and Auth provider configuration.
- **Supabase Storage:** not needed for the first release; Google avatar URLs are sufficient initially.
- **Supabase Realtime:** not needed for the first release.

Supabase Auth stores its identity records in the managed `auth` schema. We must not edit Supabase's internal Auth tables directly. We create our own `public.profiles` table linked to `auth.users`.

## 5.6 Why Redis is not required initially

Redis is useful for shared caching, rate limiting, queues and temporary data. It is not needed to store a watchlist. PostgreSQL remains the source of truth.

Start without Redis. Add it only when there is a concrete reason, such as multiple backend instances needing shared provider-response caching or distributed rate limits.

---

# 6. System architecture

## 6.1 High-level architecture

```mermaid
flowchart TB
    USER["🍿 User in browser"]
    WEB["⚛️ React + Vite"]
    AUTH["🔐 Supabase Auth"]
    API["🚀 Node.js + Express API"]
    DB[("🐘 Supabase PostgreSQL")]
    ANILIST["🎌 AniList GraphQL API"]
    TMDB["🎬 TMDB API"]

    USER --> WEB
    WEB <-->|"Google sign-in + managed session"| AUTH
    WEB -->|"HTTPS + Bearer access token"| API
    API -->|"Verify token / get trusted user ID"| AUTH
    API -->|"pg + parameterized SQL"| DB
    API --> ANILIST
    API --> TMDB
```

The browser uses Supabase Auth for identity. It calls our Express API for ShowTracker application features. Express verifies the Supabase access token, then runs SQL against Supabase PostgreSQL using a restricted database role.

The browser must never connect directly to PostgreSQL or receive a database password, TMDB key or database role credential.

## 6.2 What happens during Google sign-in?

```mermaid
sequenceDiagram
    actor User
    participant React
    participant Supabase as Supabase Auth
    participant Google
    participant Express

    User->>React: Click Continue with Google
    React->>Supabase: signInWithOAuth({ provider: google })
    Supabase->>Google: Redirect to Google consent
    Google-->>Supabase: Return OAuth result
    Supabase-->>React: Return to configured app URL with session
    React->>Express: API request + Bearer access token
    Express->>Supabase: auth.getUser(accessToken)
    Supabase-->>Express: Verified user identity
    Express-->>React: ShowTracker API response
```

Supabase Auth handles Google OAuth and the authentication session. Our application does not need Passport Google strategy or a custom session table.

The Supabase browser SDK manages the session lifecycle and token refresh. The frontend obtains the current access token from the SDK when calling Express. Do not create a second, manually managed token store.

## 6.3 What happens when a user searches?

```mermaid
sequenceDiagram
    actor User
    participant React
    participant API as Express API
    participant Provider as AniList / TMDB

    User->>React: Search for a title
    React->>API: GET /api/media/search?q=...
    API->>API: Validate query and media type
    API->>Provider: Request catalog results
    Provider-->>API: Provider-specific response
    API->>API: Normalize to ShowTracker format
    API-->>React: Consistent media result objects
    React-->>User: Render poster cards and results
```

Provider API credentials stay on the backend. The backend normalizes provider responses so the frontend does not need to understand two provider formats.

## 6.4 What happens when a user adds a title?

```mermaid
flowchart TD
    A[User clicks Add to Library] --> B[React sends selected title and status]
    B --> C[Express verifies Supabase token]
    C --> D[Express derives trusted user ID]
    D --> E[Begin SQL transaction and set request user context]
    E --> F[Find or create media_items row]
    F --> G[Find or create media_sources row]
    G --> H[Insert user_library row]
    H --> I[Commit transaction]
    I --> J[Return saved library entry]
```

If a required database operation fails, roll back the transaction. Never leave a half-created media/library relationship.

## 6.5 Important: how authentication and PostgreSQL work together

Supabase Auth and a direct PostgreSQL connection are separate services. When Express connects with `pg`, PostgreSQL does **not** automatically know which browser user made the HTTP request.

Therefore, every protected request follows this sequence:

1. React sends the Supabase access token to Express in the Authorization header.
2. Express verifies the token with Supabase Auth using `auth.getUser(token)` (or a correctly implemented JWT/JWKS verifier).
3. Express takes the user ID from that verified result. Never trust a `userId` supplied in the request body or query string.
4. Express starts a database transaction.
5. Express sets a transaction-local PostgreSQL setting such as `app.user_id` to the verified user UUID.
6. SQL queries run using a restricted database role. RLS policies use this transaction-local value to filter user-owned rows.
7. The transaction commits or rolls back. The local user setting disappears when the transaction ends.

Example helper query:

```js
await client.query("SELECT set_config('app.user_id', $1, true)", [verifiedUserId]);
```

The third argument `true` makes the setting local to the current transaction. Protected operations must run inside the transaction wrapper. Never set a persistent user ID on a pooled connection.

The custom setting is trusted only because it is set by our backend after token verification and the database credential stays server-side. RLS is defense-in-depth; Express must still verify ownership and choose public-safe columns explicitly.

## 6.6 Database connection and roles

Use two different database credentials for two different jobs:

- **Migration/admin connection:** used only by a developer or migration process to create/alter tables, indexes, functions, policies and roles. Keep it out of the running app where possible.
- **Application connection:** a custom `showtracker_app` PostgreSQL login role with only the permissions needed by Express and with `NOBYPASSRLS`. This is the `DATABASE_URL` used by the running API.

Do not use the Supabase `service_role` key or the `postgres` database login as the normal application credential. The `service_role` bypasses RLS and must never be exposed to the browser.

Choose the Supabase connection string in the dashboard's **Connect** panel. For a persistent Express server, use a direct connection if the host supports IPv6; use the Session Pooler when the deployment network is IPv4-only. Do not guess the pooler hostname or username; copy the exact connection string provided by Supabase. Use SSL.

## 6.7 Row Level Security (RLS) strategy

Enable RLS on all ShowTracker tables in the `public` schema. Revoke unnecessary `anon` and `authenticated` Data API table grants because the chosen app architecture sends application data through Express, not directly from the browser to the Data API.

The restricted `showtracker_app` role receives explicit table permissions and is subject to RLS. Policies use the transaction-local `app.user_id` context:

- A user can read and update their own profile.
- Public profile rows can be read by visitors.
- A user can read and change their own library entries.
- A public library can be read by visitors only when the owner's `library_visibility` is `PUBLIC`.
- Episode progress follows the same ownership/public-library rule.
- Catalog metadata can be read by all requests and written only by the backend role.

RLS filters rows, not individual columns. Public profile/library endpoints must select only approved public fields. Never include private `notes`, email, auth IDs or tokens in a public response.

## 6.8 Backend organization

Use a modular monolith: one Express application organized into clear modules.

- **Routes:** map URLs to controllers.
- **Middleware:** authentication, database user context, validation, rate limits and error handling.
- **Controllers:** receive HTTP requests and return HTTP responses.
- **Services:** business logic such as adding a title or updating episode progress.
- **Query modules:** readable SQL queries and database operations.
- **Provider adapters:** call AniList or TMDB and normalize responses.

Do not split these into microservices.

## 6.9 Frontend organization

- **Pages:** complete screens such as Explore or My Library.
- **Components:** reusable pieces such as PosterCard, StatusBadge and EpisodeRow.
- **Services:** functions that call the Express API.
- **Supabase client:** one configured browser client for authentication.
- **Hooks:** reusable query and mutation logic.
- **Routes:** public and authenticated route configuration.
- **Utils:** format dates, titles and progress values.

Keep API calls out of large page components. Do not create an enormous `App.jsx`.

---

# 7. Database design: from first table to the complete model

## 7.1 Important distinction: Supabase-managed tables vs ShowTracker tables

Supabase Auth maintains its own internal tables in the `auth` schema, including the identity records used for login. Do not create, edit or query those internal tables as if they were ordinary application tables. Use the Supabase Auth SDK/API for identity operations.

ShowTracker creates its own application tables in the `public` schema. Our application profile references the Supabase Auth user ID.

## 7.2 Relationship map

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : has
    PROFILES ||--o{ USER_LIBRARY : owns
    MEDIA_ITEMS ||--o{ MEDIA_SOURCES : identified_by
    MEDIA_ITEMS ||--o{ MEDIA_GENRES : tagged_with
    GENRES ||--o{ MEDIA_GENRES : used_by
    MEDIA_ITEMS ||--o{ SEASONS : contains
    SEASONS ||--o{ EPISODES : contains
    MEDIA_ITEMS ||--o{ USER_LIBRARY : tracked_by
    USER_LIBRARY ||--o{ USER_EPISODE_PROGRESS : records
    EPISODES ||--o{ USER_EPISODE_PROGRESS : marked_watched
```

`AUTH_USERS` represents Supabase's managed `auth.users` table. It is not a ShowTracker-created table.

## 7.3 The nine ShowTracker application tables

Build these in the following order. Supabase Auth's internal tables are managed separately and are not included in this count.

### 1. `profiles` — who uses ShowTracker?

One application profile for each Supabase Auth user.

Important columns:

- `id`: UUID primary key and foreign key to `auth.users(id)`.
- `username`: unique public handle, compared case-insensitively.
- `display_name`, `avatar_url`, `bio`: public profile fields.
- `profile_visibility`: `PUBLIC` or `PRIVATE`.
- `library_visibility`: `PUBLIC` or `PRIVATE`.
- `created_at`, `updated_at`: timestamps.

Why not create our own `users` and `auth_accounts` tables? Supabase Auth already manages external identities and login records. Our `profiles` table stores only ShowTracker-specific profile data.

Email remains in Supabase Auth and is not returned by public profile queries.

### 2. `media_items` — what is the title?

One internal record for each anime, movie or TV show ShowTracker needs to keep.

Important columns:

- `id`: internal media UUID.
- `media_type`: `ANIME`, `MOVIE` or `TV`.
- `title`, `original_title`, `overview`.
- `poster_url`, `backdrop_url`.
- `release_date`.
- `metadata`: optional JSONB for selected provider fields that do not deserve dedicated columns.
- `created_at`, `updated_at`.

Use one table because all three types share core descriptive fields. Season/episode details belong in their own tables.

### 3. `media_sources` — where did the catalog data come from?

A ShowTracker title can be linked to AniList, TMDB or another provider later.

Important columns:

- `media_id`: foreign key to `media_items`.
- `provider`: `ANILIST` or `TMDB`.
- `provider_media_type`: category used by that provider.
- `external_id`: ID assigned by that provider.

A unique constraint on `(provider, provider_media_type, external_id)` prevents importing the same provider record twice.

### 4. `genres` and 5. `media_genres` — how are titles categorized?

These form a many-to-many relationship:

- `genres` stores one row for each genre name.
- `media_genres` connects a media item to a genre.

This avoids comma-separated genre strings and makes genre filtering straightforward.

### 6. `seasons` — how is a series divided?

One TV show can have multiple seasons. An anime can also be represented using a season, usually season 1 when the provider only supplies an episode count.

Important columns: `media_id`, `season_number`, `name`, `overview`, `poster_url`, `air_date` and `episode_count`.

### 7. `episodes` — which episodes exist?

Each row represents one episode in one season.

Important columns: `season_id`, `episode_number`, `title`, `overview`, `air_date` and `runtime_minutes`.

Some anime providers do not provide full episode names. In that case, create numbered episode records so users can still track episode 1, 2, 3 and so on.

### 8. `user_library` — what has this user added?

The heart of the tracker. One row connects one ShowTracker profile to one media item.

Important columns:

- `user_id`: foreign key to `profiles.id`.
- `media_id`: foreign key to `media_items.id`.
- `status`: watching, completed, plan to watch and so on.
- `rating`: personal score from 0 to 10.
- `is_favorite`: favorite flag.
- `notes`: private note. Never select this column for public library responses.
- `started_at`, `completed_at`, `rewatch_count`.

Unique constraint: `(user_id, media_id)`, so one user cannot accidentally add the same title twice.

### 9. `user_episode_progress` — which episodes did this user watch?

This table connects a library entry to individual episodes.

Important columns:

- `user_library_id`: the user's library entry.
- `episode_id`: the episode that was watched.
- `watched_at`: when it was marked watched.

The primary key `(user_library_id, episode_id)` prevents duplicate watched records. Deleting the row marks the episode unwatched; the catalog episode remains.

Service logic and tests must verify that the episode belongs to the same media item as the user's library entry and that the media type is not `MOVIE`.

## 7.4 What we do not create ourselves

Do not create these public tables for the MVP:

- `users` — Supabase Auth has `auth.users`; `profiles` stores our application profile.
- `auth_accounts` — Supabase Auth manages Google identities.
- `sessions` or `user_sessions` — Supabase Auth manages authentication sessions.

Do not alter Supabase's managed `auth` schema directly.

## 7.5 Tables planned for later

| Future table | Purpose | Why later? |
|---|---|---|
| `reviews` | Public written reviews | Personal rating already lives in `user_library` |
| `user_follows` | Follow other users | Social feature, not needed for tracking |
| `collections` | User-created lists | Requires collection permissions and ordering |
| `collection_items` | Titles inside a collection | Depends on collections |
| `watch_events` | Historical watch/re-watch events | Useful for a richer activity timeline |
| `notifications` | Reminders and social notifications | Requires delivery logic |

Do not create empty future tables just because they might be useful one day. Add them through migrations when the feature is approved.

---

# 8. Database rules and important query logic

## 8.1 Data integrity rules

- Every application profile ID must match a real `auth.users.id`.
- A username is unique without case sensitivity.
- A provider item can be imported only once for its provider/type/ID combination.
- A user can have only one library entry per media item.
- A watched episode must belong to the media item in that user's library entry. Verify this in the service layer and cover it with tests.
- Movies cannot receive episode progress.
- Rating must be between 0 and 10.
- Episode numbers must be positive. Season 0 may be allowed for provider specials.
- Deleting a user's Auth account should cascade to their profile, library and progress records.
- Do not casually delete a catalog record used by other users.

## 8.2 Do not store values that can be calculated

For the MVP:

- Watched episode count = `COUNT(*)` from `user_episode_progress` for that library entry.
- Library count = `COUNT(*)` from `user_library`.
- Counts by media type/status = JOIN `user_library` to `media_items`, then `GROUP BY`.
- Progress percentage = watched episode count divided by known episode count.

Calculate from source-of-truth rows first. Optimize later only if real usage requires it.

## 8.3 Example: get a user's library

```sql
SELECT
    ul.id AS library_entry_id,
    ul.status,
    ul.rating,
    ul.is_favorite,
    ul.updated_at,
    m.id AS media_id,
    m.title,
    m.media_type,
    m.poster_url
FROM user_library AS ul
JOIN media_items AS m
    ON m.id = ul.media_id
WHERE ul.user_id = $1
ORDER BY ul.updated_at DESC;
```

`$1` is a safe parameter supplied by Node's `pg` library. Never concatenate request input into SQL.

## 8.4 Example: count library items by type and status

```sql
SELECT
    m.media_type,
    ul.status,
    COUNT(*) AS total
FROM user_library AS ul
JOIN media_items AS m
    ON m.id = ul.media_id
WHERE ul.user_id = $1
GROUP BY m.media_type, ul.status
ORDER BY m.media_type, ul.status;
```

## 8.5 Example: count watched episodes for a library entry

```sql
SELECT COUNT(*) AS watched_episodes
FROM user_episode_progress
WHERE user_library_id = $1;
```

These are the types of SQL queries the project owner should be able to read and explain.

## 8.6 RLS user context helper

Because the Express backend connects directly with `pg`, the database does not automatically receive the Supabase JWT. The backend sets the verified user ID inside each transaction:

```sql
SELECT set_config('app.user_id', $1, true);
```

RLS policies can read it using a helper function:

```sql
CREATE OR REPLACE FUNCTION public.showtracker_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
    SELECT NULLIF(current_setting('app.user_id', true), '')::UUID;
$$;
```

The application DB role must be a restricted role with `NOBYPASSRLS`. Never use a `postgres` superuser or Supabase `service_role` credential for normal application queries.

---

# 9. External media providers

## 9.1 AniList — anime catalog

Use AniList's GraphQL API for anime search, details, genres, season information where available and supported trending/popular data.

Official documentation: https://docs.anilist.co/guide/graphql/

Keep GraphQL queries and response mapping in `anilist.provider.js`. Handle rate limits and HTTP 429 responses. Do not assume a fixed limit will never change.

## 9.2 TMDB — movie and TV catalog

Use TMDB for movie and television search, details, posters, seasons and episode metadata.

Official documentation: https://developer.themoviedb.org/docs

TMDB's usage terms and attribution requirements must be reviewed before launch. Free API use is not a blanket commercial-use license. Include the required TMDB attribution in the About/Credits area and verify the intended use before monetization.

## 9.3 Provider adapter rule

The frontend receives one normalized object shape regardless of provider, for example:

```js
{
  provider: "ANILIST",
  externalId: "12345",
  mediaType: "ANIME",
  title: "Example Title",
  posterUrl: "https://...",
  overview: "...",
  releaseDate: "2024-01-01",
  genres: ["Action", "Drama"]
}
```

This is an example shape, not a promise that every provider supplies every field. Missing values must be `null` or omitted, never invented.

## 9.4 Data ownership rule

AniList and TMDB provide catalog information. ShowTracker owns:

- ShowTracker profile IDs and profile settings.
- Library entries and statuses.
- Personal ratings and notes.
- Watched episode records.
- Privacy settings.

A provider outage must not prevent a user from opening an already-saved library. Store enough metadata to render saved entries and make provider refresh a separate operation.

---

# 10. Backend API contract

All endpoints are under `/api`. Use consistent JSON responses and centralized error handling.

For protected endpoints, React sends `Authorization: Bearer <supabase_access_token>`. Express verifies the token and derives the user ID. Never accept an authoritative user ID from the browser.

## 10.1 Authentication and profile onboarding

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/auth/me` | Verify current token and return current ShowTracker auth/profile state |
| POST | `/profiles/me` | Create the first ShowTracker profile after sign-in |
| PATCH | `/profiles/me` | Update own display name, avatar or bio |
| PATCH | `/profiles/me/privacy` | Update profile/library visibility |

Google OAuth and sign-out are performed through the Supabase Auth client in React. There is no Passport callback route and no custom Express session endpoint in this architecture.

## 10.2 Media discovery

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/media/search?q=&type=` | Search anime, movies or TV |
| GET | `/media/trending?type=&window=` | Trending/popular discovery |
| GET | `/media/:provider/:providerId?type=` | Fetch title details from a provider |

Never accept a raw SQL column name or table name from a query parameter.

## 10.3 User library

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/library` | List current user's library |
| POST | `/library` | Add a provider title to the library |
| PATCH | `/library/:entryId` | Update status, rating, notes or favorite |
| DELETE | `/library/:entryId` | Remove current user's entry |

## 10.4 Episode progress

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/library/:entryId/episodes` | Get seasons, episodes and watched state |
| PUT | `/library/:entryId/episodes/:episodeId` | Mark one episode watched (idempotent) |
| DELETE | `/library/:entryId/episodes/:episodeId` | Mark one episode unwatched |

Every route verifies ownership. A guessed UUID must never grant access to another user's data.

## 10.5 Statistics and profiles

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/stats/me` | Current user's dashboard stats |
| GET | `/users/:username` | Public profile, subject to visibility rules |
| GET | `/users/:username/library` | Public library only if library visibility allows it |

Public endpoints must use explicit, public-safe SQL projections. Never select private `notes`, email or auth data and hope the frontend hides them.

---

# 11. Security, privacy and reliability requirements

- Use HTTPS in production.
- Keep database URLs, database passwords and TMDB credentials on the backend only.
- The Supabase publishable key may be in the browser; it is not a secret and must not be treated as authorization by itself.
- Never expose the Supabase secret/service-role key in React. This architecture should not require a service-role key for normal requests.
- Configure Google provider credentials in Supabase Auth settings. Do not implement a second Google OAuth system in Express.
- Express must verify each protected access token with Supabase Auth (`auth.getUser(token)`) or a correctly implemented JWT/JWKS verifier. Never trust an unverified decoded JWT.
- Use a restricted PostgreSQL `showtracker_app` role with `NOBYPASSRLS` for normal API traffic.
- Keep the database migration/admin credential separate from the running application's `DATABASE_URL`.
- Enable RLS on all application tables in `public`.
- Revoke unnecessary `anon` and `authenticated` Data API grants because app data is accessed through Express.
- Run user-owned queries inside a transaction that sets the verified user ID with transaction-local `set_config`.
- Do not set a persistent user context on a pooled connection.
- Keep explicit ownership checks in Express services even when RLS is enabled.
- Remember RLS controls rows, not columns. Public endpoints must select only approved columns.
- Use Zod to validate incoming data.
- Use parameterized SQL for every request-derived value.
- Use Helmet and rate limiting for sensitive endpoints.
- Add CSRF/origin protections appropriate to the chosen Bearer-token API model; reject unexpected origins where applicable.
- Use database transactions when one action changes multiple related rows.
- Log server errors without logging access tokens, refresh tokens, database passwords or provider secrets.
- Include loading, empty, unauthorized, not-found and provider-failure states in the UI.
- A failure from AniList/TMDB must not erase or block stored tracking data.
- Use strong database passwords and SSL for database connections.

**Session storage note:** Supabase's browser SDK manages the auth session and token refresh. Do not build a separate custom session table. The SPA must be protected against XSS with safe rendering, dependency hygiene and a restrictive Content Security Policy. Do not manually copy tokens into additional storage locations.

---

# 12. Testing and acceptance criteria

The MVP is not complete merely because pages render.

## Authentication

- User can sign in with Google through Supabase Auth.
- First sign-in can create one ShowTracker `profiles` row after username onboarding.
- Returning sign-in finds the existing profile rather than creating a duplicate.
- Sign-out clears the Supabase Auth session.
- Express rejects missing, expired, malformed or invalid access tokens.
- `/api/auth/me` returns the authenticated identity/profile state or a proper unauthenticated response.

## Database access and RLS

- Application connects using the restricted `showtracker_app` role, not `postgres` or `service_role`.
- `showtracker_app` does not have `BYPASSRLS`.
- All `public` application tables have RLS enabled.
- A user-scoped transaction can read/write only that user's private rows.
- A public profile can be read by an unauthenticated visitor when visibility permits.
- A private profile/library is not exposed to another user.
- The app role cannot access privileged Auth internals.

## Catalog

- Anime search uses AniList through Express.
- Movie and TV search use TMDB through Express.
- Search errors and rate limits produce clear messages.
- Provider credentials are not visible in browser network requests.

## Library

- Signed-in user can add a title.
- Adding the same title twice does not create a duplicate entry.
- User cannot edit or delete another user's entry.
- Status, rating, favorite and notes persist after refresh.

## Episode progress

- User can mark an episode watched and see the state after refresh.
- Marking the same episode twice does not create duplicates.
- User can mark an episode unwatched.
- A movie cannot receive episode progress.
- User cannot mark an episode from a different media item against their library entry.

## Privacy

- Public profile returns only approved profile fields.
- Private profile is not publicly viewable.
- Public profile + private library reveals no titles, ratings, notes, episode progress or library-derived statistics.
- Public library responses never include private notes.
- Signed-in owner can access their own private library.

## Product quality

- All primary buttons work.
- No fake counters are presented as real user data.
- Loading and error states are present.
- Main screens are responsive and keyboard usable.
- Tests cover authorization and privacy, not only happy paths.

---

# 13. Implementation roadmap

Build in this order. Each phase ends with a working checkpoint and a short explanation of the code and SQL created.

## Phase 0 — Supabase project and application foundation

- Create a Supabase project.
- Learn where the SQL Editor, Table Editor, Auth settings and Connect panel are.
- Create React/Vite frontend and Express backend in JavaScript.
- Install `pg` and `@supabase/supabase-js`.
- Configure `.env.example` files and ensure real secrets are ignored by Git.
- Configure Supabase URL and publishable key in React.
- Configure server Supabase client for token verification.
- Configure the `pg.Pool` connection using the application DB role once the role exists.
- Add `GET /api/health`.
- Add a safe database health check that runs `SELECT NOW()`.
- Add centralized errors, CORS, Helmet and basic logging.

**Checkpoint:** React can call Express, Express can verify Supabase configuration, and Express can execute `SELECT NOW()` against Supabase PostgreSQL.

If Supabase is not configured, explain the exact dashboard steps and stop. Do not invent credentials or silently create paid resources.

## Phase 1 — PostgreSQL basics, profiles and migrations

- Learn the database/project/schema/table distinction.
- Use the default `public` schema for application tables.
- Create a versioned migration for `profiles` referencing `auth.users(id)`.
- Learn primary keys, foreign keys, unique constraints, check constraints and timestamps as they appear.
- Create the restricted `showtracker_app` login role with `NOBYPASSRLS` using a generated strong password.
- Add the `showtracker_user_id()` helper and initial RLS policies.
- Inspect tables in Supabase Table Editor and run `SELECT`, `INSERT`, `JOIN` and constraint tests in SQL Editor.

**Checkpoint:** The profile table exists, RLS is enabled, the restricted app role can connect, and the owner understands the profile/auth relationship.

## Phase 2 — Google authentication and profile onboarding

- Enable Google in Supabase Auth providers.
- Create Google OAuth web credentials in Google Cloud Console.
- Add the exact Supabase callback URL to Google's authorized redirect URIs.
- Add local and production app redirect URLs to Supabase Auth URL configuration.
- Implement `signInWithOAuth({ provider: 'google' })` in React.
- Implement Supabase browser client initialization and auth-state handling.
- Send access tokens to Express through the Axios Authorization header.
- Add Express auth middleware using `auth.getUser(token)`.
- Add profile onboarding and `/api/auth/me`.
- Implement sign-out using `supabase.auth.signOut()`.

**Checkpoint:** A real Google account signs in, Express verifies the user, profile onboarding works and sign-out ends the session.

## Phase 3 — Media catalog and providers

- Create migration for media items, sources and genres.
- Build AniList provider adapter.
- Build TMDB provider adapter.
- Normalize results.
- Implement search, detail and provider-supported trending windows.
- Add rate-limit handling and modest server-side caching only if needed.

**Checkpoint:** Search returns real results from the correct provider and detail pages display real metadata.

## Phase 4 — Seasons, episodes and personal library

- Create migration for seasons and episodes.
- Create migration for user library and episode progress.
- Add/remove media.
- Update statuses, ratings, favorites and notes.
- Mark episodes watched/unwatched.
- Add ownership checks, RLS context transactions and transaction handling.

**Checkpoint:** User can track an anime or TV show episode by episode and track a movie as completed.

## Phase 5 — Dashboard, statistics and privacy

- Add dashboard SQL queries and personal stats.
- Add library filters and sorting.
- Add public profile.
- Add profile/library visibility controls.
- Test private-library leakage scenarios, including public stats and notes.

**Checkpoint:** User sees their stats and can share a public profile without exposing a private library.

## Phase 6 — Production hardening and deployment

- Add automated tests for auth, library ownership, episode progress and privacy.
- Review indexes using actual query patterns.
- Add production logging and error monitoring.
- Configure production secrets and database backups appropriate to the selected Supabase plan.
- Verify provider attribution and usage terms.
- Deploy frontend and Express backend.
- Confirm Render/network connectivity to the selected Supabase database endpoint.
- Run a production smoke-test checklist.

**Checkpoint:** A deployed user can sign in, discover titles, save them, track episodes and manage privacy.

## Phase 7 — Future product features

Only after the MVP is reliable: reviews, follows, activity feed, custom collections, watch history, notifications, import tools and Redis-backed shared caching.

---

# 14. Suggested project structure

```text
showtracker/
├── client/
│   └── src/
│       ├── components/
│       │   ├── common/
│       │   ├── layout/
│       │   └── media/
│       ├── pages/
│       │   ├── Landing/
│       │   ├── Dashboard/
│       │   ├── Explore/
│       │   ├── Trending/
│       │   ├── Library/
│       │   ├── MediaDetails/
│       │   ├── Profile/
│       │   └── Settings/
│       ├── hooks/
│       ├── lib/
│       │   └── supabase.js
│       ├── services/
│       ├── routes/
│       ├── utils/
│       └── App.jsx
│
├── server/
│   ├── migrations/
│   └── src/
│       ├── config/
│       │   ├── database.js
│       │   └── supabase.js
│       ├── middleware/
│       │   ├── authenticate.js
│       │   ├── withUserDbContext.js
│       │   └── errorHandler.js
│       ├── modules/
│       │   ├── profiles/
│       │   ├── media/
│       │   ├── library/
│       │   ├── episodes/
│       │   └── stats/
│       ├── providers/
│       │   ├── anilist.provider.js
│       │   └── tmdb.provider.js
│       ├── db/
│       │   └── queries/
│       ├── app.js
│       └── server.js
│
├── .gitignore
├── README.md
└── package.json
```

Keep modules understandable. Do not create a file for every tiny function or put all backend logic into one controller.

---

# 15. Environment variables and Supabase setup

Create `.env.example` files containing placeholders only. Never commit a real `.env`.

## 15.1 Frontend: `client/.env.example`

```env
VITE_API_URL=http://localhost:5000/api
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me
```

The publishable key is intended for browser use. It does not grant unrestricted access by itself. Database access remains controlled by permissions and RLS.

## 15.2 Backend: `server/.env.example`

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173

SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_me

# Restricted showtracker_app database role connection string from Supabase Connect panel
DATABASE_URL=postgresql://ROLE:REPLACE_PASSWORD@HOST:PORT/postgres

# Admin/migration connection: use only in migration tooling or local developer tasks.
# Never use this as the running application's DATABASE_URL.
MIGRATION_DATABASE_URL=postgresql://ADMIN_ROLE:REPLACE_PASSWORD@HOST:PORT/postgres

TMDB_API_KEY=replace_me
```

Do not paste actual passwords into source files or commit them. Percent-encode reserved characters in database passwords if required by the connection URL.

## 15.3 Google OAuth credentials

Configure Google OAuth provider credentials in the Supabase Dashboard under Authentication → Providers → Google. The Google client secret is stored in Supabase Auth provider settings, not in React and not in the Express `.env` for this architecture.

In Google Cloud Console, configure the exact callback URL displayed by Supabase. In Supabase Auth URL configuration, allow the local and deployed ShowTracker redirect URLs. Never guess the callback URL.

## 15.4 Database connection choice

Use Supabase Dashboard → Connect and copy the connection string for the target environment. For a persistent Express server:

- Direct connection is suitable when the deployment host supports IPv6.
- Shared Session Pooler is the alternative when the deployment host is IPv4-only.
- Transaction Pooler is mainly for serverless/short-lived connections and has session-state limitations.

Use SSL. Do not construct the pooler hostname or username manually.

## 15.5 Secrets and key rules

- `VITE_` variables are visible in the browser bundle. Only the Supabase URL and publishable key belong there.
- Database credentials, migration credentials and TMDB API key stay on the backend.
- Do not use the Supabase `service_role`/secret key for normal app requests.
- Do not commit real `.env` files.

---

# 16. Antigravity master instructions

Open the ShowTracker folder in Antigravity, add this PRD to the project context, and paste the following prompt.

```text
You are the senior engineer helping build ShowTracker. Read the complete
ShowTracker_PRD.md before writing code. Treat it as the product source of truth.

PROJECT OWNER CONTEXT
- The owner knows JavaScript, React, Node/Express and SQL queries well.
- The owner has not worked with PostgreSQL or Supabase before.
- Explain SQL/PostgreSQL/Supabase concepts in plain language the first time they appear.
- The owner wants to understand every important table, relationship, query and security decision.
- Do not use TypeScript.
- Do not use Prisma or another ORM. Use node-postgres (pg) and readable SQL.
- Do not pretend the owner understands Supabase dashboard terminology; explain where to click
  and what each setting does when setup is required.

WORKING STYLE
1. Work one phase at a time, following the roadmap in the PRD.
2. Before each phase, list the files you intend to create/change and explain why.
3. Implement the smallest complete working slice. Do not generate the entire app in one response.
4. After implementation, explain how to run it, how to test it, what SQL was added,
   and what each important table/query does.
5. Stop at the phase checkpoint. Report what works, what remains and any decision needing approval.
6. Do not silently move to the next phase.
7. Do not invent API keys, OAuth credentials, provider responses or test results.
8. Do not overwrite existing user code/configuration without inspecting it first.
9. Do not create paid services, deploy or alter system settings without approval.
10. When a command fails, explain the error and fix the smallest cause rather than regenerating everything.

TECHNICAL RULES
- React + Vite + JavaScript frontend.
- Node.js + Express + JavaScript backend.
- Supabase hosts PostgreSQL and provides Supabase Auth.
- Use @supabase/supabase-js in React for Google OAuth and session management.
- Use Supabase Auth token verification in Express. Verify each protected access token
  with supabase.auth.getUser(token) or a correctly implemented JWT/JWKS verifier.
- Do not use Passport.js, custom Google OAuth callbacks or a custom session table.
- Use pg.Pool and parameterized SQL ($1, $2, etc.). Never concatenate request input into SQL.
- Use versioned SQL migrations. Keep migration/admin credentials separate from the runtime app role.
- The runtime database role must be a restricted showtracker_app role with NOBYPASSRLS.
- Enable RLS on all public ShowTracker tables and grant only required privileges.
- Express must set the verified user ID as transaction-local app.user_id before user-owned SQL.
  Use set_config('app.user_id', verifiedUserId, true) inside BEGIN/COMMIT.
- Do not set a persistent user ID on a pooled database connection.
- Express must still enforce ownership; RLS is defense-in-depth.
- RLS filters rows, not columns. Public endpoints must explicitly select public-safe columns only.
- Keep Supabase service_role/secret keys out of React and do not use them for normal app traffic.
- Use UUID primary keys, TIMESTAMPTZ, foreign keys, unique/check constraints and useful indexes.
- Use transactions when one action writes related rows.
- Do not store calculated counters such as watched episode count as a second source of truth.
- Use AniList for anime and TMDB for movies/TV through backend-only provider adapters.
- Provider credentials stay on the backend.
- User tracking data belongs to ShowTracker and must remain available when a provider is unavailable.
- Do not add Redis, microservices, AI features, social feeds or other out-of-scope systems during MVP.

DESIGN RULES
- Build a polished, responsive, dark-first entertainment tracker.
- Use real provider data for catalog pages and real API/database operations for user actions.
- No fake buttons, fake counters or mock content presented as real user data.
- Add loading, empty, error, unauthorized and not-found states.
- Keep components reusable without creating unnecessary abstractions.
- Do not copy another product's exact branding or screen layouts.

FIRST TASK: PHASE 0 ONLY
1. Inspect the current folder and tell the owner what already exists.
2. Propose the minimal folder structure for Phase 0.
3. Create the React/Vite frontend and Express backend in JavaScript.
4. Install/configure pg and @supabase/supabase-js.
5. Add /api/health and centralized error handling.
6. Add .env.example files and ensure real .env files are ignored by Git.
7. Explain how to create a Supabase project and locate URL, publishable key and Connect details.
8. Do not invent credentials or ask the owner to paste secrets into chat.
9. Add a safe database health check that runs SELECT NOW() once the owner has configured
   the database connection.
10. Do not add Google OAuth, provider integrations, library features or dashboard pages yet.
11. If no Supabase project/connection is configured, stop and provide exact dashboard steps.
12. Explain each new file and stop at the Phase 0 checkpoint.
```

---

# 17. Definition of success

ShowTracker's first successful release is not measured by the number of pages or animations. It is successful when a real person can:

1. Sign in with Google through Supabase Auth.
2. Search for an anime, movie or TV show.
3. Add it to their own library.
4. Change its watch status.
5. Track individual episodes for anime/TV.
6. See accurate personal statistics.
7. Share a public profile while keeping the library private when desired.
8. Refresh, sign out and sign back in without losing their data.

> **North star:** a user's entertainment history should be easy to manage, accurate, private when requested and owned by ShowTracker rather than by a media metadata provider.

---

# Official references

- Supabase overview: https://supabase.com/docs
- Supabase Google sign-in: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Auth `getUser`: https://supabase.com/docs/reference/javascript/auth-getuser
- Supabase database connections: https://supabase.com/docs/guides/database/connecting-to-postgres
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase securing data: https://supabase.com/docs/guides/database/secure-data
- node-postgres queries: https://node-postgres.com/features/queries
- node-postgres connection pools: https://node-postgres.com/apis/pool
- PostgreSQL SQL language: https://www.postgresql.org/docs/current/sql.html
- PostgreSQL schemas: https://www.postgresql.org/docs/current/ddl-schemas.html
- AniList GraphQL guide: https://docs.anilist.co/guide/graphql/
- AniList rate limiting: https://github.com/AniList/docs/blob/master/docs/guide/rate-limiting.md
- TMDB developer documentation: https://developer.themoviedb.org/docs
- TMDB API FAQ and attribution/commercial-use guidance: https://developer.themoviedb.org/docs/faq
