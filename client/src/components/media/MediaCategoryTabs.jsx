import React from 'react';

export const CATEGORY_TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'ANIME', label: 'Anime' },
  { value: 'MOVIE', label: 'Movies' },
  { value: 'TV', label: 'TV Shows' }
];

export default function MediaCategoryTabs({ value, onChange, tabs = CATEGORY_TABS }) {
  return (
    <div role="tablist" aria-label="Media category" className="inline-flex rounded-xl border border-[#2A3245] bg-[#151922] p-1">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
              active ? 'bg-red-600 text-white shadow' : 'text-[#9CA3AF] hover:bg-[#1C2230] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
