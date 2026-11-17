import React, { lazy } from 'react';
import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import FullScreenLoader from './components/ui/FullScreenLoader';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { PublicRoute } from './routes/PublicRoute';
import AppShell from './components/layout/AppShell';

import Landing from './pages/Landing/Landing';
const SignIn = lazy(() => import('./pages/Auth/SignIn'));
const AuthCallback = lazy(() => import('./pages/AuthCallback/AuthCallback'));
const Onboarding = lazy(() => import('./pages/Onboarding/Onboarding'));
const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Explore = lazy(() => import('./pages/Explore/Explore'));
const Trending = lazy(() => import('./pages/Trending/Trending'));
const MediaDetails = lazy(() => import('./pages/MediaDetails/MediaDetails'));
const Library = lazy(() => import('./pages/Library/Library'));
const PublicProfile = lazy(() => import('./pages/PublicProfile/PublicProfile'));
const Settings = lazy(() => import('./pages/Settings/Settings'));
const Credits = lazy(() => import('./pages/Credits/Credits'));
const Health = lazy(() => import('./pages/Health/Health'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<FullScreenLoader message="Loading…" />}>
        <Routes>
          {/* Focused flows without the application frame */}
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />
          <Route path="/health" element={<Health />} />

          {/* Everything else shares the header, mobile dock and footer */}
          <Route element={<AppShell />}>
            <Route
              path="/"
              element={
                <PublicRoute>
                  <Landing />
                </PublicRoute>
              }
            />
            <Route
              path="/signin"
              element={
                <PublicRoute>
                  <SignIn />
                </PublicRoute>
              }
            />

            <Route path="/explore" element={<Explore />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/media/:provider/:mediaType/:externalId" element={<MediaDetails />} />
            <Route path="/u/:username" element={<PublicProfile />} />
            <Route path="/about" element={<Credits />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/library"
              element={
                <ProtectedRoute>
                  <Library />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
