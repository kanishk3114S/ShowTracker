import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
  Film, 
  Tv, 
  ShieldCheck, 
  Sparkles, 
  Activity, 
  ArrowRight,
  AlertCircle,
  Loader2
} from 'lucide-react';

export default function Landing() {
  const { signInWithGoogle, error: authError } = useAuth();
  const [signingIn, setSigningIn] = useState(false);
  const [localError, setLocalError] = useState(null);

  const handleGoogleSignIn = async () => {
    try {
      setSigningIn(true);
      setLocalError(null);
      await signInWithGoogle();
    } catch (err) {
      setLocalError(err.message || 'Google sign-in could not be initiated.');
      setSigningIn(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F3F4F6] flex flex-col font-sans selection:bg-red-500 selection:text-white">
      {/* Navbar */}
      <header className="border-b border-[#2A3245] bg-[#151922]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-900/30">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white">ShowTracker</span>
              <p className="text-xs text-[#9CA3AF]">One account. One library. Everything you watch.</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/health"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#1C2230] hover:bg-[#2A3245] border border-[#2A3245] text-[#9CA3AF] hover:text-white transition-all"
            >
              <Activity className="w-3.5 h-3.5 text-red-400" />
              <span>System Health</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 md:py-20 flex flex-col items-center text-center space-y-8">
        
        {/* Release Tag */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-red-950/60 border border-red-800/50 text-red-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Phase 2: Google Authentication & Profile Onboarding</span>
        </div>

        {/* Main Heading */}
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-tight">
          Track Anime, Movies & TV Shows in <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-400">One Unified Library</span>
        </h1>

        {/* Subtitle */}
        <p className="text-base md:text-lg text-[#9CA3AF] max-w-2xl leading-relaxed">
          Stop juggling multiple tracking apps. ShowTracker links your favorite anime, films, and TV series under one profile with true privacy controls and episode-level accuracy.
        </p>

        {/* Error Alert if sign-in fails */}
        {displayError && (
          <div className="w-full max-w-md bg-red-950/30 border border-red-800/50 rounded-xl p-4 flex items-start space-x-3 text-left text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-red-200">Authentication Error</p>
              <p>{displayError}</p>
            </div>
          </div>
        )}

        {/* Primary Action Button */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md">
          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="w-full inline-flex items-center justify-center space-x-3 px-6 py-3.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 font-semibold text-sm shadow-xl hover:shadow-2xl transition-all duration-200 disabled:opacity-50"
          >
            {signingIn ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-neutral-900" />
                <span>Redirecting to Google...</span>
              </>
            ) : (
              <>
                {/* Google Icon SVG */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
                <ArrowRight className="w-4 h-4 text-neutral-400" />
              </>
            )}
          </button>
        </div>

        {/* Feature Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-12 text-left">
          
          <div className="bg-[#151922] border border-[#2A3245] rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-950/70 border border-red-800/60 flex items-center justify-center text-red-400">
              <Film className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Anime & Catalog</h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Track seasonal anime episode by episode with AniList metadata, clear airing schedules, and ratings.
            </p>
          </div>

          <div className="bg-[#151922] border border-[#2A3245] rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-950/70 border border-amber-800/60 flex items-center justify-center text-amber-400">
              <Tv className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Movies & TV Series</h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Complete TMDB catalog integration. Keep track of what you are currently watching and what to plan next.
            </p>
          </div>

          <div className="bg-[#151922] border border-[#2A3245] rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/70 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">True Privacy Controls</h3>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Share your public profile while keeping your watchlist, personal notes, and ratings completely private.
            </p>
          </div>

        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#2A3245] bg-[#151922] py-4 px-6 text-center text-xs text-[#9CA3AF]">
        <span>ShowTracker &bull; Personal Entertainment Tracker &bull; Phase 2</span>
      </footer>
    </div>
  );
}
