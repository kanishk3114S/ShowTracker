# ShowTracker — Database Architecture & Schema Guide (Phase 1)

Welcome to the ShowTracker database guide. This document explains the database structure, concepts, and security rules in beginner-friendly, plain language for software engineers familiar with SQL but new to PostgreSQL and Supabase.

---

## 1. Core Database Concepts in Plain English

### What is PostgreSQL?
PostgreSQL (often called "Postgres") is an enterprise-grade, open-source object-relational database system. While you use SQL to query it, PostgreSQL provides powerful native features such as:
- **UUID (`UUID`)**: Universally Unique Identifiers (128-bit numbers) instead of predictable sequential integers (like 1, 2, 3), preventing attackers from guessing IDs.
- **Timestamps with Time Zone (`TIMESTAMPTZ`)**: Automatically handles and normalizes timestamps in UTC, avoiding timezone bugs across global users.
- **Row Level Security (RLS)**: Security rules enforced directly by the database engine at query time.
- **Strong Constraints & Triggers**: Guarantees data integrity before any row is saved.

### Project vs Database vs Schema vs Table
Think of the database hierarchy like a filing cabinet in an office:
1. **Supabase Project:** The entire office building hosting your managed PostgreSQL instance, authentication server, and API gateway.
2. **Database:** The filing cabinet inside the office (by default named `postgres`).
3. **Schema:** A labeled drawer inside the filing cabinet. PostgreSQL uses schemas to group tables:
   - `auth`: A private drawer managed by Supabase containing authentication users, passwords, sessions, and OAuth links. We do not edit this directly.
   - `public`: The standard application drawer where our ShowTracker tables (`profiles`, and later `media_items`, `user_library`) live.
4. **Table:** A specific file folder inside a drawer (e.g., `public.profiles`), where each row is an individual record and each column is a specific attribute.

### Why Supabase for ShowTracker?
Supabase provides a hosted, production-grade PostgreSQL database with zero local server installation needed, along with built-in authentication, a browser SQL Editor, and a visual Table Editor.

---

## 2. Phase 1 Entity Relationship Diagram

In Phase 1, ShowTracker establishes the identity and profile foundation:

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : has

    AUTH_USERS {
        uuid id PK
        text email
    }

    PROFILES {
        uuid id PK, FK
        varchar username
        varchar display_name
        text avatar_url
        text bio
        text profile_visibility
        text library_visibility
    }
```

### Explaining the Relationship in Plain English:
- `AUTH_USERS` (`auth.users`) is maintained automatically by Supabase Auth whenever a user signs in with Google. It stores sensitive authentication data such as email and OAuth tokens.
- `PROFILES` (`public.profiles`) is our application table. It stores ShowTracker-specific user information (username, display name, avatar, bio, and privacy flags).
- Every profile row shares the exact same `id` (UUID) as the authentication record.
- **One-to-One (`||--||`)**: One authentication user has exactly one ShowTracker profile.
- **Cascading Deletion (`ON DELETE CASCADE`)**: If an authentication user account is deleted in Supabase Auth, PostgreSQL automatically removes their profile row.

---

## 3. The `public.profiles` Table Definition

```sql
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(40),
    display_name VARCHAR(80),
    avatar_url TEXT,
    bio VARCHAR(300),
    profile_visibility TEXT NOT NULL DEFAULT 'PUBLIC',
    library_visibility TEXT NOT NULL DEFAULT 'PUBLIC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT profiles_profile_visibility_check
        CHECK (profile_visibility IN ('PUBLIC', 'PRIVATE')),

    CONSTRAINT profiles_library_visibility_check
        CHECK (library_visibility IN ('PUBLIC', 'PRIVATE')),

    CONSTRAINT profiles_username_format_check
        CHECK (username IS NULL OR (username ~ '^[a-z0-9_]{3,30}$' AND username = LOWER(username)))
);
```

### Column Breakdown

| Column | Type | Description |
|---|---|---|
| `id` | `UUID` | Primary Key and Foreign Key pointing directly to `auth.users(id)`. |
| `username` | `VARCHAR(40)` | Unique handle (e.g., `spike_spiegel`). Nullable initially until user finishes onboarding in Phase 2. |
| `display_name` | `VARCHAR(80)` | Friendly display name shown on profile pages. |
| `avatar_url` | `TEXT` | URL to the user's profile image (e.g., from Google OAuth). |
| `bio` | `VARCHAR(300)` | Short user biography or tagline. |
| `profile_visibility` | `TEXT` | `PUBLIC` or `PRIVATE`. Controls whether visitors can view the profile page. |
| `library_visibility` | `TEXT` | `PUBLIC` or `PRIVATE`. Independent privacy setting for saved anime/shows/movies. |
| `created_at` | `TIMESTAMPTZ` | Timestamp when the profile was created (UTC). |
| `updated_at` | `TIMESTAMPTZ` | Automatically updated whenever any profile field changes. |

---

## 4. Understanding Keys, Constraints & Indexes

### Primary Key (`PRIMARY KEY`)
The unique identifier of each row. In `profiles`, `id` is the primary key. No two profiles can ever have the same ID.

### Foreign Key (`REFERENCES auth.users(id) ON DELETE CASCADE`)
A foreign key links a column in one table to the primary key of another table. It guarantees referential integrity:
- You cannot create a profile for a non-existent user ID.
- `ON DELETE CASCADE` means if a user is deleted from Supabase Auth, PostgreSQL automatically cleans up their profile without leaving orphaned data.

### CHECK Constraints
A `CHECK` constraint tests data before inserting or updating:
- `CHECK (profile_visibility IN ('PUBLIC', 'PRIVATE'))`: Prevents typos or invalid status strings from ever entering the database.
- `CHECK (username IS NULL OR (username ~ '^[a-z0-9_]{3,30}$' AND username = LOWER(username)))`: Enforces lowercase alphanumeric characters and underscores between 3 and 30 characters.

### Case-Insensitive Unique Index
```sql
CREATE UNIQUE INDEX profiles_username_lower_idx
    ON public.profiles (LOWER(username))
    WHERE username IS NOT NULL;
