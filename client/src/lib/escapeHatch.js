/**
 * URL escape hatch: open the app with ?clear-cache=1 (or ?reset=1) to wipe everything it stored in
 * this browser (localStorage + sessionStorage) and boot clean. For a session stuck in a bad state.
 *
 * This is its own module, imported FIRST by main.jsx: ES modules run in import order, so the wipe
 * happens before the Supabase client (or anything else) reads storage, which a plain block at the
 * top of main.jsx could not guarantee (imports are hoisted above it).
 */
try {
  const params = new URLSearchParams(window.location.search);
  if (params.has('clear-cache') || params.has('reset')) {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, document.title, window.location.pathname);
    console.info('[ShowTracker] Local and session cache purged via URL param.');
  }
} catch (e) {
  console.warn('[ShowTracker] Cache purge check failed:', e);
}
