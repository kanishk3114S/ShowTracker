import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star } from 'lucide-react';
import PosterImage from '../media/PosterImage';
import { StatusBadge } from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import { STATUS_META, STATUS_ORDER, RATING_OPTIONS } from './libraryConstants';
import { TYPE_LABELS, mediaPath } from '../media/mediaUtils';
import { updateLibraryEntry, toApiError } from '../../services/api';

const selectClass =
  'h-8 w-full rounded-md border border-ink-edge bg-ink-raised px-1.5 text-xs text-fg outline-none transition focus:border-copper/70 disabled:opacity-50';

/** One tracked title in the library grid, with quick status / rating changes. */
export default function LibraryCard({ entry, onChanged }) {
  const { media } = entry;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const hasEpisodes = media.mediaType !== 'MOVIE';
  const total = entry.totalEpisodes ?? 0;
  const detailsPath = media.provider && media.externalId ? mediaPath(media) : null;

  const change = async (changes) => {
    setBusy(true);
    setError(null);
    try {
      await updateLibraryEntry(entry.id, changes);
      onChanged();
    } catch (err) {
      setError(toApiError(err)?.message ?? 'Update failed.');
    } finally {
      setBusy(false);
    }
  };

  const poster = (
    <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-ink-edge shadow-card transition duration-300 group-hover:-translate-y-1 group-hover:border-[#3b455e] group-hover:shadow-lift">
      <PosterImage
        src={media.posterUrl}
        alt={`${media.title} poster`}
        className="h-full w-full"
        imgClassName="transition-transform duration-500 group-hover:scale-[1.06]"
        fallbackLabel="No poster"
      />
      <StatusBadge status={entry.status} className="absolute left-2 top-2 !bg-ink-base/80 backdrop-blur" />
      {entry.rating !== null && (
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-ink-base/80 px-1.5 py-0.5 text-xs font-semibold text-amber backdrop-blur">
          <Star className="h-3 w-3 fill-amber" aria-hidden="true" />
          {entry.rating.toFixed(1)}
        </span>
      )}
      {entry.isFavorite && (
        <span className="absolute bottom-2 right-2 rounded-full bg-ink-base/80 p-1.5 backdrop-blur" title="Favorite">
          <Heart className="h-3.5 w-3.5 fill-[#ff7b7b] text-[#ff7b7b]" aria-label="Favorite" />
        </span>
      )}
    </div>
  );

  return (
    <article className="group" aria-label={media.title}>
      {detailsPath ? (
        <Link to={detailsPath} className="block rounded-xl">
          {poster}
        </Link>
      ) : (
        poster
      )}

      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-1 text-sm font-medium text-fg">{media.title}</h3>
        <p className="mt-0.5 text-xs text-fg-subtle">
          {TYPE_LABELS[media.mediaType]}
          {media.releaseYear ? ` · ${media.releaseYear}` : ''}
        </p>

        {hasEpisodes && (
          <div className="mt-2">
            <ProgressBar value={entry.watchedEpisodesCount} max={total} label={`${media.title} progress`} size="sm" />
            <p className="mt-1 text-[11px] tabular-nums text-fg-muted">
              {total > 0 ? `${entry.watchedEpisodesCount} / ${total} eps` : `${entry.watchedEpisodesCount} eps watched`}
            </p>
          </div>
        )}

        <div className="mt-2.5 grid grid-cols-1 gap-1.5">
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
          <select
            aria-label={`Rating for ${media.title}`}
            value={entry.rating ?? ''}
            disabled={busy}
            onChange={(e) => change({ rating: e.target.value === '' ? null : Number(e.target.value) })}
            className={selectClass}
          >
            <option value="">Not rated</option>
            {RATING_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r.toFixed(1)}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p role="alert" className="mt-1 text-[11px] text-[#ff9b9b]">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
