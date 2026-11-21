# Show Tracker Specific Security Report

## Status: PASS

## Findings

1. **Personal Library & Progress Integrity:**
   - Episode watching mutations (`markWatched`, `markUnwatched`, `markSeasonWatched`) validate that:
     - The target library entry exists and belongs to the authenticated user.
     - The episode or season exists and belongs specifically to that parent show (verified by `test/library.test.js`: "guard: an episode of Show A cannot be marked on Show B's entry").
     - Movies cannot be marked with episode progress (returns 400).
   - Prevents manipulating another user's progress or attaching mismatched episode IDs to arbitrary library entries.

2. **External Media Provider Trust:**
   - Provider responses from AniList, TMDB, TVmaze, and TheTVDB are treated as untrusted external inputs.
   - All string fields (titles, overviews, character names) are normalized, with HTML tags stripped where multi-line user text is involved.
   - Ratings are strictly bounded to numeric values between 0.0 and 10.0.
   - Dates are validated against strict ISO date regexes (`/^\d{4}-\d{2}-\d{2}$/`) before calculation. Missing or invalid dates are converted to `null` and excluded from countdown calculations.

3. **Schedule Manipulation:**
   - Airing timestamps and dates are validated: invalid dates do not crash calculations or produce negative/distorted countdowns.
   - When the user's system clock deviates from server time, client synchronization offsets (`useMemo(() => data?.serverTime ? Date.parse(data.serverTime) - Date.now() : 0, [data])`) guarantee consistent countdown rendering.

4. **Data Privacy & Minimal Storage:**
   - User notes are strictly private and never exposed publicly on profiles or shared catalog tables.
   - No tracking telemetry or personal identifiers are sent to external TV providers. Outbound provider requests query solely media IDs and search strings.

## What's at risk
Corrupted provider schedules, forged episode IDs, or cross-contamination of show progress would compromise data integrity and degrade user trust.

## What's already secure
- Foreign-key and cross-entity validation on all watch progress endpoints.
- Independent privacy controls for user profiles and libraries.
- Strict date formatting and parsing validations.

## Recommendations
- Continue enforcing cross-entity relation checks on any newly added episode or season tracking routes.
