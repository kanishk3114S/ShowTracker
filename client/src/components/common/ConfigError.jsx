import React from 'react';
import { Settings2 } from 'lucide-react';

/** Shown instead of an empty app when a production build was made without its required VITE_* variables. */
export default function ConfigError({ problems }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16 text-fg">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-accent">
        <Settings2 className="h-7 w-7" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight">ShowTracker is not configured yet</h1>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        This build is missing settings it needs to reach the server. Set the following in your hosting dashboard
        (Environment), then <strong className="text-fg">rebuild and redeploy</strong>. These values are baked in at build time, so a
        restart is not enough.
      </p>
      <ul className="mt-5 space-y-3">
        {problems.map((p) => (
          <li key={p.name} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <code className="font-mono text-sm font-semibold text-accent">{p.name}</code>
            <span className="mt-1 block text-sm text-fg-muted">{p.hint}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