```
- **Why?** If a user registers `alex`, someone else cannot register `Alex` or `ALEX`.
- `WHERE username IS NOT NULL` allows new users to register without a username yet (during Google sign-in) without triggering a duplicate key conflict on `NULL`.

---

## 5. Automatic Profile Creation Trigger

When a user signs in with Google, Supabase Auth inserts a row into `auth.users`. We want ShowTracker to immediately create their matching `public.profiles` row without requiring manual application glue code.

We accomplish this using a PostgreSQL **Trigger**:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        display_name,
        avatar_url,
        username,
        profile_visibility,
        library_visibility
    ) VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NULL),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', NULL),
        NULL,
        'PUBLIC',
        'PUBLIC'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
```

### What is a Database Trigger?
A trigger is a stored function that PostgreSQL executes automatically when a specific event occurs (e.g., `AFTER INSERT ON auth.users`).
- `SECURITY DEFINER`: The function runs with the privileges of its creator (`postgres`), allowing it to write to `public.profiles` even during external auth flows.
- `SET search_path = public, auth`: Explicitly locks down the schema search path to prevent search path spoofing.
- `ON CONFLICT (id) DO NOTHING`: Ensures idempotency—if a profile row already exists, it won't throw an error.

---

## 6. Row Level Security (RLS) & Access Policies

### Authentication vs Authorization vs RLS
- **Authentication**: Proves *who you are* (e.g., verified Supabase Auth token).
- **Authorization**: Express business logic checking permissions before performing an action.
- **Row Level Security (RLS)**: PostgreSQL's built-in defense-in-depth gatekeeper. Even if an application bug queries `SELECT * FROM profiles`, PostgreSQL only returns the rows that the active user's role and ID are allowed to see.

### How `auth.uid()` Works
Supabase provides `auth.uid()`, a SQL function returning the UUID of the currently authenticated request.
- When an authenticated HTTP request arrives at Express, Express verifies the token.
- Inside the database transaction, Express sets the request claim context:
  ```sql
  SELECT set_config('request.jwt.claim.sub', $1, true);
  ```
- Any subsequent query in that transaction evaluates `auth.uid()` as that verified user UUID.

### The Profile Policies

#### 1. SELECT Policy (Reading Profiles)
```sql
CREATE POLICY "Profiles select policy"
    ON public.profiles
    FOR SELECT
    TO public, showtracker_app, authenticated, anon
    USING (
        profile_visibility = 'PUBLIC'
        OR (auth.uid() IS NOT NULL AND auth.uid() = id)
    );
```
- **Rule**: If a profile has `profile_visibility = 'PUBLIC'`, anyone (including guests and search engines) can view it.
- **Rule**: If a profile is `PRIVATE`, *only* the owner (`auth.uid() = id`) can view it.

#### 2. INSERT Policy (Creating Profiles)
```sql
CREATE POLICY "Profiles insert policy"
    ON public.profiles
    FOR INSERT
    TO public, showtracker_app, authenticated
    WITH CHECK (
        auth.uid() IS NOT NULL AND auth.uid() = id
    );
```
- **Rule**: A user can only insert a profile record where the `id` matches their own verified `auth.uid()`. They cannot create profiles under someone else's ID.

