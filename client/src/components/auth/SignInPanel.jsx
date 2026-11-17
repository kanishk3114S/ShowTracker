import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import Button from '../ui/Button';
import Logo from '../ui/Logo';
import { useAuth } from '../../hooks/useAuth';
import { useTrendingArtwork } from '../../hooks/useTrendingArtwork';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.27-2.09 3.57-5.17 3.57-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3a7.2 7.2 0 0 1-10.7-3.78H1.34v3.09A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.36 14.31a7.2 7.2 0 0 1 0-4.62V6.6H1.34a12 12 0 0 0 0 10.8l4.02-3.09z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.34 6.6l4.02 3.09A7.2 7.2 0 0 1 12 4.77z" />
    </svg>
  );
}

/**
 * Split-screen sign-in: brand + real trending artwork on the left, the Google
 * sign-in surface on the right. Used both as a modal (landing/header) and as the /signin page.
 * Authentication itself is the existing Supabase Google OAuth (PKCE) flow.
 */
export default function SignInPanel() {
  const { signInWithGoogle, error: authError } = useAuth();
  const { backdrops } = useTrendingArtwork();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const backdrop = backdrops[0];

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle(); // redirects to Google; the page unloads on success
    } catch (err) {
      setError(err?.message || 'Could not start Google sign-in. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-[30rem] md:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink-base md:block">
        {backdrop && <img src={backdrop.backdropUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-base via-ink-base/60 to-ink-base/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-base/70 to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-8">
          <Logo />
          <div>
            <p className="text-2xl font-bold leading-snug tracking-tight text-fg">
              Your watchlist.
              <br />
              Your stories.
              <br />
              Your universe.
            </p>
            {backdrop && <p className="mt-4 text-xs text-fg-muted">Trending now: {backdrop.title}</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center p-8 sm:p-10">
        <div className="md:hidden">
          <Logo />
        </div>
        <h2 className="mt-6 text-2xl font-bold tracking-tight text-fg md:mt-0">Welcome to ShowTracker</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          Sign in to build your personal library and track every episode. New here? Signing in creates your account.
        </p>

        <Button
          variant="outline"
          size="lg"
          loading={loading}
          onClick={handleSignIn}
          className="mt-8 w-full !border-[#3b455e] !bg-fg !text-[#1f2937] hover:!bg-white"
          leftIcon={loading ? undefined : GoogleMark}
        >
          {loading ? 'Redirecting to Google…' : 'Continue with Google'}
        </Button>

        {(error || authError) && (
          <p role="alert" className="mt-4 rounded-lg border border-vermilion/40 bg-vermilion/10 px-3 py-2 text-sm text-[#ff9b9b]">
            {error || authError}
          </p>
        )}

        <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-fg-subtle">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-copper" aria-hidden="true" />
          We only use your Google account to sign you in. Your library notes are always private, and you decide what your
          public profile shows.
        </p>
      </div>
    </div>
  );
}
