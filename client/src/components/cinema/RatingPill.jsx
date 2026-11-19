import React from 'react';
import { Star } from 'lucide-react';

export const ACCOLADE_THRESHOLD = 8.5;

function Laurel({ flip = false }) {
  return (
    <svg
      viewBox="0 0 12 20"
      aria-hidden="true"
      className={`h-3.5 w-2 shrink-0 text-accent/80 ${flip ? '-scale-x-100' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    >
      <path d="M9 18C4 16 1.5 11.5 2 3" />
      <path d="M3.2 14.5c-1.6-.4-2.4-1.5-2.6-2.8 1.6.1 2.5 1 2.6 2.8Z M2.3 10.2C.8 9.6.2 8.4.3 7.1c1.5.4 2.2 1.4 2 3.1Z M2.6 6.2C1.4 5.2 1.2 3.9 1.7 2.8c1.2.7 1.6 1.8.9 3.4Z" fill="currentColor" strokeWidth="0.6" />
    </svg>
  );
}

/**
 * Rating chip. At 8.5 or above it earns a "festival accolade": laurel branches, a gold rim and a
 * slowly twinkling star. Below that it is the usual quiet pill.
 *   tone="overlay" for chips on top of posters, "plain" for inline use on dark surfaces.
 */
export default function RatingPill({ value, title, suffix, className = '', tone = 'overlay' }) {
  if (value === null || value === undefined) return null;
  const accolade = value >= ACCOLADE_THRESHOLD;
  const base =
    tone === 'overlay'
      ? 'border-white/15 bg-black/55 backdrop-blur-md'
      : 'border-white/10 bg-white/[0.06]';
  return (
    <span
      title={accolade ? `${title ?? 'Rating'}: festival-worthy (${value.toFixed(1)})` : title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold text-fg ${
        accolade
          ? `border-accent/55 shadow-[0_0_16px_-5px_rgba(242,179,61,0.65)] backdrop-blur-md ${tone === 'overlay' ? 'bg-black/70' : 'bg-accent/10'}`
          : base
      } ${className}`}
    >
      {accolade && <Laurel />}
      <Star className={`h-3 w-3 fill-accent text-accent ${accolade ? 'animate-twinkle' : ''}`} aria-hidden="true" />
      <span className={accolade ? 'text-accent' : ''}>{value.toFixed(1)}</span>
      {suffix}
      {accolade && <Laurel flip />}
    </span>
  );
}
