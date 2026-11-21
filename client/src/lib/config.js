/**
 * Build-time configuration (Vite bakes VITE_* variables into the bundle when `npm run build` runs).
 * A production build made without them would silently talk to localhost and show an empty app,
 * so missing values are detected up front and reported by <ConfigError/> instead.
 */
const env = import.meta.env;

export const API_BASE_URL = env.VITE_API_URL || (env.DEV ? 'http://localhost:5000/api' : '/api');

const looksLocal = (url) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(url || '');

/** Names of required variables that are missing or wrong for a production build. Always [] in development. */
export function findConfigProblems() {
  if (env.DEV) return [];
  const problems = [];
  if (env.VITE_API_URL && looksLocal(env.VITE_API_URL) && !looksLocal(window.location.origin)) {
    problems.push({ name: 'VITE_API_URL', hint: 'it points at localhost, which visitors cannot reach' });
  }
  if (!env.VITE_SUPABASE_URL) problems.push({ name: 'VITE_SUPABASE_URL', hint: 'your Supabase project URL' });
  if (!env.VITE_SUPABASE_PUBLISHABLE_KEY) problems.push({ name: 'VITE_SUPABASE_PUBLISHABLE_KEY', hint: 'your Supabase publishable (anon) key' });
  return problems;
}
