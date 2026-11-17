import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
  Film, 
  User, 
  Settings, 
  LogOut, 
  ExternalLink, 
  Activity, 
  ShieldCheck, 
  CheckCircle2, 
  Calendar,
  Sparkles,
  Lock,
  Globe
} from 'lucide-react';

export default function Dashboard() {
  const { user, profile, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out failed:', err.message);
    }
  };

  const displayName = profile?.display_name || user?.user_metadata?.full_name || 'ShowTracker Explorer';
  const username = profile?.username;
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const isProfilePublic = profile?.profile_visibility === 'PUBLIC';
  const isLibraryPublic = profile?.library_visibility === 'PUBLIC';

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F3F4F6] flex flex-col font-sans selection:bg-red-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-[#2A3245] bg-[#151922]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-900/30">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-white">ShowTracker</span>
                <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-800/60 text-emerald-400">
                  Phase 2 Active
                </span>
              </div>
              <p className="text-xs text-[#9CA3AF]">Logged in as @{username}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              to="/explore"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#1C2230] hover:bg-[#2A3245] border border-[#2A3245] text-white transition-all"
            >
              <span>Explore</span>
            </Link>

            <Link
              to="/trending"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#1C2230] hover:bg-[#2A3245] border border-[#2A3245] text-white transition-all"
            >
              <span>Trending</span>
            </Link>

            <Link
              to="/settings"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#1C2230] hover:bg-[#2A3245] border border-[#2A3245] text-white transition-all"
            >
              <Settings className="w-3.5 h-3.5 text-red-400" />
              <span>Settings</span>
            </Link>

            <Link
              to="/health"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#1C2230] hover:bg-[#2A3245] border border-[#2A3245] text-[#9CA3AF] hover:text-white transition-all"
            >
              <Activity className="w-3.5 h-3.5 text-red-400" />
              <span>Health</span>
            </Link>

            <button
              onClick={handleSignOut}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-400 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-8">
        
        {/* Profile Card Hero */}
        <section className="bg-gradient-to-r from-[#151922] via-[#1C2230] to-[#151922] border border-[#2A3245] rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center space-x-5">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-red-500/50 shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-[#2A3245] flex items-center justify-center text-[#9CA3AF]">
                  <User className="w-10 h-10" />
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl font-bold text-white tracking-tight">{displayName}</h1>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-950 border border-red-800/60 text-red-400 font-mono">
                    @{username}
                  </span>
                </div>
                <p className="text-xs text-[#9CA3AF] max-w-md">{profile?.bio || 'No bio added yet.'}</p>
                <div className="flex items-center space-x-3 text-xs text-[#9CA3AF] pt-1">
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>Joined {new Date(profile?.created_at || Date.now()).toLocaleDateString()}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 w-full md:w-auto">
              {username && (
                <Link
                  to={`/u/${username}`}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center space-x-2 px-4 py-2 text-xs font-semibold rounded-xl bg-white text-neutral-900 hover:bg-neutral-100 transition-colors shadow-md"
                >
                  <span>View Public Profile</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
              <Link
                to="/settings"
                className="flex-1 md:flex-initial inline-flex items-center justify-center space-x-2 px-4 py-2 text-xs font-semibold rounded-xl bg-[#1C2230] hover:bg-[#2A3245] border border-[#2A3245] text-white transition-colors"
              >
                <span>Edit Profile</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Status & Privacy Settings Badges */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Privacy Card */}
          <div className="bg-[#151922] border border-[#2A3245] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Privacy & Row Level Security Status</span>
              </h3>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                Protected by RLS
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#1C2230] border border-[#2A3245]">
                <div className="flex items-center space-x-2.5">
                  {isProfilePublic ? (
                    <Globe className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Lock className="w-4 h-4 text-amber-400" />
                  )}
                  <div>
                    <p className="font-semibold text-white">Profile Visibility</p>
                    <p className="text-[#9CA3AF]">Controls public access to your page at /u/{username}</p>
                  </div>
                </div>
                <span className={`font-mono font-bold px-2 py-0.5 rounded ${isProfilePublic ? 'text-emerald-400 bg-emerald-950/50' : 'text-amber-400 bg-amber-950/50'}`}>
                  {profile?.profile_visibility}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#1C2230] border border-[#2A3245]">
                <div className="flex items-center space-x-2.5">
                  {isLibraryPublic ? (
                    <Globe className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Lock className="w-4 h-4 text-amber-400" />
                  )}
                  <div>
                    <p className="font-semibold text-white">Library Visibility</p>
                    <p className="text-[#9CA3AF]">Protects your watched titles, ratings & private notes</p>
                  </div>
                </div>
                <span className={`font-mono font-bold px-2 py-0.5 rounded ${isLibraryPublic ? 'text-emerald-400 bg-emerald-950/50' : 'text-amber-400 bg-amber-950/50'}`}>
                  {profile?.library_visibility}
                </span>
              </div>
            </div>
          </div>

          {/* Phase Roadmap Card */}
          <div className="bg-[#151922] border border-[#2A3245] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Next Milestone: Phase 3 Media Discovery</span>
              </h3>
              <span className="text-xs text-[#9CA3AF]">Upcoming</span>
            </div>

            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Phase 2 Google Authentication and Onboarding is complete! Real catalog exploration (AniList GraphQL for Anime and TMDB API for Movies & Series) will arrive in Phase 3.
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex items-center space-x-2 text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Google OAuth + Supabase Auth Session Lifecycle Active</span>
              </div>
              <div className="flex items-center space-x-2 text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Profile Onboarding with Unique Handle Verification Active</span>
              </div>
              <div className="flex items-center space-x-2 text-[#9CA3AF]">
                <span className="w-4 h-4 rounded-full border border-[#2A3245] flex items-center justify-center text-[10px]">3</span>
                <span>AniList & TMDB Catalog Adapters & Normalized Search</span>
              </div>
            </div>
          </div>

        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#2A3245] bg-[#151922] py-4 px-6 text-center text-xs text-[#9CA3AF]">
        <span>ShowTracker &bull; Phase 2 Completed &bull; Ready for Phase 3</span>
      </footer>
    </div>
  );
}
