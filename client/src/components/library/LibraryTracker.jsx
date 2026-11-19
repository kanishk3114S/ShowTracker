import React, { useEffect, useState } from 'react';
import { Check, Heart, LogIn, NotebookPen, Plus, Star, Trash2 } from 'lucide-react';
import { STATUS_THEME } from '../ui/theme';
import EpisodeTracker from './EpisodeTracker';
import { STATUS_META, STATUS_ORDER, RATING_OPTIONS, NOTES_MAX, fieldClass } from './libraryConstants';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Modal from '../ui/Modal';
import { StatusBadge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import { addToLibrary, updateLibraryEntry, removeFromLibrary, toApiError } from '../../services/api';
import { R } from '../../services/resources';
import { useResource } from '../../hooks/useApiResource';
import { useAuth } from '../../hooks/useAuth';
import { useSignIn } from '../auth/SignInContext';

const ADD_CHOICES = ['PLAN_TO_WATCH', 'WATCHING', 'COMPLETED'];

function NotesDialog({ open, initial, busy, onClose, onSave }) {
  const [draft, setDraft] = useState(initial ?? '');
  useEffect(() => {
    if (open) setDraft(initial ?? '');
  }, [open, initial]);
  const dirty = draft !== (initial ?? '');
  return (
    <Modal open={open} onClose={onClose} title="Private notes" description="Only you can see these. They never appear on your public profile.">
      <label htmlFor="library-notes" className="sr-only">
        Private notes
      </label>
      <textarea
        id="library-notes"
        data-autofocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={NOTES_MAX}
        rows={8}
        placeholder="Thoughts, where you stopped, who recommended it…"
        className="w-full resize-y rounded-xl border border-ink-edge bg-ink-raised p-3 text-sm leading-relaxed text-fg outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
      />
      <div className="mt-2 flex items-center justify-between text-xs text-fg-subtle">
        <span className="font-mono tabular-nums tracking-tight text-fg-muted">
          {String(draft.length).padStart(4, '0')} / {NOTES_MAX}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" loading={busy} disabled={!dirty} onClick={() => onSave(draft.trim() === '' ? null : draft)}>
            Save notes
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * The tracking panel on a media details page: add to library, status, rating,
 * favorite, private notes (dialog), remove (confirmation dialog) and, for
 * anime/TV, the episode tracker. Movies get a single watched toggle and never
 * any episode controls.
 */
export default function LibraryTracker({ media }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { openSignIn } = useSignIn();
  const { toast } = useToast();
  const mediaId = media.catalogId;
  const isMovie = media.mediaType === 'MOVIE';

  const check = useResource(R.checkEntry(mediaId), { enabled: Boolean(isAuthenticated && mediaId) });
  const [entry, setEntry] = useState(null);
  const [watchedIds, setWatchedIds] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  useEffect(() => {
    if (check.data) {
      setEntry(check.data.entry);
      setWatchedIds(new Set(check.data.watchedEpisodeIds));
    }
  }, [check.data]);

  const run = async (task) => {
    setBusy(true);
    setError(null);
    try {
      await task();
      return true;
    } catch (err) {
      setError(toApiError(err)?.message ?? 'Something went wrong.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = (status) => run(async () => setEntry(await addToLibrary({ mediaId, status })));
  // Optimistic: the screen changes immediately; the server's answer then replaces it, and a failure undoes it.
  const patch = async (changes) => {
    const before = entry;
    setEntry({ ...before, ...changes });
    setBusy(true);
    setError(null);
    try {
      setEntry(await updateLibraryEntry(before.id, changes));
      return true;
    } catch (err) {
      setEntry(before);
      const message = toApiError(err)?.message ?? 'Something went wrong.';
      setError(message);
      toast(`${message} Your change was undone.`);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const saveNotes = async (notes) => {
    if (await patch({ notes })) setNotesOpen(false);
  };
  const remove = async () => {
    const ok = await run(async () => {
      await removeFromLibrary(entry.id);
      setEntry(null);
      setWatchedIds(new Set());
    });
    if (ok) setRemoveOpen(false);
  };

  // Immediate (optimistic) change, then replaced by the server's authoritative numbers.
  const onLocalChange = (episodeIds, watched, delta) => {
    setWatchedIds((prev) => {
      const next = new Set(prev);
      episodeIds.forEach((id) => (watched ? next.add(id) : next.delete(id)));
      return next;
    });
    setEntry((prev) => ({ ...prev, watchedEpisodesCount: Math.max(0, (prev.watchedEpisodesCount ?? 0) + delta) }));
  };
  const onProgress = (summary) => {
    setEntry((prev) => ({
      ...prev,
      status: summary.status,
      startedAt: summary.startedAt,
      completedAt: summary.completedAt,
      watchedEpisodesCount: summary.watchedEpisodesCount,
      totalEpisodes: summary.totalEpisodes
    }));
  };

  const panel = 'mt-8 max-w-3xl';

  if (authLoading || (isAuthenticated && check.loading && !check.data && !check.error)) {
    return (
      <div className={panel} role="status" aria-label="Loading your tracking">
        <Skeleton className="h-28 rounded-xl" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className={panel}>
        <h2 className="text-base font-semibold text-fg">Track this {isMovie ? 'movie' : 'title'}</h2>
        <p className="mt-1 text-sm text-fg-muted">Sign in to add it to your library, rate it and keep your progress.</p>
        <Button variant="primary" leftIcon={LogIn} onClick={openSignIn} className="mt-4">
          Sign in to track
        </Button>
      </Card>
    );
  }

  if (!mediaId) {
    return (
      <Card className={panel}>
        <p className="text-sm text-fg-muted">Tracking is temporarily unavailable for this title. Please refresh and try again.</p>
      </Card>
    );
  }

  if (check.error) {
    return (
      <Card className={panel}>
        <p role="alert" className="text-sm text-[#ff9b9b]">
          {check.error.message}
        </p>
        <Button size="sm" variant="secondary" onClick={check.reload} className="mt-3">
          Try again
        </Button>
      </Card>
    );
  }

  // ----- not in library yet
  if (!entry) {
    return (
      <Card className={panel}>
        <h2 className="text-base font-semibold text-fg">Your library</h2>
        {isMovie ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" leftIcon={Check} loading={busy} onClick={() => add('COMPLETED')}>
              Mark as watched
            </Button>
            <Button variant="secondary" leftIcon={Plus} disabled={busy} onClick={() => add('PLAN_TO_WATCH')}>
              Add to Plan to Watch
            </Button>
          </div>
        ) : (
          <div className="mt-4">
            <p className="mb-2.5 text-sm text-fg-muted">Add to your library as:</p>
            <div className="flex flex-wrap gap-2">
              {ADD_CHOICES.map((status, i) => (
                <Button key={status} variant={i === 0 ? 'primary' : 'secondary'} leftIcon={Plus} disabled={busy} onClick={() => add(status)}>
                  {STATUS_META[status].label}
                </Button>
              ))}
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-[#ff9b9b]">
            {error}
          </p>
        )}
      </Card>
    );
  }

  // ----- in library
  return (
    <>
      <Card className={panel}>
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-fg">Your library</h2>
          <StatusBadge status={entry.status} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isMovie ? (
            <div>
              <span className="mb-1.5 block text-xs font-medium text-fg-subtle">Watched?</span>
              <Button
                variant={entry.status === 'COMPLETED' ? 'secondary' : 'primary'}
                leftIcon={Check}
                disabled={busy}
                aria-pressed={entry.status === 'COMPLETED'}
                onClick={() => patch({ status: entry.status === 'COMPLETED' ? 'PLAN_TO_WATCH' : 'COMPLETED' })}
                className="w-full"
              >
                {entry.status === 'COMPLETED' ? 'Watched (undo)' : 'Mark as watched'}
              </Button>
            </div>
          ) : (
            <div>
              <label htmlFor="library-status" className="mb-1.5 block text-xs font-medium text-fg-subtle">
                Status
              </label>
              <div className="relative">
                <span className={`pointer-events-none absolute left-3.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${STATUS_THEME[entry.status].dot}`} aria-hidden="true" />
                <select id="library-status" value={entry.status} disabled={busy} onChange={(e) => patch({ status: e.target.value })} className={`${fieldClass} pl-9`}>
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="library-rating" className="mb-1.5 block text-xs font-medium text-fg-subtle">
              Your rating
            </label>
            <div className="relative">
              <Star className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 fill-accent text-accent" aria-hidden="true" />
              <select
                id="library-rating"
                value={entry.rating ?? ''}
                disabled={busy}
                onChange={(e) => patch({ rating: e.target.value === '' ? null : Number(e.target.value) })}
                className={`${fieldClass} pl-9`}
              >
                <option value="">Not rated</option>
                {RATING_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r.toFixed(1)} / 10
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink-line pt-5">
          <button
            type="button"
            disabled={busy}
            aria-pressed={entry.isFavorite}
            onClick={() => patch({ isFavorite: !entry.isFavorite })}
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium transition active:scale-95 disabled:opacity-50 ${
              entry.isFavorite
                ? 'border-red-400/40 bg-red-500/10 text-red-200'
                : 'border-white/10 bg-white/[0.06] text-fg hover:bg-white/[0.11]'
            }`}
          >
            <Heart
              key={String(entry.isFavorite)}
              className={`h-4 w-4 ${entry.isFavorite ? 'animate-check-pop fill-red-500 text-red-500' : ''}`}
              aria-hidden="true"
            />
            {entry.isFavorite ? 'Favorite' : 'Add to favorites'}
          </button>
          <Button variant="secondary" leftIcon={NotebookPen} disabled={busy} onClick={() => setNotesOpen(true)}>
            {entry.notes ? 'Edit notes' : 'Add notes'}
          </Button>
          <Button variant="ghost" leftIcon={Trash2} disabled={busy} onClick={() => setRemoveOpen(true)} className="ml-auto hover:!text-[#ff9b9b]">
            Remove
          </Button>
        </div>
        {error && !notesOpen && !removeOpen && (
          <p role="alert" className="mt-3 text-sm text-[#ff9b9b]">
            {error}
          </p>
        )}
      </Card>

      {!isMovie && (
        <div className="max-w-3xl">
          <EpisodeTracker entry={entry} mediaId={mediaId} watchedIds={watchedIds} onLocalChange={onLocalChange} onProgress={onProgress} />
        </div>
      )}

      <NotesDialog open={notesOpen} initial={entry.notes} busy={busy} onClose={() => setNotesOpen(false)} onSave={saveNotes} />

      <Modal
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        size="sm"
        title="Remove from your library?"
        description={isMovie ? 'Your rating and notes for this movie will be deleted.' : 'Your rating, notes and episode progress for this title will be deleted.'}
      >
        {error && (
          <p role="alert" className="mb-3 text-sm text-[#ff9b9b]">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRemoveOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" leftIcon={Trash2} loading={busy} onClick={remove}>
            Remove
          </Button>
        </div>
      </Modal>
    </>
  );
}
