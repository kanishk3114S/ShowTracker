import React from 'react';

const TONES = {
  neutral: 'bg-ink-raised text-fg-muted border-ink-edge',
  copper: 'bg-copper/10 text-copper border-copper/30',
  amber: 'bg-amber/10 text-amber border-amber/30',
  green: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  blue: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  indigo: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
  red: 'bg-vermilion/10 text-[#ff7b7b] border-vermilion/30',
  violet: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30'
};

/** Library status -> tone + label (single source of truth for status colors). */
export const STATUS_BADGES = {
  WATCHING: { label: 'Watching', tone: 'green' },
  PLAN_TO_WATCH: { label: 'Plan to Watch', tone: 'indigo' },
  COMPLETED: { label: 'Completed', tone: 'blue' },
  ON_HOLD: { label: 'On Hold', tone: 'amber' },
  DROPPED: { label: 'Dropped', tone: 'red' },
  REWATCHING: { label: 'Rewatching', tone: 'violet' }
};

export default function Badge({ tone = 'neutral', className = '', children, ...rest }) {
  return (
    <span
      {...rest}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold leading-4 ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, className = '' }) {
  const meta = STATUS_BADGES[status];
  if (!meta) return null;
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
}
