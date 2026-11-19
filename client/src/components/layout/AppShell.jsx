import React, { lazy, Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import TopHeader from './TopHeader';
import MobileNav from './MobileNav';
import Footer from './Footer';
import { SignInProvider } from '../auth/SignInContext';
import { ToastProvider } from '../ui/Toast';
import ErrorBoundary from '../common/ErrorBoundary';
import { prefetchAllRoutesWhenIdle } from '../../routes/pages';

// Optional extras are loaded lazily and fail quietly: if a content blocker (Brave Shields, uBlock, ...) stops one of
// these files from loading, the rest of the app must still work.
const StorageNotice = lazy(() => import('../common/StorageNotice'));
const OfflineNotice = lazy(() => import('../common/OfflineNotice'));

/**
 * Persistent frame for every standard page: sticky header (desktop nav + user
 * menu), phone bottom dock, footer, route fade-in, and the sign-in modal.
 * Pages render inside <Outlet/> and choose their own width via <Container/>
 * so hero sections can bleed edge to edge.
 */
export default function AppShell() {
  const location = useLocation();

  // After the first paint, quietly download every page's code so any click is instant.
  useEffect(() => {
    prefetchAllRoutesWhenIdle();
  }, []);
  return (
    <SignInProvider>
      <ToastProvider>
        <div className="flex min-h-screen flex-col text-fg">
          <a
            href="#main"
            className="sr-only z-[200] rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-ink-base focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
          >
            Skip to content
          </a>
          <TopHeader />
          <motion.main
            id="main"
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 pb-24 md:pb-10"
          >
            <Suspense
              fallback={
                <div role="status" aria-label="Loading page" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
                  <div className="skeleton h-10 w-48 rounded-lg" />
                  <div className="skeleton mt-6 h-64 w-full rounded-2xl" />
                </div>
              }
            >
              <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
            </Suspense>
          </motion.main>
          <Footer />
          <MobileNav />
          <ErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <StorageNotice />
              <OfflineNotice />
            </Suspense>
          </ErrorBoundary>
        </div>
      </ToastProvider>
    </SignInProvider>
  );
}
