# Performance Baseline Report

**Project:** ShowTracker (`AniWatch_TRACKER`)  
**Audit Date:** November 21, 2026  
**Auditor:** Senior Frontend Performance Engineer & Web Performance Architect  
**Tested Route:** `/` (Landing Page, entry point for anonymous & unauthenticated visitors)  
**Baseline Test Date:** November 21, 2026  

---

## 1. Test Environment Analysis

### Initial Environment Discovery
When investigating the origin of the initial Lighthouse score of **15/100**, the repository and process inspection revealed that Lighthouse was run against the **Vite development server** (`http://localhost:5173/`), not the optimized production build (`dist/`).

### Test Configuration
- **Lighthouse Version:** 13.5.0 / 13.6.0
- **Browser:** Chromium 157.0.8103.79 (Google Chrome 64-bit on Windows)
- **Device Emulation:** Moto G Power (412 × 823 viewport, DPR 1.75)
- **Throttling Profile:** DevTools Slow 4G (1.6 Mbps download, 750 kbps upload, 150 ms round-trip latency, 4× CPU slowdown)
- **Session Type:** Single page session, cold cache initial load
- **Tested URL:** `http://localhost:5173/` (Dev baseline) vs `http://localhost:4173/` (Prod benchmark)

---

## 2. Baseline Measurements

### Comparative Environment Matrix

| Metric | Dev Server Baseline (`http://localhost:5173/`) | Target Standard |
|---|---:|---:|
| **Lighthouse Performance Score** | **15 / 100** | **90+** |
| **First Contentful Paint (FCP)** | **46.9 seconds** | < 2.0 seconds |
| **Largest Contentful Paint (LCP)** | **99.3 seconds** | < 2.5 seconds |
| **Total Blocking Time (TBT)** | **1,800 ms** | < 200 ms |
| **Cumulative Layout Shift (CLS)** | **0.263** | < 0.100 |
| **Speed Index (SI)** | **46.9 seconds** | < 3.0 seconds |

---

## 3. Dev Server Overhead vs. Code-Level Bottlenecks

### A. Development Server Specific Overhead
1. **Unbundled ES Module Cascade:**  
   Vite's dev server serves each module as an individual HTTP request. Across 2,726 modules, loading the unbundled component graph across Slow 4G throttling (150 ms RTT per round trip) generated hundreds of sequential network requests, directly resulting in the catastrophic 46.9s FCP and 99.3s LCP.
2. **Unminified Code & HMR Client:**  
   Source files were served unminified with source maps and Vite's `@vite/client` Hot Module Replacement client injected. This accounted for the **13,855 KiB potential JavaScript minification savings** reported by Lighthouse.
3. **No Asset Compression:**  
   The Vite dev server does not apply Gzip or Brotli compression, resulting in the **18,747 KiB total network payload**.

### B. Genuine Code-Level Bottlenecks (Present in both Dev & Prod)
Even when built for production, rigorous profiling revealed five critical architectural bottlenecks:
1. **Synchronous Render-Blocking Google Fonts:**  
   `<link rel="stylesheet">` tags in `index.html` referencing `fonts.googleapis.com` blocked first paint until Google Fonts CSS arrived.
2. **Auth State Render-Blocking in `PublicRoute.jsx`:**  
   `PublicRoute` rendered `<FullScreenLoader message="Loading…" />` while Supabase auth checked `supabase.auth.getSession()`. Anonymous first-time visitors were blocked from seeing the Landing hero until Supabase session verification completed.
3. **Missing Image Dimensions & High CLS (0.263):**  
   `<PosterImage>` components omitted explicit `width` and `height` attributes, causing cards and hero banners to collapse to 0px height before image load and expand abruptly upon load.
4. **Framer Motion Layout & Loop Overheads:**  
   - Continuous keyframe animation loops (`animate={{ y: [0, drift, 0] }}`) inside 3D perspective containers triggered non-composited animation warnings and style recalculation.
   - `motion.main` in `AppShell.jsx` began at `opacity: 0, y: 8` on initial render, delaying LCP paint.
   - Hero `<h1>` was wrapped in `<Reveal delay={0.05}>` with `opacity: 0`, forcing Lighthouse to delay LCP attribution until the animation opacity reached 1.
   - `Button.jsx`, `Toast.jsx`, and `UserMenu.jsx` statically imported `motion/react`, forcing 161 kB of Framer Motion into the initial entry bundle.
5. **Aggressive Route Prefetch Flood:**  
   `AppShell.jsx` invoked `prefetchAllRoutesWhenIdle()` immediately after mount, downloading 32 route chunks simultaneously and saturating bandwidth on mobile networks.
