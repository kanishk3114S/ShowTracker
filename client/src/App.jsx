import React, { lazy } from 'react';
import { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import FullScreenLoader from './components/ui/FullScreenLoader';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { PublicRoute } from './routes/PublicRoute';
import AppShell from './components/layout/AppShell';
import { pageLoaders } from './routes/pages';

import Landing from './pages/Landing/Landing';
import NotFound from './pages/NotFound/NotFound';
const SignIn = lazy(pageLoaders.SignIn);
const AuthCallback = lazy(pageLoaders.AuthCallback);
const Onboarding = lazy(pageLoaders.Onboarding);
const Dashboard = lazy(pageLoaders.Dashboard);
const Explore = lazy(pageLoaders.Explore);
const Trending = lazy(pageLoaders.Trending);
const MediaDetails = lazy(pageLoaders.MediaDetails);
const Library = lazy(pageLoaders.Library);
const Upcoming = lazy(pageLoaders.Upcoming);
const PublicProfile = lazy(pageLoaders.PublicProfile);
const Settings = lazy(pageLoaders.Settings);
const Credits = lazy(pageLoaders.Credits);
const Health = lazy(pageLoaders.Health);

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
              path="/upcoming"
              element={
                <ProtectedRoute>
                  <Upcoming />
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

            {/* Anything unknown gets the cinematic 404 inside the normal frame */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
