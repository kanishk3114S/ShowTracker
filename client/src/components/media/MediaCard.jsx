import React from 'react';
import PosterLink from '../ui/PosterLink';
import PosterImage from './PosterImage';
import { CategoryBadge } from '../ui/Badge';
import RatingPill from '../cinema/RatingPill';
import BroadcastPill from '../cinema/BroadcastPill';
import { TYPE_THEME } from '../ui/theme';
import { TYPE_LABELS, mediaPath } from './mediaUtils';
import { useMediaPrefetch } from '../../hooks/usePrefetch';

/** 2:3 poster card used by every grid. Lifts and glows in its category color on hover. */
export default function MediaCard({ media, priority = false }) {
  const prefetchHandlers = useMediaPrefetch(media);
  const theme = TYPE_THEME[media.mediaType];
  return (
    <PosterLink
      to={mediaPath(media)}
      {...prefetchHandlers}
      aria-label={`${media.title}, ${TYPE_LABELS[media.mediaType]}${media.releaseYear ? `, ${media.releaseYear}` : ''}`}
    >
      <div
        className={`relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 bg-ink-surface shadow-card transition-[border-color,box-shadow] duration-300 ease-out ${theme.hover}`}
      >
        <PosterImage
          src={media.posterUrl}
          alt={`${media.title} poster`}
          className="h-full w-full"
          imgClassName="transition-transform duration-500 ease-out group-hover:scale-105"
          fallbackLabel="No poster available"
          priority={priority}
        />
        {/* lower-third vignette keeps titles legible */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <CategoryBadge type={media.mediaType} className="absolute left-2 top-2" />
        <RatingPill value={media.sourceRating} title={`${media.sourceRatingName} rating`} className="absolute right-2 top-2" />
        <BroadcastPill media={media} className="absolute left-2 top-9" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 pb-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">{media.title}</p>
          {media.genres?.length > 0 && <p className="mt-1 line-clamp-1 text-[11px] text-white/70">{media.genres.slice(0, 3).join(' · ')}</p>}
        </div>
      </div>
      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-1 text-sm font-semibold text-fg">{media.title}</h3>
        <p className="mt-0.5 text-xs text-fg-subtle">{media.releaseYear ?? 'Release date unknown'}</p>
      </div>
    </PosterLink>
  );
}
