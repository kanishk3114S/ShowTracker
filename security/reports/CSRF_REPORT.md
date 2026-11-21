# Cross-Site Request Forgery (CSRF) Report

## Status: PASS (Inapplicable to Architecture / Inherently Protected)

## Findings

1. **Authentication Token Architecture:**
   - The application does not use browser session cookies for API authentication.
   - Authentication relies entirely on Bearer JWT access tokens obtained via Supabase Auth and transmitted explicitly in the HTTP `Authorization: Bearer <token>` header on each API request.

2. **Cross-Origin Credential Behavior:**
   - Because cookies are not used for API session management, browsers do not automatically attach credentials to cross-origin requests.
   - Cross-origin forms or malicious websites cannot force a user's browser to send an `Authorization: Bearer` header to the ShowTracker API.

3. **HTTP Verb Discipline:**
   - All state-changing operations (adding titles, toggling watched episodes, updating profiles, deleting items) require `POST`, `PATCH`, or `DELETE` methods.
   - `GET` requests never modify application state.

## What's at risk
In cookie-based web applications, CSRF attacks trick an authenticated user's browser into executing unwanted actions on another site where the user is logged in.

## What's already secure
- Token-based Authorization header architecture makes traditional browser CSRF attacks impossible.
- Strict method separation ensures GET requests remain side-effect free.

## Recommendations
- Retain the current Bearer token model. If cookie authentication is ever introduced in the future, configure `SameSite=Lax` or `Strict`, `HttpOnly`, `Secure`, and CSRF protection middleware.
