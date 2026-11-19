import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Globe, Library as LibraryIcon, Lock, LogOut, Save, Settings as SettingsIcon } from 'lucide-react';
import Container from '../../components/layout/Container';
import PageHeader from '../../components/layout/PageHeader';
import AvatarUploader from '../../components/profile/AvatarUploader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Switch from '../../components/ui/Switch';
import { Reveal } from '../../components/ui/motion';
import { useAuth } from '../../hooks/useAuth';
import { updateMyProfile } from '../../services/api';

import { useDocumentHead } from '../../hooks/useDocumentHead';
const fieldClass =
  'w-full rounded-xl border border-ink-edge bg-ink-raised px-4 py-2.5 text-[15px] text-fg placeholder-fg-subtle outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20';

/** What a stranger sees, given the two privacy switches. Mirrors the server's rules exactly. */
function PrivacyPreview({ profilePublic, libraryPublic, username }) {
  let tone = 'neutral';
  let title;
  let lines;
  if (!profilePublic) {
    tone = 'red';
    title = 'Nobody can open your profile';
    lines = ['Your profile page shows "This profile is private" to everyone else.', 'Your library and statistics are hidden too, whatever the library switch says.'];
  } else if (!libraryPublic) {
    tone = 'neutral';
    title = 'Strangers see your profile, not your library';
    lines = ['Visible: username, display name, avatar, bio and join date.', 'Hidden: saved titles, watched episodes and statistics.'];
  } else {
    title = 'Strangers see your profile and library';
    lines = ['Visible: profile details, saved titles with status, rating and progress, and your statistics.', 'Always private: your personal notes.'];
  }
  const border = tone === 'red' ? 'border-red-400/25 bg-red-500/[0.05]' : 'border-white/10 bg-white/[0.03]';
  return (
    <div className={`rounded-xl border p-4 ${border}`} aria-live="polite">
      <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Privacy preview</p>
      <p className="mt-1.5 text-sm font-semibold text-fg">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-fg-muted">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      {profilePublic && username && (
        <Button as={Link} to={`/u/${username}`} variant="ghost" size="sm" className="mt-3 !px-0 text-accent hover:!bg-transparent" leftIcon={Eye}>
          Open your public page
        </Button>
      )}
    </div>
  );
}

function PrivacyRow({ icon: Icon, title, description, checked, onChange, id }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 ${checked ? 'bg-accent/15 text-accent' : 'bg-white/[0.06] text-fg-muted'}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <p id={`${id}-label`} className="text-sm font-semibold text-fg">
            {title}: <span className={checked ? 'text-emerald-400' : 'text-fg-muted'}>{checked ? 'Public' : 'Private'}</span>
          </p>
          <p id={`${id}-desc`} className="mt-1 text-sm leading-relaxed text-fg-muted">
            {description}
          </p>
        </div>
      </div>
      <Switch checked={checked} onChange={onChange} label={`${title}: ${checked ? 'public' : 'private'}`} describedBy={`${id}-desc`} />
    </div>
  );
}

