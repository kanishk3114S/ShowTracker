import React, { useId, useRef } from 'react';
import { motion } from 'motion/react';

/**
 * Tab list with a sliding active pill (shared-layout animation) and arrow-key navigation.
 * tabs: [{ value, label, count? }]. Give each Tabs on a page a distinct `name`.
 */
export default function Tabs({ tabs, value, onChange, ariaLabel, name, className = '' }) {
  const autoId = useId();
  const layoutId = `tab-pill-${name ?? autoId}`;
  const refs = useRef([]);

  const onKeyDown = (event, index) => {
    const dir = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    event.preventDefault();
    const next = (index + dir + tabs.length) % tabs.length;
    onChange(tabs[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl border border-ink-edge bg-ink-surface p-1 ${className}`}
    >
      {tabs.map((tab, i) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value || 'all'}
            ref={(el) => (refs.current[i] = el)}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`relative shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active ? 'text-fg' : 'text-fg-muted hover:text-fg'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-ink-raised ring-1 ring-ink-edge"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-xs tabular-nums ${active ? 'text-copper' : 'text-fg-subtle'}`}>{tab.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
