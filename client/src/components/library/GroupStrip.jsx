import React from 'react';
import { motion } from 'motion/react';
import { Pencil, Plus } from 'lucide-react';
import { groupStyle } from './groupStyles';

const pillBase =
  'relative inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors';

/**
 * Custom groups as a strip of pills under the status tabs: "All titles", one pill per group
 * (with its count) and "+ New group". Selecting a pill filters the library to that group.
 */
export default function GroupStrip({ groups, loading, value, onChange, onCreate, onEdit, totalCount }) {
  const selected = groups?.find((g) => g.id === value) ?? null;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <div className="no-scrollbar -mx-4 flex flex-1 items-center gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0" role="group" aria-label="Custom groups">
          <Pill active={!value} onClick={() => onChange('')} layoutKey="all">
            All titles
            {totalCount !== undefined && totalCount !== null && <Count active={!value}>{totalCount}</Count>}
          </Pill>

          {loading && !groups && <span className="skeleton h-8 w-28 shrink-0 rounded-full" aria-hidden="true" />}

          {groups?.map((group) => {
            const style = groupStyle(group.color);
            const active = group.id === value;
            return (
              <Pill key={group.id} active={active} onClick={() => onChange(active ? '' : group.id)} layoutKey={group.id} activeClass={style.active} title={group.description || undefined}>
                <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
                <span className="max-w-[10rem] truncate">{group.name}</span>
                <Count active={active}>{group.itemCount}</Count>
              </Pill>
            );
          })}

          <motion.button
            type="button"
            onClick={onCreate}
            whileTap={{ scale: 0.96 }}
            className={`${pillBase} border-dashed border-white/20 text-fg-muted hover:border-accent/50 hover:text-accent`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> New group
          </motion.button>
        </div>

        {selected && (
          <button
            type="button"
            onClick={() => onEdit(selected)}
            aria-label={`Edit group ${selected.name}`}
            title="Edit group"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-fg-muted transition hover:border-white/25 hover:text-fg"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {selected?.description && <p className="mt-2 text-xs text-fg-subtle">{selected.description}</p>}
    </div>
  );
}

function Count({ active, children }) {
  return (
    <span className={`min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums ${active ? 'bg-white/15 text-fg' : 'bg-white/[0.07] text-fg-subtle'}`}>
      {children}
    </span>
  );
}

function Pill({ active, onClick, children, layoutKey, activeClass = 'border-white/25 bg-white/[0.1] text-fg', title }) {
  return (
    <motion.button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      className={`${pillBase} ${active ? activeClass : 'border-white/10 bg-white/[0.03] text-fg-muted hover:border-white/20 hover:text-fg'}`}
    >
      {active && (
        <motion.span
          layoutId="group-pill-glow"
          data-key={layoutKey}
          className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-white/20"
          transition={{ type: 'spring', stiffness: 450, damping: 35 }}
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </motion.button>
  );
}
