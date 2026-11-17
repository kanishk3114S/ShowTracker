import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '../ui/Button';

export default function Pagination({ page, totalPages, hasNextPage, onChange, disabled }) {
  if (page <= 1 && !hasNextPage) return null;
  return (
    <nav className="mt-10 flex items-center justify-center gap-4" aria-label="Pagination">
      <Button variant="secondary" size="sm" leftIcon={ChevronLeft} disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-fg-muted">
        Page <span className="font-semibold text-fg">{page}</span>
        {totalPages > 0 && ` of ${totalPages.toLocaleString()}`}
      </span>
      <Button variant="secondary" size="sm" rightIcon={ChevronRight} disabled={disabled || !hasNextPage} onClick={() => onChange(page + 1)}>
        Next
      </Button>
    </nav>
  );
}
