import React from 'react';

/** Accessible progress bar. `value` and `max` are raw counts; the percentage is derived here. */
export default function ProgressBar({ value, max, label, size = 'md', className = '' }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`overflow-hidden rounded-full bg-ink-raised ${size === 'sm' ? 'h-1' : 'h-1.5'} ${className}`}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-copper to-amber transition-[width] duration-500 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export const progressPercent = (value, max) => (max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0);
