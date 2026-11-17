import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { checkUsernameAvailability, updateMyProfile } from '../../services/api';
import Logo from '../../components/ui/Logo';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import { Reveal } from '../../components/ui/motion';

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

const fieldClass =
  'h-12 w-full rounded-xl border border-ink-edge bg-ink-surface px-4 text-[15px] text-fg placeholder-fg-subtle outline-none transition focus:border-copper/70 focus:ring-2 focus:ring-copper/20';

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

    if (!USERNAME_REGEX.test(trimmed)) {
      setIsAvailable(false);
      setValidationError('3-30 characters: lowercase letters, numbers and underscores only.');
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
            setValidationError('That username is already taken.');
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
  const previewName = displayName.trim() || 'Your name';
  const cleaned = username.toLowerCase().trim();
  const canSubmit = Boolean(cleaned) && isAvailable === true && !checkingUsername && !submitting;

  return (
    <div className="min-h-screen bg-ink-base text-fg">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(50%_40%_at_70%_20%,rgba(224,122,95,0.10),transparent)]" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-6">
        <Logo to="/" />

        <div className="my-auto grid items-center gap-10 py-10 lg:grid-cols-[1.1fr_1fr]">
          <Reveal>
            <h1 className="text-4xl font-extrabold tracking-tight text-fg sm:text-5xl">Let&rsquo;s make it yours.</h1>
            <p className="mt-3 text-base text-fg-muted">Choose how you&rsquo;ll be known across ShowTracker.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
              <div>
                <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-fg">
                  Username
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle">@</span>
                  <input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    maxLength={30}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="your_username"
                    aria-invalid={validationError ? 'true' : 'false'}
                    aria-describedby="username-help"
                    className={`${fieldClass} pl-9 pr-11`}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2" aria-hidden="true">
                    {checkingUsername ? (
                      <Loader2 className="h-4 w-4 animate-spin text-fg-subtle" />
                    ) : isAvailable === true ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : isAvailable === false ? (
                      <XCircle className="h-4 w-4 text-[#ff7b7b]" />
                    ) : null}
                  </span>
                </div>
                <p id="username-help" aria-live="polite" className={`mt-1.5 text-xs ${validationError ? 'text-[#ff9b9b]' : isAvailable ? 'text-emerald-400' : 'text-fg-subtle'}`}>
                  {validationError ||
                    (isAvailable ? `@${cleaned} is available.` : '3-30 characters: lowercase letters, numbers and underscores.')}
                </p>
              </div>

              <div>
                <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium text-fg">
                  Display name <span className="font-normal text-fg-subtle">(optional)</span>
                </label>
                <input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={80}
                  placeholder="How should we call you?"
                  className={fieldClass}
                />
              </div>

              {submitError && (
                <p role="alert" className="rounded-lg border border-vermilion/40 bg-vermilion/10 px-3 py-2 text-sm text-[#ff9b9b]">
                  {submitError}
                </p>
              )}

              <Button type="submit" variant="primary" size="lg" loading={submitting} disabled={!canSubmit} rightIcon={ArrowRight} className="w-full">
                {submitting ? 'Creating your profile…' : 'Continue to ShowTracker'}
              </Button>
            </form>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-fg-subtle">Live preview</p>
            <Card className="relative overflow-hidden" padded={false}>
              <div className="h-24 bg-gradient-to-br from-copper/30 via-ink-raised to-ink-surface" aria-hidden="true" />
              <div className="px-6 pb-6">
                <Avatar src={avatarUrl} name={previewName} size="xl" className="-mt-12 border-4 border-ink-surface" />
                <p className="mt-3 truncate text-xl font-bold text-fg">{previewName}</p>
                <p className="truncate text-sm text-fg-muted">@{cleaned || 'username'}</p>
                <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
                  This is how others will see you if you share your profile. You can change your name, bio and privacy any time in Settings.
                </p>
              </div>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}
