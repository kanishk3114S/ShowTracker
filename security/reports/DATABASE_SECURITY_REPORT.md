# Database Security Report

## Status: PASS

## Findings

1. **Role Separation & Least Privilege:**
   - The application connects to PostgreSQL as `showtracker_app` (`NOSUPERUSER`, `NOBYPASSRLS`), created in `supabase/setup/create_showtracker_app_role.sql`.
   - `showtracker_app` cannot bypass Row Level Security.
   - Administrative DDL actions are isolated to `MIGRATION_DATABASE_URL` (`postgres` role), which is only used when running migrations (`npm run db:migrate`).
   - Permissions on all application tables (`profiles`, `media_items`, `media_sources`, `seasons`, `episodes`, `user_library`, `user_episode_progress`, `library_groups`, `library_group_items`) have `REVOKE ALL FROM anon, authenticated, PUBLIC;` and only grant minimal required DML to `showtracker_app`.

2. **Row Level Security (RLS) Enforcement:**
   - Every single table in the schema has `ENABLE ROW LEVEL SECURITY`.
   - All user-data tables (`public.profiles`, `public.user_library`, `public.user_episode_progress`, `public.library_groups`, `public.library_group_items`) have `FORCE ROW LEVEL SECURITY`.
   - Explicit policies enforce `auth.uid() = user_id` for all operations (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
   - Progress rows enforce ownership via `EXISTS (SELECT 1 FROM public.user_library ul WHERE ul.id = user_library_id AND ul.user_id = auth.uid())`.
   - Group junction items enforce ownership via `EXISTS (SELECT 1 FROM public.library_groups g WHERE g.id = group_id AND g.user_id = auth.uid())`.

3. **Transaction Context Scoping (`withUserTransaction`):**
   - User transactions execute `SET LOCAL "request.jwt.claims" = '{"sub": "<userId>"}';` inside isolated PostgreSQL transactions.
   - Automated tests (`test/library.test.js`) verify that transaction claims do not leak between pooled connections and roll back completely on transaction failure.

4. **Query Parameterization:**
   - Checked all database queries across `server/src/modules/`, `server/src/services/`, and `server/src/db/`.
   - 100% of queries use `$1`, `$2`, `$3` parameterized arguments via `client.query(...)`.
   - Dynamic update sets (`library.service.js`, `groups.service.js`) use strictly allowlisted static column assignments with dynamic parameter placeholders (e.g. `rating = $3`), preventing SQL injection.

## What's at risk
Improper database configuration or missing RLS would allow unauthorized users to view, tamper with, or delete other users' libraries, viewing progress, private notes, and custom shelves.

## What's already secure
- Complete RLS coverage across every schema table.
- Restricted runtime database role with `NOBYPASSRLS`.
- Parameterized SQL everywhere, with no string concatenation of user inputs.
- Transaction-scoped JWT claims preventing cross-tenant leakage.

## Recommendations
- Maintain current parameterized query patterns and ensure future migrations continue to enforce RLS and explicit grants.
