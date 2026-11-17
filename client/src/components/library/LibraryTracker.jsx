import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Loader2, LogIn, Plus, Trash2, Check, Star } from 'lucide-react';
import EpisodeTracker from './EpisodeTracker';
import { STATUS_META, STATUS_ORDER, RATING_OPTIONS, NOTES_MAX } from './libraryConstants';
import {
  checkLibraryEntry,
  addToLibrary,
  updateLibraryEntry,
  removeFromLibrary,
  toApiError
} from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { useAuth } from '../../hooks/useAuth';

const ADD_CHOICES = ['PLAN_TO_WATCH', 'WATCHING', 'COMPLETED'];
const inputClass =
  'rounded-lg border border-[#2A3245] bg-[#0B0E14] px-2.5 py-1.5 text-sm text-white outline-none focus:border-red-500 disabled:opacity-50';

function NotesEditor({ initial, disabled, onSave }) {
  const [draft, setDraft] = useState(initial ?? '');
  const dirty = draft !== (initial ?? '');
  return (
    <div>
      <label htmlFor="library-notes" className="text-[11px] uppercase tracking-wider text-[#6B7280]">
        Private notes
      </label>
      <textarea
        id="library-notes"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={NOTES_MAX}
        rows={3}
        placeholder="Only you can see these."
        className={`${inputClass} mt-1 w-full resize-y`}
      />
      <div className="mt-1 flex items-center justify-between text-xs text-[#6B7280]">
        <span>
          {draft.length} / {NOTES_MAX}
        </span>
        <button
          type="button"
          disabled={!dirty || disabled}
          onClick={() => onSave(draft.trim() === '' ? null : draft)}
          className="rounded-md border border-[#2A3245] bg-[#1C2230] px-3 py-1 text-xs font-medium text-white transition hover:bg-[#2A3245] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save notes
        </button>
      </div>
    </div>
  );
}

/**
 * The tracking panel on a media details page: add to library, status, rating,
 * favorite, private notes, remove, and (for anime/TV) the episode tracker.
 * Movies get a single "watched" toggle and never any episode controls.
 */
