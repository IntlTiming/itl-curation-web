import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { SORTABLE_COLUMNS, type SortColumn, type SortState } from '@/components/reviews-table';

function storageKey(slug: string): string {
  return `itl-reviews-sort:${slug}`;
}

// First-visit default (and what a cleared/never-set localStorage value falls back to) - most
// recently active submissions surface first, rather than the table's unsorted multi-key
// server order (playstyle -> meter -> difficulty -> title). Exported so reviews-panel.tsx can
// fall back to it when the user hides the column currently being sorted by.
export const DEFAULT_SORT = {
  column: 'lastActivity',
  direction: 'desc',
} as const satisfies SortState;

function isSortColumn(value: string): value is SortColumn {
  return SORTABLE_COLUMNS.has(value as SortColumn);
}

// Exported so event-detail.tsx can strip these atomically, in the SAME setSearchParams call
// that changes `tab`, when navigating away from Reviews. A separate effect-cleanup-on-unmount
// approach was tried and reverted: it closes over a setSearchParams captured at mount (never
// refreshed, since the effect has [] deps), so by the time ReviewsPanel actually unmounts -
// simultaneously with the tab param changing - that stale closure overwrites the URL using a
// pre-tab-switch snapshot and wipes out the tab change itself. Doing it in the same update as
// the tab change avoids the race entirely.
export const SORT_PARAM_KEYS = ['sortColumn', 'sortDirection'] as const;

function parseFromParams(params: URLSearchParams): SortState {
  const column = params.get('sortColumn');
  if (column === null || !isSortColumn(column)) return null;
  return { column, direction: params.get('sortDirection') === 'desc' ? 'desc' : 'asc' };
}

function readFromLocalStorage(slug: string): SortState {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { column?: string; direction?: string } | null;
    if (!parsed?.column || !isSortColumn(parsed.column)) return null;
    return { column: parsed.column, direction: parsed.direction === 'desc' ? 'desc' : 'asc' };
  } catch {
    return null;
  }
}

function writeToParams(sort: SortState, params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  if (sort) {
    next.set('sortColumn', sort.column);
    next.set('sortDirection', sort.direction);
  } else {
    next.delete('sortColumn');
    next.delete('sortDirection');
  }
  return next;
}

// Owns Reviews table sort state, synced both to the URL (shareable) and localStorage (sticky
// per-user default) - same rules as useReviewsFilters, kept as its own hook (rather than folded
// into ReviewsFilters) since sort order isn't a filter and ReviewsFilterBar shouldn't have to
// know about it.
export function useReviewsSort(slug: string) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [sort, setSortState] = useState<SortState>(() => {
    if (searchParams.has('sortColumn')) return parseFromParams(searchParams);
    return readFromLocalStorage(slug) ?? DEFAULT_SORT;
  });

  // Mirrors whatever the initial state turned out to be into the URL once, so the current
  // sort order is linkable immediately - see useReviewsFilters' identical effect for why this
  // is a mount-only, URL-only sync. (Cleanup on leaving Reviews lives in event-detail.tsx's tab
  // switcher instead of here - see the SORT_PARAM_KEYS comment above for why.)
  useEffect(() => {
    setSearchParams(
      (params) => {
        const next = writeToParams(sort, params);
        return next.toString() === params.toString() ? params : next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSort = useCallback(
    (next: SortState) => {
      setSortState(next);
      try {
        if (next) localStorage.setItem(storageKey(slug), JSON.stringify(next));
        else localStorage.removeItem(storageKey(slug));
      } catch {
        // localStorage unavailable - sort still works for this session, just won't stick.
      }
      setSearchParams((params) => writeToParams(next, params), { replace: true });
    },
    [slug, setSearchParams],
  );

  return { sort, setSort };
}
