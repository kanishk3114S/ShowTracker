import React from 'react';
import { Clapperboard, Loader2 } from 'lucide-react';

/** Centered brand loader used while authentication state resolves. */
export default function FullScreenLoader({ message = 'Loading…' }) {
  return (
    <div role="status" className="flex min-h-screen flex-col items-center justify-center gap-5 bg-ink-base text-fg">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-copper text-ink-base shadow-lg shadow-black/40">
        <Clapperboard className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        <Loader2 className="h-4 w-4 animate-spin text-copper" aria-hidden="true" />
        {message}
      </p>
    </div>
  );
}
