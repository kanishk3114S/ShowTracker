import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { PublicRoute } from './routes/PublicRoute';

import Landing from './pages/Landing/Landing';
import AuthCallback from './pages/AuthCallback/AuthCallback';
import Onboarding from './pages/Onboarding/Onboarding';
import Dashboard from './pages/Dashboard/Dashboard';
import Settings from './pages/Settings/Settings';
import PublicProfile from './pages/PublicProfile/PublicProfile';
import Health from './pages/Health/Health';
import Explore from './pages/Explore/Explore';
import Trending from './pages/Trending/Trending';
import MediaDetails from './pages/MediaDetails/MediaDetails';
import Credits from './pages/Credits/Credits';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Landing route */}
          <Route
            path="/"
            element={
              <PublicRoute>
                <Landing />
              </PublicRoute>
            }
          />

          {/* OAuth Redirect Callback */}
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* User Onboarding (Protected, accessible when needsOnboarding=true) */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />

          {/* Authenticated Dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Profile & Privacy Settings */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* Phase 3: public media catalog */}
          <Route path="/explore" element={<Explore />} />
          <Route path="/trending" element={<Trending />} />
          <Route path="/media/:provider/:mediaType/:externalId" element={<MediaDetails />} />
          <Route path="/about" element={<Credits />} />

          {/* Public Profile View */}
          <Route path="/u/:username" element={<PublicProfile />} />

          {/* System Architecture & Health Diagnostics */}
          <Route path="/health" element={<Health />} />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
