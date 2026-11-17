import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Lock, Star } from 'lucide-react';
import PosterImage from '../media/PosterImage';
import { StatusBadge } from '../ui/Badge';
import ProgressBar, { toneForType } from '../ui/ProgressBar';
import { TYPE_THEME } from '../ui/theme';
import { TYPE_LABELS, mediaPath } from '../media/mediaUtils';
import { useMediaPrefetch } from '../../hooks/usePrefetch';

/**
 * Read-only library card for profile pages. `entry.notes` only exists in the
 * payload for the profile's owner; when present it is shown with a lock marker.
 */
export default function PublicLibraryCard({ entry }) {
  const { media } = entry;
  const prefetchHandlers = useMediaPrefetch(media);
  const theme = TYPE_THEME[media.mediaType];
  const total = entry.totalEpisodes ?? 0;
  const hasEpisodes = media.mediaType !== 'MOVIE';
  const inner = (
    <>
      <div className={`relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 shadow-card transition duration-300 group-hover:-translate-y-2 ${theme.hover}`}>
        <PosterImage
          src={media.posterUrl}
          alt={`${media.title} poster`}
          className="h-full w-full"
          imgClassName="transition-transform duration-500 group-hover:scale-105"
          fallbackLabel="No poster"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
        <StatusBadge status={entry.status} className="absolute left-2 top-2" />
        {entry.rating !== null && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 text-xs font-bold text-fg backdrop-blur-md">
            <Star className="h-3 w-3 fill-accent text-accent" aria-hidden="true" />
            {entry.rating.toFixed(1)}
          </span>
        )}
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
      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-1 text-sm font-semibold text-fg">{media.title}</h3>
        <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-xs text-fg-subtle">
          <span className={`font-semibold ${theme.text}`}>{TYPE_LABELS[media.mediaType]}</span>
          {media.releaseYear ? <span>· {media.releaseYear}</span> : null}
        </p>
        {hasEpisodes && (
          <p className="mt-0.5 text-[11px] tabular-nums text-fg-muted">
            {total > 0 ? `${entry.watchedEpisodesCount} / ${total} eps` : `${entry.watchedEpisodesCount} eps watched`}
          </p>
        )}
        {entry.notes && (
          <p className="glass-lite mt-2 flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[11px] leading-snug text-fg-muted">
            <Lock className="mt-0.5 h-3 w-3 shrink-0 text-accent" aria-label="Private note, only you can see this" />
            <span className="line-clamp-3">{entry.notes}</span>
          </p>
        )}
      </div>
    </>
  );
  return media.provider && media.externalId ? (
    <Link to={mediaPath(media)} {...prefetchHandlers} className="group block rounded-2xl" aria-label={media.title}>
      {inner}
    </Link>
  ) : (
    <div className="group">{inner}</div>
  );
}
