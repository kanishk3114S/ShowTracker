import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import FullScreenLoader from '../components/ui/FullScreenLoader';

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, needsOnboarding } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullScreenLoader message="Verifying your session…" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // If user hasn't set their username yet and isn't on /onboarding, enforce onboarding
  if (needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

export default ProtectedRoute;
