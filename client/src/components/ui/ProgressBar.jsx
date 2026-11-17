import React from 'react';

/** Accessible progress bar: a solid gold fill that animates smoothly. `value` and `max` are raw counts. */
export default function ProgressBar({ value, max, label, size = 'md', className = '' }) {
  const percent = progressPercent(value, max);
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`overflow-hidden rounded-full bg-white/[0.09] ${size === 'sm' ? 'h-1' : 'h-1.5'} ${className}`}
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function progressPercent(value, max) {
  return max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
}

/** Kept so existing imports keep working; progress is one color now. */
export const toneForType = () => 'accent';
