import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Flame } from 'lucide-react';
import PosterImage from './PosterImage';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import RatingPill from '../cinema/RatingPill';
import BroadcastPill from '../cinema/BroadcastPill';
import GhostMark from '../cinema/GhostMark';
import { ghostFor } from './MediaHero';
import { TYPE_LABELS, mediaPath } from './mediaUtils';

/** Editorial banner highlighting the #1 title of the current trending list. */
export default function FeaturedHero({ media, label }) {
  if (!media) return null;
  const art = media.backdropUrl || media.posterUrl;
  return (
    <section aria-label="Number one trending title" className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-surface shadow-glass">
      <PosterImage
        src={art}
        alt=""
        className="absolute inset-0 h-full w-full"
        imgClassName={media.backdropUrl ? 'opacity-70' : 'object-top opacity-40 blur-sm scale-110'}
        fallbackLabel=""
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-base via-ink-base/70 to-ink-base/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-base/90 via-ink-base/40 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(9,9,11,0.7)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.12),transparent_70%)]" />
      <GhostMark text={ghostFor(media)} position="right" className="!right-8 !top-1/3" />
      {/* 35mm film edge */}
      <div className="sprockets absolute inset-x-0 top-3" aria-hidden="true" />
      <div className="sprockets absolute inset-x-0 bottom-3" aria-hidden="true" />
      <div className="relative flex min-h-[18rem] flex-col justify-end gap-3 p-6 pb-9 sm:min-h-[22rem] sm:p-10 sm:pb-12">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="copper">
            <Flame className="h-3 w-3" aria-hidden="true" /> #1 {label ? `· ${label}` : 'trending'}
          </Badge>
          <Badge tone="neutral" className="!bg-ink-base/70">
            {TYPE_LABELS[media.mediaType]}
          </Badge>
          <RatingPill value={media.sourceRating} title={`${media.sourceRatingName} rating`} />
          <BroadcastPill media={media} />
        </div>
        <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight text-fg sm:text-5xl">{media.title}</h2>
        {media.overview && <p className="line-clamp-2 max-w-2xl text-sm leading-relaxed text-fg-muted sm:text-base">{media.overview}</p>}
        <div>
          <Button as={Link} to={mediaPath(media)} variant="primary" rightIcon={ArrowRight}>
            View details
          </Button>
        </div>
      </div>
    </section>
  );
}
