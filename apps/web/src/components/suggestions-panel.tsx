import { useMemo, useState } from 'react';
import { ColumnsDialog } from '@/components/columns-dialog';
import { Loading } from '@/components/loading';
import { SuggestionReviewModal } from '@/components/suggestion-review-modal';
import {
  DEFAULT_SUGGESTIONS_COLUMN_VISIBILITY,
  FORCED_VISIBLE_SUGGESTIONS_COLUMNS,
  sanitizeSuggestionsColumnOrder,
  sanitizeSuggestionsColumnVisibility,
  SUGGESTIONS_COLUMN_LABELS,
  SUGGESTIONS_COLUMN_ORDER,
  SUGGESTIONS_COLUMN_ORDER_STORAGE_KEY,
  SUGGESTIONS_COLUMN_STORAGE_KEY,
  type SuggestionsColumnVisibility,
} from '@/components/suggestions-columns';
import { SuggestionsFilterBar } from '@/components/suggestions-filter-bar';
import { SuggestionsTable, type SuggestionsSortState } from '@/components/suggestions-table';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';
import { useSuggestions } from '@/hooks/use-suggestions';
import { withDefaults } from '@/lib/column-settings';
import {
  DEFAULT_SUGGESTIONS_FILTERS,
  isDefaultSuggestionsFilters,
  matchesSuggestionsFilters,
  type SuggestionsFilters,
} from '@/lib/suggestions-filters';

// Filters, sort and columns all persist per browser in localStorage only (not the URL) - the
// whole list is filtered/sorted client-side, so there's nothing for a shared link to carry
// that the server needs.
const FILTERS_STORAGE_KEY = 'itl-suggestions-filters';

function sortStorageKey(slug: string): string {
  return `itl-suggestions-sort:${slug}`;
}

export function SuggestionsPanel({ eventSlug }: { eventSlug: string }) {
  const result = useSuggestions(eventSlug);
  const [storedFilters, setStoredFilters] = useLocalStorageState<SuggestionsFilters>(
    FILTERS_STORAGE_KEY,
    DEFAULT_SUGGESTIONS_FILTERS,
  );
  // Merged with the defaults so a filter object saved before a filter existed still works.
  const filters = useMemo(
    () => withDefaults(storedFilters, DEFAULT_SUGGESTIONS_FILTERS),
    [storedFilters],
  );
  // null = file order (position ascending) - the third click on any sorted header returns here.
  const [sort, setSort] = useLocalStorageState<SuggestionsSortState>(
    sortStorageKey(eventSlug),
    null,
  );
  const [columnVisibility, setColumnVisibility] = useLocalStorageState(
    SUGGESTIONS_COLUMN_STORAGE_KEY,
    DEFAULT_SUGGESTIONS_COLUMN_VISIBILITY,
  );
  const [columnOrder, setColumnOrder] = useLocalStorageState(
    SUGGESTIONS_COLUMN_ORDER_STORAGE_KEY,
    SUGGESTIONS_COLUMN_ORDER,
  );
  const sanitizedColumnOrder = useMemo(
    () => sanitizeSuggestionsColumnOrder(columnOrder),
    [columnOrder],
  );
  const sanitizedColumnVisibility = useMemo(
    () => sanitizeSuggestionsColumnVisibility(columnVisibility),
    [columnVisibility],
  );
  const [activeReviewPosition, setActiveReviewPosition] = useState<number | null>(null);

  const rows = useMemo(
    () =>
      result.status === 'loaded'
        ? result.suggestions.filter((row) => matchesSuggestionsFilters(row, filters))
        : [],
    [result, filters],
  );

  function handleFiltersChange(patch: Partial<SuggestionsFilters>) {
    setStoredFilters((prev) => ({ ...withDefaults(prev, DEFAULT_SUGGESTIONS_FILTERS), ...patch }));
  }

  function handleResetColumns() {
    setColumnVisibility(DEFAULT_SUGGESTIONS_COLUMN_VISIBILITY);
    setColumnOrder(SUGGESTIONS_COLUMN_ORDER);
  }

  // Hiding the column currently sorted by would leave the table sorted by something with no
  // visible header to explain or change it - fall back to file order.
  function handleColumnVisibilityChange(next: SuggestionsColumnVisibility) {
    setColumnVisibility(next);
    if (sort && !next[sort.column]) setSort(null);
  }

  if (result.status === 'loading') return <Loading message="Loading suggestions…" />;
  if (result.status === 'error') {
    return <p className="text-destructive text-sm">Couldn't load suggestions. Try refreshing.</p>;
  }
  if (result.suggestions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No suggestions yet. An event admin can import suggestions.json from the Import tab.
      </p>
    );
  }

  const total = result.suggestions.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SuggestionsFilterBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onReset={() => setStoredFilters(DEFAULT_SUGGESTIONS_FILTERS)}
        />
        <ColumnsDialog
          order={sanitizedColumnOrder}
          onOrderChange={setColumnOrder}
          visibility={sanitizedColumnVisibility}
          onVisibilityChange={handleColumnVisibilityChange}
          onReset={handleResetColumns}
          labels={SUGGESTIONS_COLUMN_LABELS}
          forcedVisible={FORCED_VISIBLE_SUGGESTIONS_COLUMNS}
          description="Drag to reorder, or check a column to show or hide it in the Suggestions table."
        />
      </div>

      <p className="text-muted-foreground text-sm">
        {isDefaultSuggestionsFilters(filters)
          ? `Showing ${total} suggestions`
          : `Showing ${rows.length} of ${total} suggestions`}
      </p>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No suggestions match these filters.</p>
      ) : (
        <SuggestionsTable
          rows={rows}
          columnOrder={sanitizedColumnOrder}
          columnVisibility={sanitizedColumnVisibility}
          eventSlug={eventSlug}
          onEditReview={setActiveReviewPosition}
          sort={sort}
          onSortChange={setSort}
        />
      )}

      {activeReviewPosition !== null && (
        <SuggestionReviewModal
          key={activeReviewPosition}
          eventSlug={eventSlug}
          position={activeReviewPosition}
          onClose={() => setActiveReviewPosition(null)}
          onSaved={result.refetch}
        />
      )}
    </div>
  );
}
