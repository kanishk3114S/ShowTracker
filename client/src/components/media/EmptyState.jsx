import React from 'react';
import { SearchX } from 'lucide-react';
import GhostMark from '../cinema/GhostMark';

export default function EmptyState({ title = 'Nothing found', message, icon: Icon = SearchX, action, watermark }) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden glass-lite rounded-3xl border-dashed px-6 py-16 text-center">
      {watermark && <GhostMark text={watermark} position="center" />}
      <span className="relative mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
        <Icon className="h-5 w-5 text-fg-muted" aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {message && <p className="mt-1.5 max-w-md text-sm leading-relaxed text-fg-muted">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
