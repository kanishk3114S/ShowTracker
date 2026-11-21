# Deep Performance Audit & Root Cause Analysis

**Project:** ShowTracker (`AniWatch_TRACKER`)  
**Audit Date:** November 21, 2026  
**Auditor:** Senior Frontend Performance Engineer & Web Performance Architect  

---

## 1. Executive Summary

A comprehensive performance audit was conducted across the ShowTracker application using Google Chrome DevTools, Chromium 157, and Lighthouse 13.5/13.6 under mobile Moto G Power emulation with DevTools Slow 4G throttling.

The initial baseline score of **15/100** was caused by a combination of testing against an unbundled Vite dev server and severe code-level architectural bottlenecks that impacted initial rendering, main-thread responsiveness, and visual stability.

---

## 2. Categorized Findings & Root Causes

### Priority 1: Critical Rendering Path & Extreme FCP/LCP
- **Finding:** FCP at 46.9s, LCP at 99.3s in baseline.
- **Root Causes:**
  1. **Public Route Auth Spinner:** `PublicRoute.jsx` conditionally returned a full-screen spinner (`FullScreenLoader`) while `loading` from `useAuth()` was true. Even for anonymous users without a session, the entire landing page was hidden until `supabase.auth.getSession()` resolved.
  2. **Render-Blocking External Stylesheets:** Google Fonts (`Inter` and `Shippori Mincho`) were requested via blocking `<link rel="stylesheet">` tags in `index.html`.
  3. **LCP Element Opacity Delay:** The primary LCP element was identified as the hero `<h1>` (`Your watchlist. Your stories. Your universe.`). In `Landing.jsx`, this element was wrapped in `<Reveal delay={0.05}>`, starting at `opacity: 0, y: 14`. Lighthouse does not attribute LCP to an element until its rendered opacity becomes non-zero, creating an artificial ~3.5s delay on mobile.
  4. **Uncompressed Static Assets in Local Preview:** Vite preview served raw uncompressed assets (258 kB JS, 70 kB CSS) without Gzip/Brotli, quadrupling network transmission times over Slow 4G.

### Priority 2: JavaScript Bundle Size & Main-Thread Blocking (TBT)
- **Finding:** Total Blocking Time of 1,800 ms with 20 long tasks; 13.8 MB unminified JS savings reported.
- **Root Causes:**
  1. **Framer Motion in Critical Path:** `vendor-motion` (161.5 kB, 54.5 kB gzip) was statically imported by `Button.jsx` (for `whileTap`), `Toast.jsx` (`AnimatePresence`), `UserMenu.jsx`, `AppShell.jsx` (`motion.main`), and `SignInContext.jsx` (which statically imported `Modal.jsx`). Evaluating Framer Motion on a throttled mobile CPU triggered long tasks exceeding 580 ms.
  2. **Route Prefetch Flood:** `prefetchAllRoutesWhenIdle()` in `AppShell.jsx` executed dynamic imports for all 13 application routes on idle, downloading 32 JavaScript chunk files simultaneously and saturating both CPU script parsing and network queues.
  3. **Procedural SVG Noise Rasterization:** `body::after` in `index.css` used an inline SVG `<feTurbulence>` filter covering the entire viewport. On mobile GPUs, procedural fractal noise filters cause continuous expensive rasterization passes on every paint.

### Priority 3: Cumulative Layout Shift (CLS: 0.263)
- **Finding:** Layout shift score of 0.263 (target < 0.100).
- **Root Causes:**
  1. **Missing Poster Dimensions:** `<PosterImage>` rendered `<img>` elements without explicit `width` or `height` attributes or intrinsic aspect-ratio definitions. When poster cards loaded, surrounding grid containers snapped from 0px to their loaded heights.
  2. **Header User State Swap:** TopHeader rendered a skeleton loader while `loading` was true, then swapped to sign-in buttons once auth resolved, shifting the header layout.

### Priority 4: Database & API Latency (Backend Tuning)
- **Finding:** Dashboard radar and library queries suffered from sequential scans on large episode and media tables.
- **Root Causes:**
  1. Missing composite indexes on `episodes (air_date)` and `media_sources (media_id, created_at)`.
  2. Cache-Control headers on media endpoints lacked `stale-while-revalidate` directives.
  3. `ReleaseRadar.jsx` and `Upcoming.jsx` included a live 1-second interval ticker (`useNow()`) inside top-level section grouping memos, causing full component tree re-renders every 1,000 ms.

---

## 3. Severity Matrix

| Issue | Severity | User Impact | Metric Affected |
|---|:---:|---|---|
| Dev server unbundled modules | Critical | Massive initial download waterfall | FCP, LCP, SI |
| PublicRoute auth spinner block | Critical | Blank screen until Supabase init | FCP, LCP |
| Uncompressed asset delivery | High | 4x longer download over mobile 4G | FCP, LCP, SI |
| Framer Motion in Button/Header | High | 580ms long task on mobile CPU | TBT |
| Missing poster width/height | High | Visible layout jumps during load | CLS |
| SVG feTurbulence background | Medium | High CPU/GPU rasterization | TBT, SI |
| 32-chunk route prefetch flood | Medium | Bandwidth saturation on mobile | TBT, LCP |
| 1s interval re-render in Radar | Medium | Unnecessary React render loops | CPU, Battery |
