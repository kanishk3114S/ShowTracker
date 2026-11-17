import React from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import PosterImage from '../media/PosterImage';
import { StatusBadge } from '../ui/Badge';
import { Stagger, StaggerItem, POSTER_GRID } from '../ui';
import { TYPE_LABELS, mediaPath } from '../media/mediaUtils';

/** Read-only grid of the most recently touched library titles, each with its status badge. */
export default function RecentlyUpdatedGrid({ items }) {
  return (
    <Stagger className={POSTER_GRID} gap={0.03}>
      {items.map((entry) => {
        const { media } = entry;
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
            </div>
            <div className="mt-2.5 px-0.5">
              <h3 className="line-clamp-1 text-sm font-medium text-fg">{media.title}</h3>
              <p className="mt-0.5 text-xs text-fg-subtle">
                {TYPE_LABELS[media.mediaType]}
                {media.releaseYear ? ` · ${media.releaseYear}` : ''}
              </p>
            </div>
          </>
        );
        return (
          <StaggerItem key={entry.id}>
            {media.provider && media.externalId ? (
              <Link to={mediaPath(media)} className="group block rounded-xl" aria-label={`${media.title}, ${entry.status.replace(/_/g, ' ').toLowerCase()}`}>
                {inner}
              </Link>
            ) : (
              <div className="group">{inner}</div>
            )}
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
