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
  Upcoming: () => import('../pages/Upcoming/Upcoming'),
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
  ['/upcoming', 'Upcoming'],
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
  } else if (pathname.startsWith('/upcoming') && isAuthenticated) {
    prefetchResource(R.upcoming());
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

/** After the page is fully interactive and genuinely idle, quietly download secondary pages. */
export function prefetchAllRoutesWhenIdle() {
  const run = () => Object.values(pageLoaders).forEach((load) => load().catch(() => {}));
  // Wait until after the critical initialization window (8 seconds) so route prefetching
  // never competes with initial render, first contentful paint, or user interactions.
  if (typeof window.requestIdleCallback === 'function') {
    setTimeout(() => {
      window.requestIdleCallback(run, { timeout: 15000 });
    }, 6000);
  } else {
    setTimeout(run, 8000);
  }
}