#### 3. UPDATE Policy (Modifying Profiles)
```sql
CREATE POLICY "Profiles update policy"
    ON public.profiles
    FOR UPDATE
    TO public, showtracker_app, authenticated
    USING (
        auth.uid() IS NOT NULL AND auth.uid() = id
    )
    WITH CHECK (
        auth.uid() IS NOT NULL AND auth.uid() = id
    );
```
- **Rule**: A user can only modify their own profile. The `WITH CHECK` clause also prevents them from modifying the `id` foreign key.

---

## 7. Restricted Database Role (`showtracker_app`)

### Admin Role vs Application Role
In PostgreSQL, security best practices demand least-privilege access:
1. **Admin / Migration Role (`postgres`)**:
   - Superuser used only in migrations and the Supabase SQL Editor.
   - Can create tables, alter roles, grant permissions, and bypass RLS (`BYPASSRLS`).
2. **Application Role (`showtracker_app`)**:
   - The role used by our Express backend in `DATABASE_URL`.
   - **`NOBYPASSRLS`**: Must strictly obey all Row Level Security policies.
   - **`NOSUPERUSER`**: Cannot alter database settings or create roles.
   - Granted only `SELECT`, `INSERT`, `UPDATE`, `DELETE` on the `public` schema.

---

## 8. How to Inspect & Test in Supabase Dashboard

1. **Table Editor**:
   - Go to your Supabase Dashboard &rarr; **Table Editor** (grid icon in sidebar).
   - Select `profiles` in the `public` schema.
   - You will see the columns, data types, and any records created.
2. **SQL Editor**:
   - Go to **SQL Editor** (terminal icon in sidebar).
   - Click **New Query**.
   - You can run test queries, inspect active roles (`SELECT * FROM pg_roles;`), or run our migration scripts directly.
3. **Database & Migrations**:
   - Navigate to **Database** &rarr; **Roles** to inspect `showtracker_app`.
   - Navigate to **Database** &rarr; **Policies** to visually review the RLS policies on `profiles`.


---

## Phase 3: Shared Media Catalog (migration `002_create_media_catalog.sql`)

### What these tables are for

`media_items`, `media_sources`, `genres` and `media_genres` hold **shared** data: one row per title, the same for every user. A title is saved the first time someone opens its details page (search-result cards are *not* stored). Personal data such as "I'm watching this" or "I rated it 9" will live in separate **user-scoped** tables in Phase 4 that point at `media_items.id`. That split is why catalog tables have no `user_id` and are not filtered per user, while Phase 4 tables will be.

### ER diagram

```mermaid
erDiagram
    media_items ||--o{ media_sources : "has external ids"
    media_items ||--o{ media_genres : "tagged with"
    genres ||--o{ media_genres : "used by"

    media_items {
        uuid id PK
        text media_type "ANIME | MOVIE | TV"
        text title
        text original_title
        text overview
        text poster_path
        text backdrop_path
        date release_date
        numeric source_rating "0-10"
        numeric popularity
        jsonb metadata
        timestamptz created_at
        timestamptz updated_at
    }
    media_sources {
        uuid id PK
        uuid media_id FK
        text provider "ANILIST | TMDB"
        text provider_media_type
        text external_id
        timestamptz created_at
        timestamptz updated_at
    }
    genres {
        uuid id PK
        text name "unique, case-insensitive"
        timestamptz created_at
    }
    media_genres {
        uuid media_id PK,FK
        uuid genre_id PK,FK
    }
```

### Key concepts

- **Primary key (PK)**: a column that uniquely identifies a row. Here each table uses a random UUID, except `media_genres`, whose primary key is the *pair* `(media_id, genre_id)`.
- **Foreign key (FK)**: a column that must match a row in another table. `media_sources.media_id` must be a real `media_items.id`; `ON DELETE CASCADE` removes the child rows if the title is deleted.
- **Many-to-many**: a title has many genres and a genre has many titles. A plain column cannot store that, so a *link table* (`media_genres`) holds one row per (title, genre) pair. The composite primary key makes duplicate pairs impossible.
- **Provider identifiers**: `UNIQUE (provider, provider_media_type, external_id)` stops the same provider record being imported twice. `provider_media_type` is part of it because TMDB movie 550 and TMDB TV 550 are different titles. AniList and TMDB ids are never treated as interchangeable, and titles are never merged because their names look similar.
- **Case-insensitive genres**: a unique index on `LOWER(name)` makes "Action" and "action" the same genre.
- **Ratings**: `source_rating` is the provider's public rating normalized to 0-10 (AniList's 0-100 score divided by 10). It is not the user's own rating. A CHECK constraint enforces 0-10.

