import React from 'react';
import PosterGrid from './PosterGrid';
import ProviderErrorState from './ProviderErrorState';
import { TYPE_PLURAL } from './mediaUtils';
import GhostMark from '../cinema/GhostMark';

const GHOST = { ANIME: '『物語』', MOVIE: 'FEATURE FILM', TV: 'SCENE 01 · 24FPS' };

/**
 * One result group from the API: { mediaType, provider, results, error, label? }.
 * A failed group shows its own error while other groups stay visible.
 */
export default function MediaGroupSection({ group, showHeading = true, limit, subtitle, onRetry }) {
  const items = limit ? group.results.slice(0, limit) : group.results;
  return (
    <section aria-label={TYPE_PLURAL[group.mediaType]}>
      {showHeading && (
        <div className="relative mb-5 flex flex-wrap items-baseline justify-between gap-x-3 overflow-hidden border-b border-white/[0.08] pb-3">
          {GHOST[group.mediaType] && <GhostMark text={GHOST[group.mediaType]} position="right" className="!top-0 !translate-y-0 !text-4xl sm:!text-5xl" />}
          <h2 className="relative flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-white">
            <span className="h-5 w-1 rounded-full bg-accent" aria-hidden="true" />
            {TYPE_PLURAL[group.mediaType]}
          </h2>
          {(subtitle || group.label) && <p className="text-xs text-fg-subtle">{subtitle || group.label}</p>}
        </div>
      )}
      {group.error ? (
        <ProviderErrorState error={group.error} onRetry={onRetry} compact />
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-edge px-4 py-6 text-center text-sm text-fg-muted">
          No {TYPE_PLURAL[group.mediaType].toLowerCase()} matched.
        </p>
      ) : (
        <PosterGrid items={items} />
      )}
    </section>
  );
}
