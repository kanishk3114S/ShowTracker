import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Film, Loader2, AlertCircle } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshProfile } = useAuth();
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    async function handleAuthCallback() {
      // 1. Check for URL error params (e.g., error=access_denied&error_description=...)
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');
      if (error) {
        setErrorMsg(errorDescription || error);
        return;
      }

      try {
        // 2. Exchange authorization code if present (PKCE flow)
        const code = searchParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (exchangeError) {
            console.warn('[AuthCallback] exchangeCodeForSession notice:', exchangeError.message);
          }
        }

        // 3. Resolve current session from PKCE exchange
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session?.user) {
          // If no session found yet, wait for onAuthStateChange to settle
          const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (currentSession?.user) {
              authListener.subscription.unsubscribe();
              const profileRes = await refreshProfile();
              if (profileRes?.profile?.username) {
                navigate('/dashboard', { replace: true });
              } else {
                navigate('/onboarding', { replace: true });
              }
            }
          });
          return;
        }

        // 3. Session resolved! Fetch profile from Express backend
        const profileRes = await refreshProfile();

        if (profileRes?.profile?.username) {
          navigate('/dashboard', { replace: true });
        } else {
          navigate('/onboarding', { replace: true });
        }
      } catch (err) {
        console.error('[AuthCallback Error]:', err.message);
        setErrorMsg(err.message || 'Authentication callback failed.');
      }
    }

    handleAuthCallback();
  }, [navigate, searchParams, refreshProfile]);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F3F4F6] flex flex-col items-center justify-center p-6 space-y-6">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center shadow-xl shadow-red-950/40">
        <Film className="w-7 h-7 text-white" />
      </div>

      {errorMsg ? (
        <div className="bg-red-950/30 border border-red-800/50 rounded-2xl p-6 max-w-md w-full space-y-4 text-center">
          <div className="w-10 h-10 rounded-full bg-red-900/60 flex items-center justify-center mx-auto text-red-400">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-white">Authentication Failed</h2>
          <p className="text-xs text-red-300 leading-relaxed">{errorMsg}</p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full py-2.5 px-4 rounded-xl bg-white text-neutral-900 text-xs font-semibold hover:bg-neutral-100 transition-colors"
          >
            Return to Landing Page
          </button>
        </div>
      ) : (
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center space-x-2 text-sm text-[#9CA3AF]">
            <Loader2 className="w-4 h-4 animate-spin text-red-500" />
            <span className="font-medium text-white">Completing Google sign-in...</span>
          </div>
          <p className="text-xs text-[#9CA3AF] max-w-xs">
            Verifying your authentication token and syncing your ShowTracker profile.
          </p>
        </div>
      )}
    </div>
  );
}
