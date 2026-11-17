import React from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import PosterImage from '../media/PosterImage';
import Badge from '../ui/Badge';
import ProgressBar, { progressPercent } from '../ui/ProgressBar';
import { Stagger, StaggerItem } from '../ui/motion';
import { TYPE_LABELS, mediaPath } from '../media/mediaUtils';

function ShelfCard({ entry }) {
  const { media } = entry;
  const total = entry.totalEpisodes ?? 0;
  const percent = progressPercent(entry.watchedEpisodesCount, total);
  const art = media.backdropUrl || media.posterUrl;
  const canOpen = media.provider && media.externalId;

  const body = (
    <>
      <div className="relative aspect-video overflow-hidden rounded-xl border border-ink-edge shadow-card transition duration-300 group-hover:-translate-y-0.5 group-hover:border-[#3b455e] group-hover:shadow-lift">
        <PosterImage
          src={art}
          alt=""
          className="h-full w-full"
          imgClassName={`transition-transform duration-500 group-hover:scale-105 ${media.backdropUrl ? '' : 'object-top'}`}
          fallbackLabel={media.title}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-base via-ink-base/30 to-transparent" />
        <Badge tone="neutral" className="absolute left-2.5 top-2.5 !bg-ink-base/75 backdrop-blur">
          {TYPE_LABELS[media.mediaType]}
        </Badge>
        <span className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-copper text-ink-base opacity-0 shadow-lg transition group-hover:opacity-100">
          <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
        </span>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="line-clamp-1 text-sm font-semibold text-fg">{media.title}</p>
        </div>
      </div>
      <div className="mt-2.5 px-0.5">
        <ProgressBar value={entry.watchedEpisodesCount} max={total} label={`${media.title} progress`} />
        <p className="mt-1.5 text-xs text-fg-muted tabular-nums">
          {total > 0
            ? `${entry.watchedEpisodesCount} / ${total} eps · ${percent}%`
            : `${entry.watchedEpisodesCount} eps watched`}
        </p>
      </div>
    </>
  );

  return canOpen ? (
    <Link to={mediaPath(media)} className="group block w-[17rem] shrink-0 snap-start rounded-xl sm:w-[19rem]" aria-label={`Continue ${media.title}`}>
      {body}
    </Link>
  ) : (
    <div className="group w-[17rem] shrink-0 snap-start sm:w-[19rem]">{body}</div>
  );
}

/** Horizontally scrolling shelf of titles with status WATCHING. */
export default function ContinueWatchingShelf({ items }) {
  return (
    <Stagger className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6" aria-label="Continue watching">
      {items.map((entry) => (
        <StaggerItem key={entry.id} className="shrink-0 snap-start">
          <ShelfCard entry={entry} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}
