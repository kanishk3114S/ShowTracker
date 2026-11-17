# ShowTracker

> **One account. One library. Everything you watch.**

ShowTracker is a personal entertainment tracker for anime, movies, and TV series. Users discover titles, add them to one unified personal library, track individual episodes, rate titles, and share a public profile while maintaining strict privacy controls over their personal watchlists.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 19, Vite, JavaScript (ESM) | Single Page Application |
| **Styling** | Tailwind CSS v3 | Dark-first responsive design |
| **Routing** | React Router v7 | Client routing & route protection |
| **HTTP Client** | Axios | Authenticated API calls to Express |
| **Auth Client** | `@supabase/supabase-js` | Google OAuth & session management (PKCE) |
| **Icons** | Lucide React | Visual UI indicators |
| **Backend** | Node.js 22, Express (ESM) | REST API & business logic |
| **Database** | Supabase PostgreSQL | Relational storage & Row Level Security |
| **Database Client** | `pg.Pool` (node-postgres) | Parameterized SQL execution |
| **Validation** | Zod | Runtime request schema validation |
| **Security** | Helmet, CORS, RLS | Defense-in-depth protection |

---

## Architecture Overview

```mermaid
sequenceDiagram
    actor User
    participant React as React + Vite (Port 5173)
    participant Supabase as Supabase Auth
    participant Google as Google Cloud OAuth
    participant Express as Express API (Port 5000)
    participant DB as Supabase PostgreSQL

    User->>React: Click Continue with Google
    React->>Supabase: signInWithOAuth({ provider: 'google' })
    Supabase->>Google: OAuth consent redirect
    Google-->>Supabase: Return OAuth token & user
    Supabase-->>React: Redirect to /auth/callback with session
    React->>Express: GET /api/auth/me (Bearer access_token)
    Express->>Supabase: supabase.auth.getUser(access_token)
    Supabase-->>Express: Verified identity (UUID)
    Express->>DB: withUserTransaction(userId) -> SET claims -> Query profile
    DB-->>Express: Return user profile
    Express-->>React: JSON { user, profile, needsOnboarding }
    React->>User: Render Dashboard or Onboarding
```

---

## Getting Started

### 1. Prerequisites
- **Node.js**: v22.x or higher
- **npm**: v10.x or higher
- **Supabase Account**: Free project created on [supabase.com](https://supabase.com)

### 2. Installation
Install all dependencies across root, client, and server:
```bash
npm run install:all
```

---

## Environment Variables Configuration

### Frontend: `client/.env`
Create `client/.env` (see `client/.env.example`):
```env
VITE_API_URL=http://localhost:5000/api
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_anon_key
```

### Backend: `server/.env`
Create `server/.env` (see `server/.env.example`):
```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173

SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_anon_key

# Runtime connection: used by Express (restricted showtracker_app role)
DATABASE_URL=postgresql://showtracker_app:YOUR_PASSWORD@aws-0-YOUR_REGION.pooler.supabase.com:5432/postgres?sslmode=require

# Migration connection: used for migrations and DDL (admin postgres user)
MIGRATION_DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_PASSWORD@aws-0-YOUR_REGION.pooler.supabase.com:5432/postgres?sslmode=require
```

> **Important Note on IPv4 / Session Pooler**:
> Supabase direct connections (`db.[ref].supabase.co`) use IPv6 exclusively. If your local network or ISP is IPv4 only, use the **Session Pooler** URI (`aws-0-[region].pooler.supabase.com:5432`) from Supabase Dashboard &rarr; **Connect**.

---

## Google OAuth Configuration (Supabase & Google Cloud)

1. **Google Cloud Console**:
   - Create a project at [console.cloud.google.com](https://console.cloud.google.com).
   - Go to **APIs & Services** &rarr; **Credentials** &rarr; **Create Credentials** &rarr; **OAuth client ID**.
   - Application type: **Web application**.
   - Authorized JavaScript origins: `http://localhost:5173`.
   - Authorized redirect URIs: Copy the Supabase callback URI from your Supabase Dashboard (`https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`).
   - Obtain your **Client ID** and **Client Secret**.

2. **Supabase Dashboard**:
   - Go to **Authentication** &rarr; **Providers** &rarr; **Google**.
   - Toggle **Enable Google provider**.
   - Paste your Google **Client ID** and **Client Secret**. Click **Save**.
   - Go to **Authentication** &rarr; **URL Configuration**.
   - Set **Site URL** to `http://localhost:5173`.
   - Add Redirect URL: `http://localhost:5173/auth/callback`.

---

## Database Migrations & Restricted Role Setup

1. **Create Restricted Application Role**:
   - Open Supabase Dashboard &rarr; **SQL Editor**.
   - Paste and run [`supabase/setup/create_showtracker_app_role.sql`](supabase/setup/create_showtracker_app_role.sql) after setting a strong password.
   - Verify `showtracker_app` has `NOBYPASSRLS` and `NOSUPERUSER`.

2. **Run Migrations**:
   ```bash
   npm run db:migrate
   ```
   Or execute [`supabase/migrations/001_create_profiles_and_rls.sql`](supabase/migrations/001_create_profiles_and_rls.sql) in the Supabase SQL Editor.

3. **Verify Database & RLS**:
   ```bash
   npm run db:verify
   ```

---

## Running the Application

### Run both Frontend and Backend concurrently:
```bash
npm run dev
```

### Or run individually:
```bash
# Backend (Port 5000)
cd server && npm run dev

# Frontend (Port 5173)
cd client && npm run dev
```

- Open `http://localhost:5173` to access the application.
- Open `http://localhost:5173/health` to view the real-time Architecture & Database Health diagnostics.

---

## Running Automated Tests

```bash
cd server && npm test
```
Tests health endpoints, Bearer token verification, username validation, public profile privacy rules, and centralized error handling.
