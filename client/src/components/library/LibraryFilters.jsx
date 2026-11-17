import React from 'react';
import Tabs from '../ui/Tabs';
import { STATUS_META } from './libraryConstants';

export const SORTS = {
  recent: { label: 'Recently updated', sort: 'updated_at', order: 'desc' },
  title: { label: 'Title (A-Z)', sort: 'title', order: 'asc' },
  rating: { label: 'My rating', sort: 'rating', order: 'desc' },
  release: { label: 'Release date', sort: 'release_date', order: 'desc' }
};

const STATUS_VALUES = ['WATCHING', 'COMPLETED', 'PLAN_TO_WATCH', 'ON_HOLD', 'DROPPED', 'REWATCHING'];
const TYPE_TABS = [
  { value: '', label: 'All' },
  { value: 'ANIME', label: 'Anime' },
  { value: 'TV', label: 'TV Shows' },
  { value: 'MOVIE', label: 'Movies' }
];

/**
 * Status tabs (with live counts), media type tabs and sort dropdown.
 * `counts` is { total, byStatus } from the stats endpoint (counts ignore the type filter).
 */
export default function LibraryFilters({ status, mediaType, sortKey, counts, onChange, idPrefix = 'lib' }) {
  const statusTabs = [
    { value: '', label: 'All', count: counts?.total },
    ...STATUS_VALUES.map((s) => ({ value: s, label: STATUS_META[s].label, count: counts?.byStatus?.[s] }))
  ];
  return (
    <div className="space-y-3">
      <Tabs name={`${idPrefix}-status`} ariaLabel="Filter by status" tabs={statusTabs} value={status} onChange={(v) => onChange({ status: v })} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs name={`${idPrefix}-type`} ariaLabel="Filter by type" tabs={TYPE_TABS} value={mediaType} onChange={(v) => onChange({ type: v })} />
        <label className="flex items-center gap-2 text-xs text-fg-muted">
          Sort by
          <select
            value={sortKey}
            onChange={(e) => onChange({ sort: e.target.value === 'recent' ? '' : e.target.value })}
            className="h-9 rounded-lg border border-ink-edge bg-ink-surface px-2.5 text-sm text-fg outline-none focus:border-copper/70"
          >
            {Object.entries(SORTS).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
