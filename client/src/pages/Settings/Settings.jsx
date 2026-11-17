import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { updateMyProfile } from '../../services/api';
import { 
  Film, 
  ArrowLeft, 
  Save, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Globe, 
  Lock 
} from 'lucide-react';

export default function Settings() {
  const { profile, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [profileVisibility, setProfileVisibility] = useState(profile?.profile_visibility || 'PUBLIC');
  const [libraryVisibility, setLibraryVisibility] = useState(profile?.library_visibility || 'PUBLIC');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      await updateMyProfile({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        profile_visibility: profileVisibility,
        library_visibility: libraryVisibility
      });

      await refreshProfile();
      setSuccessMsg('Settings updated successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.error?.message || err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F3F4F6] flex flex-col font-sans selection:bg-red-500 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-[#2A3245] bg-[#151922]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              to="/dashboard"
              className="w-9 h-9 rounded-xl bg-[#1C2230] hover:bg-[#2A3245] border border-[#2A3245] flex items-center justify-center text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">Profile & Privacy Settings</h1>
              <p className="text-xs text-[#9CA3AF]">Manage your public details and privacy controls</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono text-[#9CA3AF]">@{profile?.username}</span>
          </div>
        </div>
      </header>

      {/* Main Form */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 space-y-6">
        
        {successMsg && (
          <div className="p-4 bg-emerald-950/30 border border-emerald-800/50 rounded-2xl flex items-center space-x-3 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-red-950/30 border border-red-800/50 rounded-2xl flex items-center space-x-3 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Identity Section */}
          <div className="bg-[#151922] border border-[#2A3245] rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Public Profile Details</h2>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#F3F4F6]">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  maxLength={80}
                  className="w-full px-3.5 py-2.5 text-xs bg-[#0B0E14] border border-[#2A3245] rounded-xl text-white placeholder-[#9CA3AF]/40 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#F3F4F6]">Bio</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell others what you love to watch..."
                  maxLength={300}
                  className="w-full px-3.5 py-2.5 text-xs bg-[#0B0E14] border border-[#2A3245] rounded-xl text-white placeholder-[#9CA3AF]/40 focus:outline-none focus:border-red-500 transition-colors resize-none"
                />
                <p className="text-[10px] text-[#9CA3AF] text-right">{bio.length} / 300 characters</p>
              </div>
            </div>
          </div>

          {/* Privacy Settings Section */}
          <div className="bg-[#151922] border border-[#2A3245] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Privacy & Visibility Controls</span>
              </h2>
            </div>
            <p className="text-xs text-[#9CA3AF]">
              ShowTracker treats profile and library visibility independently. You can share your profile page while keeping your watchlists private.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              
              {/* Profile Visibility */}
              <div className="p-4 rounded-xl bg-[#1C2230] border border-[#2A3245] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                    {profileVisibility === 'PUBLIC' ? <Globe className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
                    <span>Profile Visibility</span>
                  </span>
                  <select
                    value={profileVisibility}
                    onChange={(e) => setProfileVisibility(e.target.value)}
                    className="text-xs bg-[#0B0E14] border border-[#2A3245] rounded-lg px-2.5 py-1 text-white font-mono focus:outline-none focus:border-red-500"
                  >
                    <option value="PUBLIC">PUBLIC</option>
                    <option value="PRIVATE">PRIVATE</option>
                  </select>
                </div>
                <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                  When set to <strong>PRIVATE</strong>, visiting /u/{profile?.username} will return 404 to any outside visitor.
                </p>
              </div>

              {/* Library Visibility */}
              <div className="p-4 rounded-xl bg-[#1C2230] border border-[#2A3245] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                    {libraryVisibility === 'PUBLIC' ? <Globe className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
                    <span>Library Visibility</span>
                  </span>
                  <select
                    value={libraryVisibility}
                    onChange={(e) => setLibraryVisibility(e.target.value)}
                    className="text-xs bg-[#0B0E14] border border-[#2A3245] rounded-lg px-2.5 py-1 text-white font-mono focus:outline-none focus:border-red-500"
                  >
                    <option value="PUBLIC">PUBLIC</option>
                    <option value="PRIVATE">PRIVATE</option>
                  </select>
                </div>
                <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                  When set to <strong>PRIVATE</strong>, your watched episodes, ratings, and private notes will never leak to public APIs.
                </p>
              </div>

            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-lg shadow-red-900/30 transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>

        </form>

      </main>
    </div>
  );
}
