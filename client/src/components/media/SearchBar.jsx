import React from 'react';
import { Search, X } from 'lucide-react';

export default function SearchBar({ value, onChange, placeholder = 'Search titles…', autoFocus = false }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search titles"
        maxLength={100}
        autoFocus={autoFocus}
        className="h-12 w-full glass rounded-2xl pl-11 pr-11 text-[15px] text-fg placeholder-fg-subtle outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-fg-subtle transition hover:bg-ink-raised hover:text-fg"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
