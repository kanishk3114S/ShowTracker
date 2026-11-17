import React from 'react';
import { Link } from 'react-router-dom';
import { Clapperboard } from 'lucide-react';

/** ShowTracker logo mark + wordmark. */
export default function Logo({ to = '/', withWordmark = true, className = '' }) {
  return (
    <Link to={to} aria-label="ShowTracker home" className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-copper text-ink-base shadow-sm shadow-black/40">
        <Clapperboard className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
      </span>
      {withWordmark && <span className="text-lg font-bold tracking-tight text-fg">ShowTracker</span>}
    </Link>
  );
}
