import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { getMe } from '../services/api';

export const AuthContext = createContext({
  user: null,
  session: null,
  profile: null,
  loading: true,
  isAuthenticated: false,
  needsOnboarding: false,
  error: null,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {}
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch ShowTracker profile from Express
  const fetchProfile = useCallback(async () => {
    try {
      const data = await getMe();
      if (data?.success && data?.profile) {
        setProfile(data.profile);
      }
      return data;
    } catch (err) {
      console.warn('[AuthContext] Could not fetch ShowTracker profile:', err.message);
      return null;
    }
  }, []);

  // Initialize and subscribe to Supabase Auth state changes
  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        setLoading(true);
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (mounted) {
          if (initialSession?.user) {
            setSession(initialSession);
            setUser(initialSession.user);
            await fetchProfile();
          } else {
            setSession(null);
            setUser(null);
            setProfile(null);
          }
        }
      } catch (err) {
        console.error('[AuthContext] Initialization error:', err.message);
        if (mounted) {
          setError(err.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    // Listen to Supabase auth events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      } else if (currentSession?.user) {
        setSession(currentSession);
        setUser(currentSession.user);
        // Defer API call outside the sync auth event to prevent deadlock
        setTimeout(() => {
          if (mounted) {
            fetchProfile();
          }
        }, 0);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
      if (signInError) throw signInError;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    return await fetchProfile();
  }, [fetchProfile]);

  const value = useMemo(() => {
    const isAuthenticated = Boolean(user && session);
    const needsOnboarding = Boolean(isAuthenticated && profile && profile.username === null);

    return {
      user,
      session,
      profile,
      loading,
      isAuthenticated,
      needsOnboarding,
      error,
      signInWithGoogle,
      signOut,
      refreshProfile
    };
  }, [user, session, profile, loading, error, signInWithGoogle, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
