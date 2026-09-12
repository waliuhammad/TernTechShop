import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

/**
 * Builds a compact page list with ellipses, e.g. 1 … 4 [5] 6 … 12.
 * Always renders the first and last page so the range is legible.
 */
function buildRange(page: number, totalPages: number): Array<number | 'gap'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, page]);
  if (page - 1 > 1) pages.add(page - 1);
  if (page + 1 < totalPages) pages.add(page + 1);

  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | 'gap'> = [];

  sorted.forEach((value, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined && value - previous > 1) result.push('gap');
    result.push(value);
  });

  return result;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const range = buildRange(page, totalPages);

  return (
    <nav aria-label="Registry pages" className="mt-16 flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft size={18} />
      </button>

      {range.map((entry, index) =>
        entry === 'gap' ? (
          <span
            key={`gap-${index}`}
            className="px-1 font-mono text-xs text-slate-400"
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onChange(entry)}
            aria-current={entry === page ? 'page' : undefined}
            className={cn(
              'h-11 min-w-11 cursor-pointer rounded-xl border px-3 text-sm font-black transition-all',
              entry === page
                ? 'border-primary bg-primary text-white shadow-lg'
                : 'border-slate-200 bg-white text-slate-600 hover:border-primary hover:text-primary',
            )}
          >
            {entry}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
