import React from 'react';

export const GRID_CLASS =
  'grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';

export function PosterSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="aspect-[2/3] rounded-xl border border-[#2A3245] bg-[#151922]" />
      <div className="mt-2 h-3.5 w-4/5 rounded bg-[#1C2230]" />
      <div className="mt-1.5 h-3 w-1/3 rounded bg-[#1C2230]" />
    </div>
  );
}

export default function MediaSkeleton({ count = 12 }) {
  return (
    <div role="status" aria-label="Loading titles" className={GRID_CLASS}>
      {Array.from({ length: count }, (_, i) => (
        <PosterSkeleton key={i} />
      ))}
    </div>
  );
}
