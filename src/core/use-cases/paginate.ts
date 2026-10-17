export interface Page<T> {
  items: T[];
  /** 1-based page actually returned (clamped into range). */
  page: number;
  pageCount: number;
  total: number;
  /** 1-based index of the first / last item on the page; 0 when empty. */
  from: number;
  to: number;
}

/** Slices `items` into 1-based pages of `size`. The page is clamped, so a stale page never yields an empty slice. */
export function paginate<T>(items: readonly T[], page: number, size: number): Page<T> {
  const safeSize = Math.max(1, Math.floor(size) || 1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / safeSize));
  const current = Math.min(pageCount, Math.max(1, Math.floor(page) || 1));
  const start = (current - 1) * safeSize;
  const slice = items.slice(start, start + safeSize);
  return {
    items: slice,
    page: current,
    pageCount,
    total,
    from: slice.length === 0 ? 0 : start + 1,
    to: start + slice.length,
  };
}

/**
 * Page numbers to render in a pager; `null` marks an ellipsis. Shows everything up to 7 pages,
 * otherwise the first, last and the current page with its neighbours.
 */
export function pageNumbers(page: number, pageCount: number): Array<number | null> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const wanted = new Set([1, pageCount, page - 1, page, page + 1].filter(n => n >= 1 && n <= pageCount));
  const sorted = [...wanted].sort((a, b) => a - b);
  const result: Array<number | null> = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) result.push(null);
    result.push(n);
  });
  return result;
}
