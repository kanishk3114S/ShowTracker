import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Route guard for pages that signed-in users should not see (Landing, SignIn).
 *
 * While auth is still resolving we render the page immediately — the Landing
 * page is fully meaningful for unauthenticated visitors and showing it right
 * away eliminates the full-screen spinner from the critical path.
 * Once auth is confirmed we redirect to /dashboard (or /onboarding).
 */
export function PublicRoute({ children }) {
  const { isAuthenticated, loading, needsOnboarding } = useAuth();

  // Auth is still resolving: show the page immediately so the first paint
  // is instant. If the user IS authenticated the redirect fires once loading
  // is false (a fraction of a second later), so there is no visual flicker.
  if (loading) {
    return children;
  }

  if (isAuthenticated) {
    if (needsOnboarding) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default PublicRoute;
