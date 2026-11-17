import React from 'react';
import { Check } from 'lucide-react';
import { TYPE_THEME, STATUS_THEME } from './theme';

// Two tones only: neutral and the gold accent. Older tone names map onto them.
const NEUTRAL = 'bg-white/[0.06] text-fg-muted border-white/10';
const ACCENT = 'bg-accent/10 text-accent border-accent/25';
const TONES = {
  neutral: NEUTRAL,
  accent: ACCENT,
  copper: ACCENT,
  amber: ACCENT,
  green: NEUTRAL,
  blue: NEUTRAL,
  indigo: NEUTRAL,
  violet: NEUTRAL,
  red: 'bg-red-500/10 text-red-300 border-red-400/25'
};

/** Kept for existing call sites: label for every library status. */
export const STATUS_BADGES = Object.fromEntries(Object.entries(STATUS_THEME).map(([k, v]) => [k, { label: v.label }]));

export default function Badge({ tone = 'neutral', className = '', children, ...rest }) {
  return (
    <span
      {...rest}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold leading-4 ${TONES[tone] ?? NEUTRAL} ${className}`}
    >
      {children}
    </span>
  );
}

/** Media type label (Anime / Movie / TV Show) as a quiet neutral pill. */
export function CategoryBadge({ type, className = '' }) {
  const theme = TYPE_THEME[type];
  if (!theme) return null;
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase leading-4 tracking-wider backdrop-blur-sm ${theme.pill} ${className}`}
    >
      {theme.label}
    </span>
  );
}

/**
 * Library status: a neutral pill with one small colored dot. WATCHING and REWATCHING
 * pulse softly, COMPLETED shows a check.
 */
export function StatusBadge({ status, className = '' }) {
  const theme = STATUS_THEME[status];
  if (!theme) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold leading-4 backdrop-blur-sm ${theme.pill} ${className}`}
    >
      {theme.check ? (
        <Check className="h-3 w-3 text-sky-400" strokeWidth={3} aria-hidden="true" />
      ) : (
        <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
          {theme.live && <span className={`absolute inline-flex h-full w-full animate-ping-soft rounded-full ${theme.dot}`} />}
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${theme.dot}`} />
        </span>
      )}
      {theme.label}
    </span>
  );
}