export default function LibraryTracker({ media }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const mediaId = media.catalogId;
  const isMovie = media.mediaType === 'MOVIE';

  const check = useApiResource((signal) => checkLibraryEntry(mediaId, signal), [mediaId], {
    enabled: Boolean(isAuthenticated && mediaId)
  });
  const [entry, setEntry] = useState(null);
  const [watchedIds, setWatchedIds] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

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
    } catch (err) {
      setError(toApiError(err)?.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const add = (status) => run(async () => setEntry(await addToLibrary({ mediaId, status })));
  const patch = (changes) => run(async () => setEntry(await updateLibraryEntry(entry.id, changes)));
  const remove = () =>
    run(async () => {
      await removeFromLibrary(entry.id);
      setEntry(null);
      setWatchedIds(new Set());
      setConfirmRemove(false);
    });

  const onProgress = (summary, episodeIds, watched) => {
    setEntry((prev) => ({
      ...prev,
      status: summary.status,
      startedAt: summary.startedAt,
      completedAt: summary.completedAt,
      watchedEpisodesCount: summary.watchedEpisodesCount,
      totalEpisodes: summary.totalEpisodes
    }));
    setWatchedIds((prev) => {
      const next = new Set(prev);
      episodeIds.forEach((id) => (watched ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const panel = 'mt-8 max-w-3xl rounded-2xl border border-[#2A3245] bg-[#151922]/80 p-5';

  if (authLoading || (isAuthenticated && check.loading && !check.data && !check.error)) {
    return <div className={`${panel} animate-pulse`} role="status" aria-label="Loading your tracking"><div className="h-9 w-48 rounded-lg bg-[#1C2230]" /></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className={panel}>
        <p className="text-sm text-[#D1D5DB]">Sign in to add this title to your library and track your progress.</p>
        <Link
          to="/"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
        >
          <LogIn className="h-4 w-4" /> Sign in to track
        </Link>
      </div>
    );
  }

  if (!mediaId) {
    return (
      <div className={panel}>
        <p className="text-sm text-[#9CA3AF]">Tracking is temporarily unavailable for this title. Please refresh and try again.</p>
      </div>
    );
  }

  if (check.error) {
    return (
      <div className={panel}>
        <p role="alert" className="text-sm text-red-300">{check.error.message}</p>
        <button type="button" onClick={check.reload} className="mt-2 text-sm font-medium text-red-400 hover:text-red-300">
          Try again
        </button>
      </div>
    );
  }

  // ----- not in library yet
  if (!entry) {
    return (
      <div className={panel}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF]">Your library</h2>
        {isMovie ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => add('COMPLETED')}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" /> Mark as watched
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => add('PLAN_TO_WATCH')}
              className="inline-flex items-center gap-2 rounded-lg border border-[#2A3245] bg-[#1C2230] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#2A3245] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add to Plan to Watch
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <p className="mb-2 text-sm text-[#D1D5DB]">Add to your library as:</p>
            <div className="flex flex-wrap gap-2">
              {ADD_CHOICES.map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={busy}
                  onClick={() => add(status)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#2A3245] bg-[#1C2230] px-4 py-2 text-sm font-medium text-white transition hover:border-red-500/60 hover:bg-[#2A3245] disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {STATUS_META[status].label}
                </button>
              ))}
            </div>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      </div>
    );
  }

  // ----- in library
  const meta = STATUS_META[entry.status];
  return (
    <>
      <div className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF]">Your library</h2>
          <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${meta.badge}`}>{meta.label}</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isMovie ? (
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#6B7280]">Watched?</span>
              <button
                type="button"
                disabled={busy}
                aria-pressed={entry.status === 'COMPLETED'}
                onClick={() => patch({ status: entry.status === 'COMPLETED' ? 'PLAN_TO_WATCH' : 'COMPLETED' })}
                className={`mt-1 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                  entry.status === 'COMPLETED'
                    ? 'border-sky-700 bg-sky-950/40 text-sky-200'
                    : 'border-[#2A3245] bg-[#1C2230] text-white hover:bg-[#2A3245]'
                }`}
              >
                <Check className="h-4 w-4" />
                {entry.status === 'COMPLETED' ? 'Watched (click to undo)' : 'Mark as watched'}
              </button>
            </div>
          ) : (
            <div>
              <label htmlFor="library-status" className="text-[11px] uppercase tracking-wider text-[#6B7280]">
                Status
              </label>
              <select
                id="library-status"
                value={entry.status}
                disabled={busy}
                onChange={(e) => patch({ status: e.target.value })}
                className={`${inputClass} mt-1 block w-full`}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="library-rating" className="text-[11px] uppercase tracking-wider text-[#6B7280]">
              Your rating
            </label>
            <div className="mt-1 flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400" />
              <select
                id="library-rating"
                value={entry.rating ?? ''}
                disabled={busy}
                onChange={(e) => patch({ rating: e.target.value === '' ? null : Number(e.target.value) })}
                className={`${inputClass} flex-1`}
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

        <div className="mt-4">
          <NotesEditor key={entry.id} initial={entry.notes} disabled={busy} onSave={(notes) => patch({ notes })} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#2A3245] pt-4">
          <button
            type="button"
            disabled={busy}
            aria-pressed={entry.isFavorite}
            onClick={() => patch({ isFavorite: !entry.isFavorite })}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
              entry.isFavorite
                ? 'border-red-700 bg-red-950/40 text-red-300'
                : 'border-[#2A3245] bg-[#1C2230] text-white hover:bg-[#2A3245]'
            }`}
          >
            <Heart className={`h-4 w-4 ${entry.isFavorite ? 'fill-red-400 text-red-400' : ''}`} />
            {entry.isFavorite ? 'Favorite' : 'Add to favorites'}
          </button>

          {confirmRemove ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-[#D1D5DB]">Remove{!isMovie && ' and lose your episode progress'}?</span>
              <button type="button" disabled={busy} onClick={remove} className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
                Yes, remove
              </button>
              <button type="button" onClick={() => setConfirmRemove(false)} className="rounded-md border border-[#2A3245] px-3 py-1 text-xs text-white hover:bg-[#2A3245]">
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmRemove(true)}
              className="inline-flex items-center gap-1.5 text-sm text-[#9CA3AF] transition hover:text-red-400 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Remove from library
            </button>
          )}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      </div>

      {!isMovie && (
        <div className="max-w-3xl">
          <EpisodeTracker entry={entry} mediaId={mediaId} watchedIds={watchedIds} onProgress={onProgress} />
        </div>
      )}
    </>
  );
}
