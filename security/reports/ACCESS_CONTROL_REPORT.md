# Access Control Security Report

## Status: PASS

## Findings

1. **User Ownership Verification on Resources:**
   - Every protected API route that updates or reads user data scopes lookups to `req.user.id`.
   - `library.service.js`:
     - `UPDATE public.user_library ... WHERE id = $1 AND user_id = $2`
     - `DELETE FROM public.user_library WHERE id = $1 AND user_id = $2`
     - Attempting to update or delete an entry belonging to another user returns HTTP 404 (`LIBRARY_ENTRY_NOT_FOUND`) rather than revealing existence or mutating data.
   - `groups.service.js`:
     - Group mutations verify `user_id = $2`.
     - Group item additions explicitly verify that both the group and the library entry belong to the calling user.
   - Progress mutations (`markWatched`, `markUnwatched`, `markSeasonWatched`):
     - Verify that the target entry belongs to `req.user.id` and that the episode/season belongs to that specific media item.
   - Verified by integration test `test/library.test.js`: "isolation: user B cannot read, update, delete or track user A's entry (404, nothing changed)".

2. **Public Profile & Library Privacy Controls:**
   - Independent privacy flags: `profile_visibility` and `library_visibility` in `public.profiles`.
   - If `profile_visibility = 'PRIVATE'` and caller is not the owner: profile is inaccessible (returns 404).
   - If `library_visibility = 'PRIVATE'` and caller is not the owner: profile returns metadata only; `library` array is empty `[]` and `stats` is `null`.
   - Notes privacy: Non-owners query through `public.public_library_entries` view, which physically omits the `notes` column. Personal notes are never leaked to public viewers.

3. **Admin Endpoints:**
   - There are no public admin endpoints exposed on Express. Administrative migrations are run via CLI (`npm run db:migrate`) using `MIGRATION_DATABASE_URL`.

## What's at risk
Broken access controls would allow attackers to view other users' private watchlists and notes, mark episodes as watched on behalf of others, or delete entries.

## What's already secure
- Defense-in-depth: Application-layer ownership checks combined with database-layer Row Level Security.
- Private notes are excluded at both SQL view layer and JavaScript serialization layer.
- Direct object reference attacks (IDOR) return 404 and fail silently without data leakage.

## Recommendations
- Continue enforcing dual-layer ownership checks (application `user_id = $x` + database RLS) on all future endpoints.
