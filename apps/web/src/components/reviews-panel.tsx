import { Dices } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Loading } from '@/components/loading';
import { ReviewModal } from '@/components/review-modal';
import { ColumnsDialog } from '@/components/columns-dialog';
import {
  DEFAULT_REVIEWS_COLUMN_VISIBILITY,
  FORCED_VISIBLE_REVIEWS_COLUMNS,
  REVIEWS_COLUMN_LABELS,
  REVIEWS_COLUMN_ORDER,
  REVIEWS_COLUMN_ORDER_STORAGE_KEY,
  REVIEWS_COLUMN_STORAGE_KEY,
  sanitizeColumnOrder,
  sanitizeColumnVisibility,
  type ReviewsColumnVisibility,
} from '@/components/reviews-columns';
import { ReviewsFilterBar } from '@/components/reviews-filter-bar';
import { ReviewsTable } from '@/components/reviews-table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';
import { useReviews, type ReviewsRow } from '@/hooks/use-reviews';
import { useReviewsFilters, type ReviewsFilters } from '@/hooks/use-reviews-filters';
import { DEFAULT_SORT, useReviewsSort } from '@/hooks/use-reviews-sort';
import { useScrollRestoration } from '@/hooks/use-scroll-restoration';

// "Showing x of y singles/doubles submissions" when any filter besides Playstyle narrows the
// result; simplified to "Showing y singles/doubles submissions" when nothing else does, since
// x and y are otherwise the same number and saying so twice adds nothing.
function summaryText(filters: ReviewsFilters, visibleCount: number, totalCount: number): string {
  const playstyleLabel = filters.playstyle === 'SINGLE' ? 'Singles' : 'Doubles';
  const isUnfiltered =
    filters.search === '' &&
    filters.minMeter === null &&
    filters.maxMeter === null &&
    !filters.unreviewedOnly &&
    !filters.unreviewedByMeOnly &&
    !filters.publiclyReviewableOnly &&
    filters.techTags.length === 0 &&
    filters.focus.length === 0;
  return isUnfiltered
    ? `Showing ${totalCount} ${playstyleLabel} submissions`
    : `Showing ${visibleCount} of ${totalCount} ${playstyleLabel} submissions`;
}

