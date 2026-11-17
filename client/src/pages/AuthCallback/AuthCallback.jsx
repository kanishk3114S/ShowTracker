import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { AlertCircle, Clapperboard } from 'lucide-react';
import FullScreenLoader from '../../components/ui/FullScreenLoader';
import Button from '../../components/ui/Button';

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

  if (!errorMsg) return <FullScreenLoader message="Completing Google sign-in…" />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-base p-6 text-fg">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-ink-base">
        <Clapperboard className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <div role="alert" className="w-full max-w-md space-y-4 rounded-2xl border border-vermilion/30 bg-vermilion/5 p-6 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-[#ff7b7b]" aria-hidden="true" />
        <h1 className="text-lg font-bold text-fg">Sign-in didn&rsquo;t complete</h1>
        <p className="text-sm leading-relaxed text-fg-muted">{errorMsg}</p>
        <Button variant="primary" className="w-full" onClick={() => navigate('/', { replace: true })}>
          Back to ShowTracker
        </Button>
      </div>
    </div>
  );
}
