# Server-Side Request Forgery (SSRF) Report

## Status: PASS (Non-Exploitable By Design)

## Findings

1. **User URL Fetching:**
   - Evaluated the entire codebase for user-supplied URL fetching (such as URL scrapers, link preview generators, webhook testers, or image proxies).
   - No feature in the ShowTracker backend accepts a user-provided URL and fetches it server-side.
   - Profile `avatar_url` accepts an HTTP(S) URL string, but this URL is stored as text in PostgreSQL and loaded directly by the user's browser via `<img src=...>`, never retrieved by the Node.js backend.

2. **Outbound Request Destination Control:**
   - All outbound backend HTTP requests are initiated exclusively to hardcoded, static upstream provider hosts:
     - `https://graphql.anilist.co`
     - `https://api.themoviedb.org/3`
     - `https://api.tvmaze.com`
     - `https://api4.thetvdb.com/v4`
     - `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1`
   - Request parameters are strictly validated numeric provider IDs or controlled query strings.
   - No user input controls the destination hostname, IP address, scheme, or port.

3. **Internal Network / Cloud Metadata Protection:**
   - Because no arbitrary outbound fetches exist, cloud metadata services (e.g. `169.254.169.254`), localhost (`127.0.0.1`), and internal container networks cannot be queried via user input.

## What's at risk
If user-provided URLs were fetched server-side without IP validation, attackers could access cloud instance metadata, probe private container ports, or exfiltrate internal services.

## What's already secure
- Complete absence of server-side URL fetching functionality.
- Static, allowlisted upstream destination URLs.

## Recommendations
- If an image proxy or server-side URL scraper is ever added in the future, implement private IP range blocking (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`) with pre-request DNS resolution.
