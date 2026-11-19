import React, { useState } from 'react';
import PosterLink from '../ui/PosterLink';
import { Link } from 'react-router-dom';
import { Heart, RefreshCw, Star } from 'lucide-react';
import PosterImage from '../media/PosterImage';
import RatingPill from '../cinema/RatingPill';
import { StatusBadge, CategoryBadge } from '../ui/Badge';
import ProgressBar, { progressPercent, toneForType } from '../ui/ProgressBar';
import { TYPE_THEME, STATUS_THEME } from '../ui/theme';
import { STATUS_META, STATUS_ORDER, RATING_OPTIONS } from './libraryConstants';
import { TYPE_LABELS, mediaPath } from '../media/mediaUtils';
import { useMediaPrefetch } from '../../hooks/usePrefetch';
import { updateLibraryEntry, toApiError } from '../../services/api';
import { useToast } from '../ui/Toast';

const selectClass =
  'h-8 w-full rounded-lg border border-white/10 bg-white/[0.06] px-2 text-xs text-fg outline-none transition focus:border-accent/60 disabled:opacity-50';

const nextStatus = (status) => STATUS_ORDER[(STATUS_ORDER.indexOf(status) + 1) % STATUS_ORDER.length];

/** Shared quick-change logic: status select, status cycle and rating select. */
function useQuickChange(entry, onChanged, onOptimistic, onRevert) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const change = async (changes) => {
    setBusy(true);
    setError(null);
    onOptimistic?.(entry.id, changes); // the card updates (or leaves the filtered list) right away
    try {
      await updateLibraryEntry(entry.id, changes);
      onChanged();
    } catch (err) {
      onRevert?.(entry.id, changes);
      const message = toApiError(err)?.message ?? 'Update failed.';
      setError(message);
      toast(`${message} Your change was undone.`);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, change };
}

