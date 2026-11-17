import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Lock, Star } from 'lucide-react';
import PosterImage from '../media/PosterImage';
import { StatusBadge } from '../ui/Badge';
import ProgressBar from '../ui/ProgressBar';
import { TYPE_LABELS, mediaPath } from '../media/mediaUtils';

/**
 * Read-only library card for profile pages. `entry.notes` only exists in the
 * payload for the profile's owner; when present it is shown with a lock marker.
 */
export default function PublicLibraryCard({ entry }) {
  const { media } = entry;
  const total = entry.totalEpisodes ?? 0;
  const hasEpisodes = media.mediaType !== 'MOVIE';
  const inner = (
    <>
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
        {entry.notes && (
          <p className="mt-2 flex items-start gap-1.5 rounded-md border border-ink-edge bg-ink-surface px-2 py-1.5 text-[11px] leading-snug text-fg-muted">
            <Lock className="mt-0.5 h-3 w-3 shrink-0 text-copper" aria-label="Private note, only you can see this" />
            <span className="line-clamp-3">{entry.notes}</span>
          </p>
        )}
      </div>
    </>
  );
  return media.provider && media.externalId ? (
    <Link to={mediaPath(media)} className="group block rounded-xl" aria-label={media.title}>
      {inner}
    </Link>
  ) : (
    <div className="group">{inner}</div>
  );
}
