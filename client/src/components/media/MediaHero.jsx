import React from 'react';
import PosterImage from './PosterImage';

/**
 * Full-bleed cinematic backdrop that fades into the page background.
 * Uses the title's real backdrop; if there is none, a blurred poster; never invented artwork.
 */
export function HeroBackdrop({ media }) {
  const src = media.backdropUrl || media.posterUrl;
  return (
    <div className="relative h-72 overflow-hidden bg-ink-surface sm:h-96" aria-hidden="true">
      {src && (
        <PosterImage
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full"
          imgClassName={media.backdropUrl ? 'opacity-60' : 'scale-125 object-top opacity-30 blur-2xl'}
          fallbackLabel=""
          priority
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-base via-ink-base/70 to-ink-base/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink-base/70 via-transparent to-ink-base/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(9,9,11,0.85)_100%)]" />
    </div>
  );
}

/** Elevated poster card shown beside the title. */
export function HeroPoster({ media }) {
  return (
    <div className="w-40 shrink-0 sm:w-60">
      <PosterImage
        src={media.posterUrl}
        alt={`${media.title} poster`}
        className="aspect-[2/3] rounded-xl border border-ink-edge shadow-lift"
        fallbackLabel="No poster available"
        priority
      />
    </div>
  );
}
