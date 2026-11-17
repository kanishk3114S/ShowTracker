import React from 'react';
import MediaCard from './MediaCard';
import ProviderErrorState from './ProviderErrorState';
import { GRID_CLASS } from './MediaSkeleton';
import { TYPE_PLURAL } from './mediaUtils';

/**
 * One result group from the API: { mediaType, provider, results, error, label? }.
 * A failed group shows its own error; other groups stay visible.
 */
export default function MediaGroupSection({ group, showHeading = true, limit, subtitle, onRetry }) {
  const items = limit ? group.results.slice(0, limit) : group.results;
  return (
    <section aria-label={TYPE_PLURAL[group.mediaType]}>
      {showHeading && (
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 className="text-lg font-semibold text-white">{TYPE_PLURAL[group.mediaType]}</h2>
          {(subtitle || group.label) && <p className="text-xs text-[#9CA3AF]">{subtitle || group.label}</p>}
        </div>
      )}
      {group.error ? (
        <ProviderErrorState error={group.error} onRetry={onRetry} compact />
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#2A3245] px-4 py-6 text-center text-sm text-[#9CA3AF]">
          No {TYPE_PLURAL[group.mediaType].toLowerCase()} matched.
        </p>
      ) : (
        <div className={GRID_CLASS}>
          {items.map((media) => (
            <MediaCard key={`${media.provider}:${media.mediaType}:${media.externalId}`} media={media} />
          ))}
        </div>
      )}
    </section>
  );
}
