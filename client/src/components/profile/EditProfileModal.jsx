import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import AvatarUploader from './AvatarUploader';
import { useAuth } from '../../hooks/useAuth';
import { updateMyProfile } from '../../services/api';

const fieldClass =
  'w-full rounded-xl border border-ink-edge bg-ink-raised px-4 py-2.5 text-[15px] text-fg placeholder-fg-subtle outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20';

function EditForm({ profile, onClose, onSaved }) {
  const { refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const dirty = displayName !== (profile.display_name || '') || bio !== (profile.bio || '');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateMyProfile({ display_name: displayName.trim() || null, bio: bio.trim() || null });
      await refreshProfile();
      onSaved();
      onClose();
    } catch (err) {
      const apiError = err.response?.data?.error;
      const detail = Array.isArray(apiError?.details) ? apiError.details[0]?.message : null;
      setError(detail || apiError?.message || err.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <p className="mb-2 text-sm font-medium text-fg">Profile picture</p>
        <AvatarUploader profile={profile} onSaved={onSaved} />
      </div>
      <div>
        <label htmlFor="edit-display-name" className="mb-1.5 block text-sm font-medium text-fg">
          Display name
        </label>
        <input id="edit-display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} className={fieldClass} placeholder="Your name" />
      </div>
      <div>
        <label htmlFor="edit-bio" className="mb-1.5 block text-sm font-medium text-fg">
          Bio
        </label>
        <textarea id="edit-bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} className={`${fieldClass} resize-y`} placeholder="Tell people what you love to watch." />
        <p className="mt-1 text-right text-xs tabular-nums text-fg-subtle">{bio.length} / 300</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-[#ff9b9b]">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button as={Link} to="/settings" variant="ghost" size="sm" leftIcon={SettingsIcon} onClick={onClose}>
          Privacy settings
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1 sm:flex-none">
            Close
          </Button>
          <Button type="submit" variant="primary" leftIcon={Save} loading={saving} disabled={!dirty} className="flex-1 sm:flex-none">
            Save
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Edit profile dialog on the profile page (owner only): picture, display name and bio. */
export default function EditProfileModal({ open, onClose, onSaved }) {
  const { profile } = useAuth();
  return (
    <Modal open={open} onClose={onClose} title="Edit profile" description="Changes appear on your public profile.">
      {profile ? <EditForm profile={profile} onClose={onClose} onSaved={onSaved} /> : null}
    </Modal>
  );
}
