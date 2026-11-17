import React from 'react';
import Card from '../ui/Card';
import { StaggerItem } from '../ui/motion';

/** One headline number. `children` renders extra detail under the value (e.g. type pills). */
export default function StatCard({ label, value, icon: Icon, hint, children }) {
  return (
    <StaggerItem>
      <Card className="h-full">
        <div className="flex items-start justify-between gap-3">
          <p className="min-h-[2rem] text-xs font-medium uppercase leading-4 tracking-wider text-fg-subtle">{label}</p>
          {Icon && <Icon className="h-4 w-4 text-copper" aria-hidden="true" />}
        </div>
        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-fg">{value}</p>
        {hint && <p className="mt-1 text-xs text-fg-muted">{hint}</p>}
        {children}
      </Card>
    </StaggerItem>
  );
}
