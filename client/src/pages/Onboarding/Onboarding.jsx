import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { checkUsernameAvailability, updateMyProfile } from '../../services/api';
import { 
  Film, 
  User, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ArrowRight,
  AlertCircle
} from 'lucide-react';

export default function Onboarding() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [isAvailable, setIsAvailable] = useState(null); // null | true | false
  const [validationError, setValidationError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill display name from Google metadata or profile
  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name);
    } else if (user?.user_metadata?.full_name) {
      setDisplayName(user.user_metadata.full_name);
    }
  }, [profile, user]);

  // Debounced username availability checker
  useEffect(() => {
    const trimmed = username.toLowerCase().trim();
    if (!trimmed) {
      setIsAvailable(null);
      setValidationError(null);
      return;
    }

    const regex = /^[a-z0-9_]{3,30}$/;
    if (!regex.test(trimmed)) {
      setIsAvailable(false);
      setValidationError('3-30 characters, lowercase letters, numbers, and underscores only.');
      return;
    }

    setValidationError(null);
    setCheckingUsername(true);

    const timer = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailability(trimmed);
        if (res.success) {
          setIsAvailable(res.available);
          if (!res.available) {
            setValidationError('This username is already claimed.');
          }
        }
      } catch {
        // Ignore transient check errors
      } finally {
        setCheckingUsername(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !isAvailable || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      await updateMyProfile({
        username: username.toLowerCase().trim(),
        display_name: displayName.trim() || undefined
      });

      await refreshProfile();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message || 'Could not complete onboarding.';
      setSubmitError(msg);
      setSubmitting(false);
    }
  };

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  return (
    <div className="min-h-screen bg-[#0B0E14] text-[#F3F4F6] flex flex-col items-center justify-center p-6 selection:bg-red-500 selection:text-white">
      <div className="max-w-md w-full space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-950/40 mx-auto">
            <Film className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Welcome to ShowTracker!</h1>
          <p className="text-xs text-[#9CA3AF]">
            Claim your unique username and set up your public identity.
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-[#151922] border border-[#2A3245] rounded-2xl p-6 md:p-8 space-y-6 shadow-xl">
          
          {/* User Preview */}
          <div className="flex items-center space-x-4 p-3.5 bg-[#1C2230] rounded-xl border border-[#2A3245]">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-12 h-12 rounded-xl object-cover border border-[#2A3245]"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-[#2A3245] flex items-center justify-center text-[#9CA3AF]">
                <User className="w-6 h-6" />
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">
                {displayName || user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-xs text-[#9CA3AF] truncate">{user?.email}</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#F3F4F6]">
                Choose your Username <span className="text-red-400">*</span>
              </label>
              
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-mono text-[#9CA3AF]">
                  @
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="spike_spiegel"
                  maxLength={30}
                  className="w-full pl-7 pr-10 py-2.5 text-xs font-mono bg-[#0B0E14] border border-[#2A3245] rounded-xl text-white placeholder-[#9CA3AF]/40 focus:outline-none focus:border-red-500 transition-colors"
                />
                
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  {checkingUsername ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  ) : isAvailable === true ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : isAvailable === false ? (
                    <XCircle className="w-4 h-4 text-red-400" />
                  ) : null}
                </div>
              </div>

              {/* Validation helper text */}
              {validationError ? (
                <p className="text-xs text-red-400 font-medium">{validationError}</p>
              ) : isAvailable === true ? (
                <p className="text-xs text-emerald-400 font-medium">Username is available!</p>
              ) : (
                <p className="text-xs text-[#9CA3AF]">3 to 30 characters: lowercase letters, numbers, and underscores.</p>
              )}
            </div>

            {/* Display Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#F3F4F6]">
                Display Name (Optional)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Spike Spiegel"
                maxLength={80}
                className="w-full px-3.5 py-2.5 text-xs bg-[#0B0E14] border border-[#2A3245] rounded-xl text-white placeholder-[#9CA3AF]/40 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>

            {/* Submit Error */}
            {submitError && (
              <div className="p-3 bg-red-950/30 border border-red-800/50 rounded-xl flex items-start space-x-2 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!username || isAvailable !== true || submitting}
              className="w-full mt-2 inline-flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-lg shadow-red-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Saving your profile...</span>
                </>
              ) : (
                <>
                  <span>Complete Onboarding</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>

      </div>
    </div>
  );
}
