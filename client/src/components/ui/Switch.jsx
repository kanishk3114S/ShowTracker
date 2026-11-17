import React from 'react';

/** Accessible on/off switch (role="switch"). */
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
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 ${
        checked ? 'border-copper bg-copper' : 'border-ink-edge bg-ink-raised'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
          checked ? 'translate-x-6 bg-ink-base' : 'translate-x-1 bg-fg-muted'
        }`}
      />
    </button>
  );
}
