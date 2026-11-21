# Cross-Site Scripting (XSS) Report

## Status: PASS

## Findings

1. **Rendering Vulnerabilities:**
   - React 19 is used across the frontend.
   - Audited all components: Show titles, descriptions, episode titles, cast, user notes, and bios are rendered strictly inside standard JSX expressions (`<span>{item.title}</span>`), which natively encode `<`, `>`, `&`, `"`, `'`.
   - Verified zero usage of `dangerouslySetInnerHTML`, `innerHTML`, or raw HTML string insertion.

2. **Backend Text Sanitization:**
   - User inputs (display name, bio, notes, group names) are processed by `server/src/utils/sanitize.js`:
     - `cleanText` and `cleanLine` strip HTML-like tags (`<script>`, `<img onerror=...>`), C0 control characters, and invisible bidirectional unicode override characters.
     - Protects downstream non-React consumers (email notifications, future export files).

3. **URL & Link Injection:**
   - User-supplied URLs (`avatar_url`) are validated with Zod: must start with `http://` or `https://`.
   - Rejects `javascript:`, `vbscript:`, or `data:` URL schemes.
   - External links use `rel="noopener noreferrer"`.

## What's at risk
XSS vulnerabilities enable attackers to execute arbitrary scripts in victims' browsers, potentially exfiltrating session tokens or performing unauthorized actions.

## What's already secure
- React's default output encoding.
- Zero raw HTML injection APIs.
- Server-side stripping of HTML markup and bidirectional unicode characters.
- Protocol allowlisting for avatar links.

## Recommendations
- Never introduce `dangerouslySetInnerHTML` or `innerHTML`. If rich text rendering is needed in the future, sanitize input using DOMPurify.
