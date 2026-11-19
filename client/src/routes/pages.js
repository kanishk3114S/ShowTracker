import { prefetchResource, R } from '../services/resources';

/**
 * Page chunks. App.jsx lazy-loads exactly these functions, so calling one early
 * (hover, idle time) downloads the chunk once and the real navigation is instant.
 */
export const pageLoaders = {
  SignIn: () => import('../pages/Auth/SignIn'),
  AuthCallback: () => import('../pages/AuthCallback/AuthCallback'),
  Onboarding: () => import('../pages/Onboarding/Onboarding'),
  Dashboard: () => import('../pages/Dashboard/Dashboard'),
  Explore: () => import('../pages/Explore/Explore'),
  Trending: () => import('../pages/Trending/Trending'),
  MediaDetails: () => import('../pages/MediaDetails/MediaDetails'),
  Library: () => import('../pages/Library/Library'),
  PublicProfile: () => import('../pages/PublicProfile/PublicProfile'),
  Settings: () => import('../pages/Settings/Settings'),
  Credits: () => import('../pages/Credits/Credits'),
  Health: () => import('../pages/Health/Health')
};

const ROUTES = [
  ['/dashboard', 'Dashboard'],
  ['/explore', 'Explore'],
  ['/trending', 'Trending'],
  ['/library', 'Library'],
  ['/settings', 'Settings'],
  ['/media/', 'MediaDetails'],
  ['/u/', 'PublicProfile'],
  ['/about', 'Credits'],
  ['/signin', 'SignIn']
];

/** Start downloading the code for a route (safe to call repeatedly). */
export function prefetchRoute(pathname) {
  const hit = ROUTES.find(([prefix]) => pathname.startsWith(prefix));
  if (hit) pageLoaders[hit[1]]().catch(() => {});
}

/** Start loading the default data a route shows first. Private data only when signed in. */
export function prefetchRouteData(pathname, isAuthenticated) {
  if (pathname.startsWith('/dashboard') && isAuthenticated) {
    [R.stats(), R.continueWatching(), R.recentlyUpdated(), R.upcoming()].forEach(prefetchResource);
  } else if (pathname.startsWith('/library') && isAuthenticated) {
    [R.library(), R.stats(), R.groups()].forEach(prefetchResource);
  } else if (pathname.startsWith('/explore')) {
    [R.search(), R.genres('ALL')].forEach(prefetchResource);
  } else if (pathname.startsWith('/trending')) {
    prefetchResource(R.trending());
  }
}

/** Hover/focus/touch handler for navigation links. */
export function prefetchNav(pathname, isAuthenticated) {
  prefetchRoute(pathname);
  prefetchRouteData(pathname, isAuthenticated);
}

/** After the first paint, quietly download every page's code (they are small) so any click is instant. */
export function prefetchAllRoutesWhenIdle() {
  const run = () => Object.values(pageLoaders).forEach((load) => load().catch(() => {}));
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2000);
}
