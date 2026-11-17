import React from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import PosterImage from './PosterImage';
import Badge from '../ui/Badge';
import { TYPE_LABELS, mediaPath } from './mediaUtils';

const TYPE_TONES = { ANIME: 'indigo', MOVIE: 'copper', TV: 'green' };

/** 2:3 poster card used by every grid. Links to the details page. */
export default function MediaCard({ media }) {
  return (
    <Link
      to={mediaPath(media)}
      className="group block rounded-xl"
      aria-label={`${media.title}, ${TYPE_LABELS[media.mediaType]}${media.releaseYear ? `, ${media.releaseYear}` : ''}`}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-ink-edge shadow-card transition duration-300 group-hover:-translate-y-1 group-hover:border-[#3b455e] group-hover:shadow-lift">
        <PosterImage
          src={media.posterUrl}
          alt={`${media.title} poster`}
          className="h-full w-full"
          imgClassName="transition-transform duration-500 ease-out group-hover:scale-[1.06]"
          fallbackLabel="No poster available"
        />
        <Badge tone={TYPE_TONES[media.mediaType]} className="absolute left-2 top-2 !bg-ink-base/75 backdrop-blur">
          {TYPE_LABELS[media.mediaType]}
        </Badge>
        {media.sourceRating != null && (
          <span
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-ink-base/80 px-1.5 py-0.5 text-xs font-semibold text-amber backdrop-blur"
            title={`${media.sourceRatingName} rating`}
          >
            <Star className="h-3 w-3 fill-amber" aria-hidden="true" />
            {media.sourceRating.toFixed(1)}
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-3 pb-3 pt-14 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-fg">{media.title}</p>
          {media.genres?.length > 0 && (
            <p className="mt-1 line-clamp-1 text-[11px] text-fg-muted">{media.genres.slice(0, 3).join(' · ')}</p>
          )}
        </div>
      </div>
      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-1 text-sm font-medium text-fg">{media.title}</h3>
        <p className="mt-0.5 text-xs text-fg-subtle">{media.releaseYear ?? 'Release date unknown'}</p>
      </div>
    </Link>
  );
}
