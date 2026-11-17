import React from 'react';
import Card from '../ui/Card';
import CountUp from '../ui/CountUp';
import { StaggerItem } from '../ui/motion';

/**
 * One headline number on a neutral card. Numbers count up when they appear.
 * `value` may be a number (animated) or text such as "—". `children` renders extra detail under it.
 */
export default function StatCard({ label, value, decimals = 0, icon: Icon, hint, children }) {
  return (
    <StaggerItem>
      <Card className="h-full transition duration-300 hover:border-white/20">
        <div className="flex items-start justify-between gap-3">
          <p className="min-h-[2rem] text-xs font-semibold uppercase leading-4 tracking-wider text-fg-subtle">{label}</p>
          {Icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-accent">
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
          )}
        </div>
        <p className="mt-2 text-4xl font-extrabold tabular-nums tracking-tight text-white">
          <CountUp value={value} decimals={decimals} />
        </p>
        {hint && <p className="mt-1 text-xs text-fg-muted">{hint}</p>}
        {children}
      </Card>
    </StaggerItem>
  );
}
