import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPublicProfile } from '../../services/api';
import { 
  Film, 
  User, 
  ArrowLeft, 
  Calendar, 
  Lock, 
  Globe, 
  Loader2, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';

export default function PublicProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchPublicProfile() {
      try {
        setLoading(true);
        setError(null);
        const data = await getPublicProfile(username);
        if (data?.success && data?.profile) {
          setProfile(data.profile);
        } else {
          setError('Profile not found.');
        }
      } catch (err) {
        setError(err.response?.data?.error?.message || 'User not found or profile is private.');
      } finally {
        setLoading(false);
      }
    }

    if (username) {
      fetchPublicProfile();
    }
  }, [username]);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F3F4F6] flex flex-col font-sans selection:bg-red-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-[#2A3245] bg-[#151922]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center space-x-2 text-xs font-semibold text-[#9CA3AF] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>

          <div className="flex items-center space-x-2">
            <Film className="w-5 h-5 text-red-500" />
            <span className="text-sm font-bold tracking-tight text-white">ShowTracker</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 flex flex-col items-center justify-center">
        
        {loading ? (
          <div className="flex flex-col items-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-red-500" />
            <p className="text-xs text-[#9CA3AF]">Loading profile...</p>
          </div>
        ) : error ? (
          <div className="bg-[#151922] border border-[#2A3245] rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-950/50 border border-amber-800/50 flex items-center justify-center mx-auto text-amber-400">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white">Profile Unavailable</h2>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              {error}
            </p>
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-[#1C2230] hover:bg-[#2A3245] border border-[#2A3245] text-xs font-semibold text-white transition-colors"
            >
              <span>Return to Dashboard</span>
            </Link>
          </div>
        ) : profile ? (
          <div className="bg-[#151922] border border-[#2A3245] rounded-3xl p-8 max-w-2xl w-full space-y-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 text-center sm:text-left">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name}
                  className="w-24 h-24 rounded-2xl object-cover border-2 border-red-500/50 shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-[#2A3245] flex items-center justify-center text-[#9CA3AF]">
                  <User className="w-12 h-12" />
                </div>
              )}

              <div className="space-y-2 flex-1">
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    {profile.display_name || profile.username}
                  </h1>
                  <p className="text-xs font-mono text-red-400">@{profile.username}</p>
                </div>

                <p className="text-xs text-[#9CA3AF] leading-relaxed">
                  {profile.bio || 'This user has not written a bio yet.'}
                </p>

                <div className="flex items-center justify-center sm:justify-start space-x-4 text-xs text-[#9CA3AF] pt-2">
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Member since {new Date(profile.created_at).toLocaleDateString()}</span>
                  </span>
                  <span className="flex items-center space-x-1 text-emerald-400">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Public Profile</span>
                  </span>
                </div>
              </div>
            </div>

            {profile.isOwner && (
              <div className="p-3.5 bg-red-950/20 border border-red-800/40 rounded-xl flex items-center justify-between text-xs text-red-300">
                <span>You are viewing your own public profile.</span>
                <Link
                  to="/settings"
                  className="font-semibold underline hover:text-white"
                >
                  Edit in Settings
                </Link>
              </div>
            )}
          </div>
        ) : null}

      </main>
    </div>
  );
}
