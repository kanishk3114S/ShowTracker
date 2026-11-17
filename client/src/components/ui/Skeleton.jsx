import React from 'react';

/** Pulsing placeholder block. Pass sizing via className. */
export function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`skeleton rounded-md ${className}`} />;
}

/** Matches MediaCard / LibraryCard exactly (2:3 poster + two text lines). */
export function PosterSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="aspect-[2/3] w-full rounded-xl" />
      <Skeleton className="mt-2.5 h-3.5 w-4/5" />
      <Skeleton className="mt-1.5 h-3 w-1/3" />
    </div>
  );
}

export const POSTER_GRID = 'grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

export function PosterGridSkeleton({ count = 12, label = 'Loading titles' }) {
  return (
    <div role="status" aria-label={label} className={POSTER_GRID}>
      {Array.from({ length: count }, (_, i) => (
        <PosterSkeleton key={i} />
      ))}
    </div>
  );
}

export default Skeleton;
