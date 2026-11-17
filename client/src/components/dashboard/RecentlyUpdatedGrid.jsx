import React from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import PosterImage from '../media/PosterImage';
import { StatusBadge } from '../ui/Badge';
import { Stagger, StaggerItem } from '../ui/motion';
import { TYPE_THEME } from '../ui/theme';
import { TYPE_LABELS, mediaPath } from '../media/mediaUtils';
import { useMediaPrefetch } from '../../hooks/usePrefetch';

function RecentCard({ entry }) {
  const { media } = entry;
  const prefetchHandlers = useMediaPrefetch(media);
  const theme = TYPE_THEME[media.mediaType];
  const inner = (
    <>
      <div className={`relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 shadow-card transition duration-300 group-hover:-translate-y-1.5 ${theme.hover}`}>
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
      </div>
      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-1 text-sm font-semibold text-fg">{media.title}</h3>
        <p className="mt-0.5 text-xs text-fg-subtle">
          <span className={`font-semibold ${theme.text}`}>{TYPE_LABELS[media.mediaType]}</span>
          {media.releaseYear ? ` · ${media.releaseYear}` : ''}
        </p>
      </div>
    </>
  );
  return media.provider && media.externalId ? (
    <Link
      to={mediaPath(media)}
      {...prefetchHandlers}
      className="group block w-36 shrink-0 snap-start rounded-2xl sm:w-40"
      aria-label={`${media.title}, ${entry.status.replace(/_/g, ' ').toLowerCase()}`}
    >
      {inner}
    </Link>
  ) : (
    <div className="group w-36 shrink-0 snap-start sm:w-40">{inner}</div>
  );
}

/** Horizontal carousel of the most recently touched library titles, each with a colorful status pill. */
export default function RecentlyUpdatedGrid({ items }) {
  return (
    <Stagger className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6" gap={0.04}>
      {items.map((entry) => (
        <StaggerItem key={entry.id} className="shrink-0">
          <RecentCard entry={entry} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}
