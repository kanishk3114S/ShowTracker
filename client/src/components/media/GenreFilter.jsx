import React from 'react';

/** Genre chips. Clicking the active chip clears the filter. */
export default function GenreFilter({ genres, value, onChange, hint }) {
  if (!genres?.length) return null;
  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by genre">
        {genres.map((genre) => {
          const active = value?.toLowerCase() === genre.toLowerCase();
          return (
            <button
              key={genre}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active ? '' : genre)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? 'border-red-500 bg-red-600/20 text-red-200'
                  : 'border-[#2A3245] bg-[#151922] text-[#9CA3AF] hover:border-[#3B455E] hover:text-white'
              }`}
            >
              {genre}
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-2 text-xs text-amber-400/90">{hint}</p>}
    </div>
  );
}
