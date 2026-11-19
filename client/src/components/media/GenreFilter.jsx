import React from 'react';
import { motion } from 'motion/react';
import { genreStyle } from './genreStyles';

const HOVER = { y: -2, scale: 1.04 };
const TAP = { scale: 0.95 };
const SPRING = { type: 'spring', stiffness: 500, damping: 28 };

/**
 * Horizontally scrollable genre chips with multi-select, each in its genre's colour.
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
      {/* vertical padding gives the lift and the glow room inside the scroll container */}
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 py-1.5 sm:mx-0 sm:px-0">
        <div className="flex gap-2 sm:flex-wrap" role="group" aria-label="Filter by genre">
          {value.length > 0 && (
            <motion.button
              type="button"
              onClick={() => onChange([])}
              whileHover={HOVER}
              whileTap={TAP}
              transition={SPRING}
              className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/15"
            >
              Clear ({value.length})
            </motion.button>
          )}
          {genres.map((genre) => {
            const active = selected.has(genre.toLowerCase());
            const style = genreStyle(genre);
            return (
              <motion.button
                key={genre}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(genre)}
                whileHover={HOVER}
                whileTap={TAP}
                transition={SPRING}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-[border-color,box-shadow,color] duration-200 ${
                  active ? style.active : style.base
                }`}
              >
                {genre}
              </motion.button>
            );
          })}
        </div>
      </div>
      {hint && <p className="mt-2 text-xs text-amber">{hint}</p>}
    </div>
  );
}