function Controls({ entry, busy, change, compact = false }) {
  const { media } = entry;
  return (
    <div className={compact ? 'flex w-full items-center gap-1.5' : 'space-y-1.5'}>
      <div className={`flex items-center gap-1.5 ${compact ? 'min-w-[9.5rem] flex-1' : ''}`}>
        <select
          aria-label={`Status for ${media.title}`}
          value={entry.status}
          disabled={busy}
          onChange={(e) => change({ status: e.target.value })}
          className={selectClass}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy}
          onClick={() => change({ status: nextStatus(entry.status) })}
          aria-label={`Move ${media.title} to ${STATUS_META[nextStatus(entry.status)].label}`}
          title={`Next: ${STATUS_META[nextStatus(entry.status)].label}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-fg-muted transition hover:border-white/25 hover:text-fg disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      </div>
      <select
        aria-label={`Rating for ${media.title}`}
        value={entry.rating ?? ''}
        disabled={busy}
        onChange={(e) => change({ rating: e.target.value === '' ? null : Number(e.target.value) })}
        className={`${selectClass} ${compact ? '!w-28 shrink-0' : ''}`}
      >
        <option value="">Not rated</option>
        {RATING_OPTIONS.map((r) => (
          <option key={r} value={r}>
            ★ {r.toFixed(1)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Grid card: poster with an illuminated progress line along its bottom edge. */
export default function LibraryCard({ entry, onChanged, onOptimistic, onRevert }) {
  const { media } = entry;
  const { busy, error, change } = useQuickChange(entry, onChanged, onOptimistic, onRevert);
  const prefetchHandlers = useMediaPrefetch(media);
  const theme = TYPE_THEME[media.mediaType];
  const hasEpisodes = media.mediaType !== 'MOVIE';
  const total = entry.totalEpisodes ?? 0;
  const detailsPath = media.provider && media.externalId ? mediaPath(media) : null;

  const poster = (
    <div className={`relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 shadow-card transition-[border-color,box-shadow] duration-300 ${theme.hover}`}>
      <PosterImage
        src={media.posterUrl}
        alt={`${media.title} poster`}
        className="h-full w-full"
        imgClassName="transition-transform duration-500 group-hover:scale-105"
        fallbackLabel="No poster"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
      <StatusBadge status={entry.status} className="absolute left-2 top-2" />
      {entry.rating !== null && <RatingPill value={entry.rating} title="Your rating" className="absolute right-2 top-2" />}
      {entry.isFavorite && (
        <span className="absolute bottom-3 right-2 rounded-full bg-black/55 p-1.5 backdrop-blur-md" title="Favorite">
          <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" aria-label="Favorite" />
        </span>
      )}
      {hasEpisodes && (
        <div className="absolute inset-x-0 bottom-0">
          <ProgressBar value={entry.watchedEpisodesCount} max={total} label={`${media.title} progress`} size="sm" tone={toneForType(media.mediaType)} className="rounded-none !bg-black/50" />
        </div>
      )}
    </div>
  );

  return (
    <article className="group" aria-label={media.title}>
      {detailsPath ? (
        <PosterLink to={detailsPath} {...prefetchHandlers}>
          {poster}
        </PosterLink>
      ) : (
        poster
      )}
      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-1 text-sm font-semibold text-fg">{media.title}</h3>
        <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-xs text-fg-subtle">
          <span className={`font-semibold ${theme.text}`}>{TYPE_LABELS[media.mediaType]}</span>
          {media.releaseYear ? <span>· {media.releaseYear}</span> : null}
        </p>
        {hasEpisodes && (
          <p className="mt-0.5 text-[11px] tabular-nums text-fg-muted">
            {total > 0 ? `${entry.watchedEpisodesCount} / ${total} eps · ${progressPercent(entry.watchedEpisodesCount, total)}%` : `${entry.watchedEpisodesCount} eps watched`}
          </p>
        )}
        <div className="mt-2.5">
          <Controls entry={entry} busy={busy} change={change} />
        </div>
        {error && (
          <p role="alert" className="mt-1 text-[11px] text-red-300">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}

/** Dense list row for the list view. */
export function LibraryRow({ entry, onChanged, onOptimistic, onRevert }) {
  const { media } = entry;
  const { busy, error, change } = useQuickChange(entry, onChanged, onOptimistic, onRevert);
  const prefetchHandlers = useMediaPrefetch(media);
  const theme = TYPE_THEME[media.mediaType];
  const hasEpisodes = media.mediaType !== 'MOVIE';
  const total = entry.totalEpisodes ?? 0;
  const detailsPath = media.provider && media.externalId ? mediaPath(media) : null;
  const status = STATUS_THEME[entry.status];

  const identity = (
    <div className="flex min-w-0 items-center gap-3">
      <PosterImage src={media.posterUrl} alt="" className={`h-16 w-11 shrink-0 rounded-lg border border-white/10 ring-1 ${theme.ring}`} fallbackLabel="" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-fg">{media.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
          <CategoryBadge type={media.mediaType} />
          {media.releaseYear && <span>{media.releaseYear}</span>}
          {entry.isFavorite && <Heart className="h-3 w-3 fill-red-500 text-red-500" aria-label="Favorite" />}
          {entry.rating !== null && (
            <span className="inline-flex items-center gap-1 font-bold text-fg">
              <Star className="h-3 w-3 fill-accent text-accent" aria-hidden="true" />
              {entry.rating.toFixed(1)}
            </span>
          )}
        </p>
      </div>
    </div>
  );

  return (
    <article className="glass-lite grid items-center gap-3 rounded-2xl p-3 transition hover:border-white/20 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1.6fr)]" aria-label={media.title}>
      {detailsPath ? (
        <Link to={detailsPath} {...prefetchHandlers} className="min-w-0 rounded-xl">
          {identity}
        </Link>
      ) : (
        identity
      )}
      <div>
        {hasEpisodes ? (
          <>
            <ProgressBar value={entry.watchedEpisodesCount} max={total} label={`${media.title} progress`} tone={toneForType(media.mediaType)} />
            <p className="mt-1 text-[11px] tabular-nums text-fg-muted">
              {total > 0 ? `${entry.watchedEpisodesCount} / ${total} eps · ${progressPercent(entry.watchedEpisodesCount, total)}%` : `${entry.watchedEpisodesCount} eps watched`}
            </p>
          </>
        ) : (
          <p className="text-xs text-fg-subtle">{entry.status === 'COMPLETED' ? 'Watched' : 'Movie'}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={`hidden h-2 w-2 shrink-0 rounded-full sm:block ${status.dot}`} aria-hidden="true" />
        <Controls entry={entry} busy={busy} change={change} compact />
      </div>
      {error && (
        <p role="alert" className="text-[11px] text-red-300 md:col-span-3">
          {error}
        </p>
      )}
    </article>
  );
}
