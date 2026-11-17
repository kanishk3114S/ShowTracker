import React from 'react';

/**
 * Horizontally scrollable genre chips with multi-select.
 * `value` is an array of selected genre names; `onChange` receives the new array.
 */
export default function GenreFilter({ genres, value = [], onChange, hint }) {
  if (!genres?.length) return null;
  const selected = new Set(value.map((g) => g.toLowerCase()));
  const toggle = (genre) => {
    const key = genre.toLowerCase();
    onChange(selected.has(key) ? value.filter((g) => g.toLowerCase() !== key) : [...value, genre]);
  };
  return (
    <div>
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1.5 sm:flex-wrap" role="group" aria-label="Filter by genre">
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="shrink-0 rounded-full border border-copper/40 bg-copper/10 px-3 py-1 text-xs font-medium text-copper transition hover:bg-copper/20"
            >
              Clear ({value.length})
            </button>
          )}
          {genres.map((genre) => {
            const active = selected.has(genre.toLowerCase());
            return (
              <button
                key={genre}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(genre)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? 'border-copper bg-copper text-ink-base'
                    : 'border-ink-edge bg-ink-surface text-fg-muted hover:border-[#3b455e] hover:text-fg'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </div>
      {hint && <p className="mt-2 text-xs text-amber">{hint}</p>}
    </div>
  );
}