function SettingsForm({ profile }) {
  const { refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [profilePublic, setProfilePublic] = useState((profile.profile_visibility || 'PUBLIC') === 'PUBLIC');
  const [libraryPublic, setLibraryPublic] = useState((profile.library_visibility || 'PUBLIC') === 'PUBLIC');

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const dirty =
    displayName !== (profile.display_name || '') ||
    bio !== (profile.bio || '') ||
    profilePublic !== ((profile.profile_visibility || 'PUBLIC') === 'PUBLIC') ||
    libraryPublic !== ((profile.library_visibility || 'PUBLIC') === 'PUBLIC');

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await updateMyProfile({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        profile_visibility: profilePublic ? 'PUBLIC' : 'PRIVATE',
        library_visibility: libraryPublic ? 'PUBLIC' : 'PRIVATE'
      });
      await refreshProfile();
      setSuccessMsg('Your settings have been saved.');
    } catch (err) {
      const apiError = err.response?.data?.error;
      const detail = Array.isArray(apiError?.details) ? apiError.details[0]?.message : null;
      setErrorMsg(detail || apiError?.message || err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate('/', { replace: true });
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6" noValidate>
      <Reveal>
        <Card>
          <h2 className="text-base font-semibold text-fg">Profile information</h2>
          <p className="mt-1 text-sm text-fg-muted">This is how you appear on your public profile.</p>

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-fg">Profile picture</p>
            <AvatarUploader profile={profile} />
            <p className="mt-1 truncate text-xs text-fg-subtle">
              {displayName.trim() || `@${profile.username}`} · @{profile.username}
            </p>
          </div>

          <div className="mt-5 grid gap-5">
            <div>
              <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium text-fg">
                Display name
              </label>
              <input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} className={fieldClass} placeholder="Your name" />
            </div>
            <div>
              <label htmlFor="bio" className="mb-1.5 block text-sm font-medium text-fg">
                Bio
              </label>
              <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} className={`${fieldClass} resize-y`} placeholder="Tell people what you love to watch." />
              <p className="mt-1 text-right text-xs tabular-nums text-fg-subtle">{bio.length} / 300</p>
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.06}>
        <Card>
          <h2 className="text-base font-semibold text-fg">Privacy</h2>
          <p className="mt-1 text-sm text-fg-muted">Two independent switches. You decide what the world can see.</p>

          <div className="mt-5 space-y-3">
            <PrivacyRow
              id="profile-vis"
              icon={profilePublic ? Globe : EyeOff}
              title="Profile visibility"
              description="When private, no one can view your profile page."
              checked={profilePublic}
              onChange={setProfilePublic}
            />
            <PrivacyRow
              id="library-vis"
              icon={profilePublic && libraryPublic ? LibraryIcon : Lock}
              title="Library visibility"
              description="When private, visitors to your public profile cannot see your saved titles, watched episodes, or statistics. Personal notes are always private."
              checked={libraryPublic}
              onChange={setLibraryPublic}
            />
          </div>

          <div className="mt-5">
            <PrivacyPreview profilePublic={profilePublic} libraryPublic={libraryPublic} username={profile.username} />
          </div>
        </Card>
      </Reveal>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div aria-live="polite" className="min-h-[1.5rem] text-sm">
          {successMsg && (
            <span className="inline-flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {successMsg}
            </span>
          )}
          {errorMsg && (
            <span role="alert" className="text-[#ff9b9b]">
              {errorMsg}
            </span>
          )}
          {!successMsg && !errorMsg && dirty && <span className="text-fg-subtle">You have unsaved changes.</span>}
        </div>
        <Button type="submit" variant="primary" leftIcon={Save} loading={saving} disabled={!dirty}>
          Save changes
        </Button>
      </div>

      <Reveal delay={0.1}>
        <Card>
          <h2 className="text-base font-semibold text-fg">Account</h2>
          <p className="mt-1 text-sm text-fg-muted">Sign out of ShowTracker on this device.</p>
          <Button type="button" variant="destructive" leftIcon={LogOut} onClick={handleSignOut} className="mt-4">
            Sign out
          </Button>
        </Card>
      </Reveal>
    </form>
  );
}

export default function Settings() {
  useDocumentHead({ title: 'Settings & Privacy — ShowTracker', description: 'Manage your profile and privacy.', noindex: true });
  const { profile } = useAuth();
  return (
    <Container className="max-w-3xl py-8 sm:py-10">
      <PageHeader
        icon={SettingsIcon}
        title="Settings & privacy"
        breadcrumbs={[{ label: 'Dashboard', to: '/dashboard' }, { label: 'Settings' }]}
        description="Manage your profile and decide who can see it."
      />
      {profile ? <SettingsForm key={profile.id} profile={profile} /> : null}
    </Container>
  );
}
