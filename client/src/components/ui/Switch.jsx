import React from 'react';

/** Accessible on/off switch (role="switch"): gold when on, with a smooth sliding knob. */
export default function Switch({ checked, onChange, label, describedBy, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-300 disabled:opacity-50 ${
        checked ? 'border-accent bg-accent' : 'border-white/10 bg-white/[0.08]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full shadow-md transition-transform duration-300 ease-out ${
          checked ? 'translate-x-6 bg-ink-base' : 'translate-x-1 bg-fg-muted'
        }`}
      />
    </button>
  );
}
