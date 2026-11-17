import React from 'react';
import { SearchX } from 'lucide-react';

export default function EmptyState({ title = 'Nothing found', message, icon: Icon = SearchX, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-edge bg-ink-surface/40 px-6 py-16 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-ink-edge bg-ink-raised">
        <Icon className="h-5 w-5 text-fg-muted" aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {message && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-fg-muted">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
