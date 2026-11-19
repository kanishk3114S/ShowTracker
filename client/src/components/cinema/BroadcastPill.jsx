import React from 'react';

/** True while a title is still releasing (AniList: RELEASING, TMDB: Returning Series). */
export const isAiring = (media) => media?.status === 'RELEASING' || media?.status === 'Returning Series';

/**
 * Tiny monospace broadcast status, like a TV station bug.
 *   airing           -> "AIRING" (+ episode count when the provider knows it) with a pulsing radar dot
 *   hero, TV/anime   -> "REC · 24 FPS" with a calm amber dot (decorative camera readout)
 *   movies / cards   -> nothing
 * Never invents data: the episode count appears only when the provider supplies it.
 */
export default function BroadcastPill({ media, variant = 'card', className = '' }) {
  const airing = isAiring(media);
  const decorative = variant === 'hero' && !airing && (media?.mediaType === 'TV' || media?.mediaType === 'ANIME');
  if (!airing && !decorative) return null;

  const label = airing ? `AIRING${media.totalEpisodes ? ` · ${media.totalEpisodes} EPS` : ''}` : 'REC · 24 FPS';
  const dot = airing ? 'bg-emerald-400' : 'bg-amber-400';
  return (
    <span
      title={airing ? 'Currently airing' : undefined}
      className={`inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-black/55 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase leading-4 tracking-wider text-fg backdrop-blur-md ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        {airing && <span className={`absolute inline-flex h-full w-full animate-ping-soft rounded-full ${dot}`} />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dot}`} />
      </span>
      {label}
    </span>
  );
}
