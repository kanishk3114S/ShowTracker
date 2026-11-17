import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, hasNextPage, onChange, disabled }) {
  if (page <= 1 && !hasNextPage) return null;
  const btn =
    'inline-flex items-center gap-1 rounded-lg border border-[#2A3245] bg-[#151922] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#2A3245] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#151922]';
  return (
    <nav className="mt-8 flex items-center justify-center gap-4" aria-label="Pagination">
      <button type="button" className={btn} disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" /> Previous
      </button>
      <span className="text-sm text-[#9CA3AF]">
        Page <span className="font-semibold text-white">{page}</span>
        {totalPages > 0 && ` of ${totalPages.toLocaleString()}`}
      </span>
      <button type="button" className={btn} disabled={disabled || !hasNextPage} onClick={() => onChange(page + 1)}>
        Next <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
