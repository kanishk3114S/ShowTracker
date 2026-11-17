import React, { useEffect, useId, useRef, useState } from 'react';
import { Camera, Link2, Trash2, UploadCloud } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { updateMyProfile } from '../../services/api';
import { removeOldAvatar, uploadAvatar, validateAvatarFile } from '../../lib/avatarUpload';

const fieldClass =
  'w-full rounded-xl border border-ink-edge bg-ink-raised px-4 py-2.5 text-[15px] text-fg placeholder-fg-subtle outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20';

const apiMessage = (err, fallback) => {
  const apiError = err.response?.data?.error;
  const detail = Array.isArray(apiError?.details) ? apiError.details[0]?.message : null;
  return detail || apiError?.message || err.message || fallback;
};

/**
 * Profile picture editor: click or drag-and-drop an image (JPEG/PNG/WebP, 5 MB),
 * instant circular preview, upload to Supabase Storage, then saves it on the profile.
 * If storage is unavailable, an image link can be pasted instead (with live preview).
 * The picture is saved immediately; `onSaved(url | null)` tells the parent.
 */
export default function AvatarUploader({ profile, onSaved }) {
  const { user, refreshProfile } = useAuth();
  const inputId = useId();
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null); // object URL of the file being uploaded
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [link, setLink] = useState('');

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const persist = async (url) => {
    const previous = profile.avatar_url;
    await updateMyProfile({ avatar_url: url });
    await refreshProfile();
    onSaved?.(url);
    if (previous && previous !== url) removeOldAvatar(previous, user?.id);
  };

  const handleFile = async (file) => {
    if (busy) return;
    setError(null);
    const problem = validateAvatarFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const url = await uploadAvatar(file, user?.id);
      await persist(url);
    } catch (err) {
      setError(apiMessage(err, 'Could not save your picture.'));
      if (/storage|upload/i.test(err.message || '')) setShowLink(true);
    } finally {
      setBusy(false);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const applyLink = async () => {
    const value = link.trim();
    if (!/^https?:\/\//i.test(value)) {
      setError('Enter a full image link starting with http:// or https://');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await persist(value);
      setLink('');
      setShowLink(false);
    } catch (err) {
      setError(apiMessage(err, 'Could not save that link.'));
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async () => {
    setBusy(true);
    setError(null);
    try {
      await persist(null);
    } catch (err) {
      setError(apiMessage(err, 'Could not remove your picture.'));
    } finally {
      setBusy(false);
    }
  };

  const name = profile.display_name || profile.username || '';
  const shown = preview || profile.avatar_url || null;
  const linkPreview = /^https?:\/\//i.test(link.trim()) ? link.trim() : null;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative shrink-0 self-center sm:self-auto">
          <Avatar src={shown} name={name} size="xl" className={busy ? 'opacity-60' : ''} />
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center" role="status" aria-label="Uploading">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </span>
          )}
        </div>

        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed px-4 py-5 text-center transition ${
            dragging ? 'border-accent bg-accent/10' : 'border-white/15 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05]'
          } ${busy ? 'pointer-events-none opacity-60' : ''}`}
        >
          <UploadCloud className="h-6 w-6 text-accent" aria-hidden="true" />
          <span className="text-sm font-semibold text-fg">Click to upload or drag a picture here</span>
          <span className="text-xs text-fg-subtle">JPEG, PNG or WebP · up to 5 MB · cropped to a square</span>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" leftIcon={Link2} onClick={() => setShowLink((v) => !v)} aria-expanded={showLink}>
          Use an image link
        </Button>
        {profile.avatar_url && (
          <Button size="sm" variant="ghost" leftIcon={Trash2} onClick={removePhoto} disabled={busy}>
            Remove picture
          </Button>
        )}
      </div>

      {showLink && (
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center">
          <Avatar src={linkPreview} name={name} size="lg" />
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault(); // never submit a surrounding settings form
                if (linkPreview && !busy) applyLink();
              }
            }}
            placeholder="https://…"
            aria-label="Avatar image link"
            className={fieldClass}
          />
          <Button variant="primary" size="md" leftIcon={Camera} onClick={applyLink} loading={busy} disabled={!linkPreview}>
            Apply
          </Button>
        </div>
      )}

      <p aria-live="polite" className="mt-2 min-h-[1.25rem] text-sm">
        {error && (
          <span role="alert" className="text-[#ff9b9b]">
            {error}
          </span>
        )}
      </p>
    </div>
  );
}