// Picks uniformly from the rows currently on screen (every active filter already applied
// server-side, and the list isn't paginated) that the current user hasn't reviewed - by the
// same per-submission hasOwnReview as the row's Add/Edit icon. Disabled while loading or on an
// empty list; the tooltip only explains the "all reviewed" case, since an empty list already
// says "No submissions match these filters." below.
function RandomUnreviewedButton({
  eventSlug,
  rows,
}: {
  eventSlug: string;
  rows: ReviewsRow[] | null;
}) {
  const navigate = useNavigate();
  const unreviewed = useMemo(() => rows?.filter((row) => !row.hasOwnReview) ?? [], [rows]);
  const allReviewed = rows !== null && rows.length > 0 && unreviewed.length === 0;

  function handleClick() {
    const pick = unreviewed[Math.floor(Math.random() * unreviewed.length)];
    if (!pick) return;
    navigate(
      `/events/${encodeURIComponent(eventSlug)}/submissions/${encodeURIComponent(pick.fileId)}`,
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-block">
          <Button variant="outline" disabled={unreviewed.length === 0} onClick={handleClick}>
            <Dices />
            Random!!
          </Button>
        </span>
      </TooltipTrigger>
      {allReviewed && <TooltipContent>You have reviewed all charts in this list.</TooltipContent>}
    </Tooltip>
  );
}

export function ReviewsPanel({ eventSlug }: { eventSlug: string }) {
  const { filters, setFilters, resetFilters } = useReviewsFilters(eventSlug);
  const { sort, setSort } = useReviewsSort(eventSlug);
  const result = useReviews(eventSlug, filters);
  useScrollRestoration(`reviews:${eventSlug}`, result.status === 'loaded');
  const [activeReviewFileId, setActiveReviewFileId] = useState<string | null>(null);
  const [columnVisibility, setColumnVisibility] = useLocalStorageState(
    REVIEWS_COLUMN_STORAGE_KEY,
    DEFAULT_REVIEWS_COLUMN_VISIBILITY,
  );
  const [columnOrder, setColumnOrder] = useLocalStorageState(
    REVIEWS_COLUMN_ORDER_STORAGE_KEY,
    REVIEWS_COLUMN_ORDER,
  );
  // Reconciled against the current canonical column set on every read, so a stale stored
  // order (from before a column was added/renamed) can never hide a column from the table.
  const sanitizedColumnOrder = useMemo(() => sanitizeColumnOrder(columnOrder), [columnOrder]);
  // Same idea for visibility: fills in the default for any column added since this browser
  // last saved a visibility object (see sanitizeColumnVisibility's own comment).
  const sanitizedColumnVisibility = useMemo(
    () => sanitizeColumnVisibility(columnVisibility),
    [columnVisibility],
  );

  function handleResetColumns() {
    setColumnVisibility(DEFAULT_REVIEWS_COLUMN_VISIBILITY);
    setColumnOrder(REVIEWS_COLUMN_ORDER);
  }

  // Hiding the column currently being sorted by would otherwise leave the table sorted by a
  // field with no visible header/arrow to explain or change it - fall back to the default sort
  // (if its own column is still visible) or the table's plain server order otherwise.
  function handleColumnVisibilityChange(next: ReviewsColumnVisibility) {
    setColumnVisibility(next);
    if (sort && !next[sort.column]) {
      setSort(next[DEFAULT_SORT.column] ? DEFAULT_SORT : null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ReviewsFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          onReset={resetFilters}
          meterBounds={result.status === 'loaded' ? result.meterBounds : null}
          sort={sort}
          onSortChange={setSort}
          focusOptions={result.status === 'loaded' ? result.focusOptions : []}
        />
        <div className="flex items-center gap-2">
          <RandomUnreviewedButton
            eventSlug={eventSlug}
            rows={result.status === 'loaded' ? result.rows : null}
          />
          <ColumnsDialog
            order={sanitizedColumnOrder}
            onOrderChange={setColumnOrder}
            visibility={sanitizedColumnVisibility}
            onVisibilityChange={handleColumnVisibilityChange}
            onReset={handleResetColumns}
            labels={REVIEWS_COLUMN_LABELS}
            forcedVisible={FORCED_VISIBLE_REVIEWS_COLUMNS}
            description="Drag to reorder, or check a column to show or hide it in the Reviews table."
          />
        </div>
      </div>

      {result.status === 'loading' && <Loading message="Loading reviews…" />}
      {result.status === 'error' && (
        <p className="text-destructive text-sm">Couldn't load reviews. Try refreshing.</p>
      )}
      {result.status === 'loaded' && (
        <p className="text-muted-foreground text-sm">
          {summaryText(filters, result.rows.length, result.totalCount)}
        </p>
      )}
      {result.status === 'loaded' && result.rows.length === 0 && (
        <p className="text-muted-foreground text-sm">No submissions match these filters.</p>
      )}
      {result.status === 'loaded' && result.rows.length > 0 && (
        <ReviewsTable
          rows={result.rows}
          columnOrder={sanitizedColumnOrder}
          columnVisibility={sanitizedColumnVisibility}
          eventSlug={eventSlug}
          onEditReview={setActiveReviewFileId}
          sort={sort}
          onSortChange={setSort}
          selectedTechTags={filters.techTags}
        />
      )}

      {activeReviewFileId && (
        <ReviewModal
          key={activeReviewFileId}
          eventSlug={eventSlug}
          fileId={activeReviewFileId}
          onClose={() => setActiveReviewFileId(null)}
          onSaved={result.refetch}
        />
      )}
    </div>
  );
}