### Persistence strategy

Opening a details page calls `upsertMediaFromDetails` inside one transaction: take an advisory lock on the provider id (so two simultaneous requests cannot both insert), look up `media_sources`, update or insert `media_items` + `media_sources`, then make `media_genres` match the provider's current genre list. Repeating the request updates the same rows.

### Security

RLS is enabled on all four tables. `anon` and `authenticated` (Supabase's public API roles) have no access; the backend role `showtracker_app` gets SELECT/INSERT/UPDATE on items and sources, SELECT/INSERT on genres, SELECT/INSERT/DELETE on `media_genres` (to refresh genre links), and no TRUNCATE. Policies allow only `showtracker_app`.

### Example queries

```sql
-- A title with its genres and provider ids
SELECT mi.title, mi.media_type, ms.provider, ms.external_id,
       array_agg(g.name ORDER BY g.name) AS genres
FROM media_items mi
JOIN media_sources ms ON ms.media_id = mi.id
LEFT JOIN media_genres mg ON mg.media_id = mi.id
LEFT JOIN genres g ON g.id = mg.genre_id
GROUP BY mi.id, ms.provider, ms.external_id;

-- All stored titles in a genre
SELECT mi.title
FROM genres g
JOIN media_genres mg ON mg.genre_id = g.id
JOIN media_items mi ON mi.id = mg.media_id
WHERE LOWER(g.name) = 'drama';
```


---

## Phase 4: Seasons, Episodes and the Personal Library (migrations 003 and 004)

### Shared vs personal data

- `seasons` and `episodes` (003) are **shared catalog** data, like `media_items`. They are loaded from TMDB (TV) or generated from AniList's episode count (anime) the first time a user needs them. Movies never have them. Season 0 is allowed for TMDB "Specials".
- `user_library` and `user_episode_progress` (004) are **personal** data. Each row belongs to one user, and Row Level Security (enabled **and forced**) makes every query see only that user's rows.

```mermaid
erDiagram
    media_items ||--o{ seasons : has
    seasons ||--o{ episodes : has
    profiles ||--o{ user_library : owns
    media_items ||--o{ user_library : "tracked as"
    user_library ||--o{ user_episode_progress : records
    episodes ||--o{ user_episode_progress : "watched"

    seasons {
        uuid id PK
        uuid media_id FK
        int season_number "unique per media; 0 = specials"
        text name
        int episode_count
    }
    episodes {
        uuid id PK
        uuid season_id FK
        int episode_number "unique per season"
        text title
        date air_date
        int runtime_minutes
    }
    user_library {
        uuid id PK
        uuid user_id FK
        uuid media_id FK "unique with user_id"
        text status
        numeric rating "0-10"
        bool is_favorite
        text notes "max 2000"
        timestamptz started_at
        timestamptz completed_at
        int rewatch_count
    }
    user_episode_progress {
        uuid user_library_id PK,FK
        uuid episode_id PK,FK
        timestamptz watched_at
    }
```

### Concepts

- **Composite primary key** on `user_episode_progress (user_library_id, episode_id)`: marking an episode watched twice is impossible, so the operation is naturally idempotent (`ON CONFLICT DO NOTHING`).
- **Derived counts**: nothing stores "episodes watched". It is always `COUNT(*)` over `user_episode_progress`, so it cannot drift out of sync.
- **ON DELETE rules**: removing a library entry cascades to its progress; removing a user cascades to their library; `media_items` use `RESTRICT` so shared catalog rows can never vanish from under someone's library.
- **Ownership through a parent**: progress rows have no `user_id`; their policy checks that the parent `user_library` row belongs to `auth.uid()`.
- **Transactions**: every library request runs in `withUserTransaction`, which sets the verified user id for that transaction only. The entry row is locked (`SELECT ... FOR UPDATE`) while progress changes so concurrent clicks cannot corrupt status.

### Example queries

```sql
-- A user's progress per title
SELECT mi.title, COUNT(uep.episode_id) AS watched
FROM user_library ul
JOIN media_items mi ON mi.id = ul.media_id
LEFT JOIN user_episode_progress uep ON uep.user_library_id = ul.id
WHERE ul.user_id = '<user uuid>'
GROUP BY mi.title;

-- Episodes of a show with watched state for one library entry
SELECT s.season_number, e.episode_number, e.title,
       (uep.episode_id IS NOT NULL) AS watched
FROM seasons s
JOIN episodes e ON e.season_id = s.id
LEFT JOIN user_episode_progress uep
       ON uep.episode_id = e.id AND uep.user_library_id = '<entry uuid>'
WHERE s.media_id = '<media uuid>'
ORDER BY s.season_number, e.episode_number;
```
