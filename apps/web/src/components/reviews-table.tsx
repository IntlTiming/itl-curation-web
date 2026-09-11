import { cn } from 'cn';
import { Ban, ChevronDown, ChevronUp, Globe, SquarePen } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { chartBadgeLabel, DifficultyBadge } from '@/components/chart-detail';
import {
  REVIEWS_COLUMN_LABELS,
  type ReviewsColumnKey,
  type ReviewsColumnVisibility,
} from '@/components/reviews-columns';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ReviewsChart, ReviewsRow } from '@/hooks/use-reviews';

// Columns a user can re-sort by clicking their header. Add/Edit has no sortable value.
type SortColumn =
  | 'meter'
  | 'title'
  | 'pack'
  | 'stepartist'
  | 'submitter'
  | 'reviewCount'
  | 'avgRating'
  | 'minRating'
  | 'maxRating'
  | 'stdevRating';
type SortState = { column: SortColumn; direction: 'asc' | 'desc' } | null;

const SORTABLE_COLUMNS = new Set<SortColumn>([
  'meter',
  'title',
  'pack',
  'stepartist',
  'submitter',
  'reviewCount',
  'avgRating',
  'minRating',
  'maxRating',
  'stdevRating',
]);

// These columns' content is a fixed-size icon button, a short badge, or a small number - never
// worth stretching wider than that, unlike Title/Pack/Stepartist/Submitter which hold
// variable-length text. `w-px` is the standard Tailwind shrink-to-fit trick: combined with the
// table cells' existing whitespace-nowrap, the column collapses to its content's natural width
// instead of taking a share of the table's auto-layout leftover space.
const NARROW_COLUMNS = new Set<ReviewsColumnKey>([
  'addEdit',
  'meter',
  'reviewCount',
  'avgRating',
  'minRating',
  'maxRating',
  'stdevRating',
]);

// The plain numeric columns - right-aligned like a spreadsheet's number columns, unlike the
// icon/badge/text content in every other column here.
const RIGHT_ALIGNED_COLUMNS = new Set<ReviewsColumnKey>([
  'reviewCount',
  'avgRating',
  'minRating',
  'maxRating',
  'stdevRating',
]);

// Review.rating (and its avg/min/max/stdev derivatives) is already scaled to a plain decimal by
// the API - null means no active review on this chart carries a rating.
function formatRating(value: number | null): string {
  return value == null ? '—' : value.toFixed(2);
}

function columnClassName(key: ReviewsColumnKey): string | undefined {
  return cn(NARROW_COLUMNS.has(key) && 'w-px', RIGHT_ALIGNED_COLUMNS.has(key) && 'text-right');
}

function titleOf(chart: ReviewsChart): string {
  return chart.titleRomaji || chart.title;
}

// Meter's own column-sort uses only chart.meter (per spec) - a narrower, independent
// ordering from the multi-key default row order (playstyle -> meter -> difficulty slot ->
// title) that governs the table when no column sort is active. Both are intentional.
function compareByColumn(a: ReviewsRow, b: ReviewsRow, column: SortColumn): number {
  switch (column) {
    case 'meter':
      return a.chart.meter - b.chart.meter;
    case 'title':
      return titleOf(a.chart).localeCompare(titleOf(b.chart));
    case 'pack':
      return a.pack.localeCompare(b.pack);
    case 'stepartist':
      return a.stepartist.localeCompare(b.stepartist);
    case 'submitter':
      return a.submitter.localeCompare(b.submitter);
    case 'reviewCount':
      return a.reviewCount - b.reviewCount;
    case 'avgRating':
      return (a.avgRating ?? -Infinity) - (b.avgRating ?? -Infinity);
    case 'minRating':
      return (a.minRating ?? -Infinity) - (b.minRating ?? -Infinity);
    case 'maxRating':
      return (a.maxRating ?? -Infinity) - (b.maxRating ?? -Infinity);
    case 'stdevRating':
      return (a.stdevRating ?? -Infinity) - (b.stdevRating ?? -Infinity);
  }
}

function applySort(rows: ReviewsRow[], sort: SortState): ReviewsRow[] {
  if (!sort) return rows;
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => direction * compareByColumn(a, b, sort.column));
}

// Cancel-style icon shown inline after the title whenever a chart's timing changes are
// significant enough that CMOD-ability isn't automatically okay - see the Reviews plan's
// cmoddability rule. Hidden entirely (including when hasSignificantTimingChanges is false)
// whenever the chart is CMOD OKAY, since that's the by-far-most-common case.
function CmoddabilityIndicator({
  chart,
  cmodPreference,
}: {
  chart: Pick<ReviewsChart, 'hasSignificantTimingChanges'>;
  cmodPreference: ReviewsRow['cmodPreference'];
}) {
  if (!chart.hasSignificantTimingChanges || cmodPreference === 'CMOD_OKAY') return null;
  const tooltip = cmodPreference === 'NO_CMOD' ? 'NO CMOD' : 'Unauthorized';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Ban className="text-destructive size-3.5 shrink-0" aria-label={tooltip} />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// Shown inline after the title whenever the submitter has explicitly consented to their chart
// being reviewed publicly. Silent for DOES_NOT_CONSENT/NOT_STEPARTIST/unanswered - absence
// already communicates "not confirmed as publicly reviewable," mirroring how the
// cmoddability icon stays silent for the default-okay case.
function PublicConsentIndicator({
  submitter,
  consentToPublicReview,
}: {
  submitter: string;
  consentToPublicReview: ReviewsRow['consentToPublicReview'];
}) {
  if (consentToPublicReview !== 'CONSENTS') return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Globe
          className="text-muted-foreground size-3.5 shrink-0"
          aria-label="Consented to public review"
        />
      </TooltipTrigger>
      <TooltipContent>{submitter} consented to public review</TooltipContent>
    </Tooltip>
  );
}

function TitleCell({ row }: { row: ReviewsRow }) {
  const title = titleOf(row.chart);
  const subtitle = row.chart.subtitleRomaji || row.chart.subtitle;
  return (
    <div className="flex flex-col">
      <span className="inline-flex items-center gap-1.5">
        {title}
        <CmoddabilityIndicator chart={row.chart} cmodPreference={row.cmodPreference} />
        <PublicConsentIndicator
          submitter={row.submitter}
          consentToPublicReview={row.consentToPublicReview}
        />
      </span>
      {subtitle && <span className="text-muted-foreground text-xs">{subtitle}</span>}
    </div>
  );
}

function SortableHeader({
  label,
  column,
  sort,
  onToggle,
}: {
  label: string;
  column: SortColumn;
  sort: SortState;
  onToggle: (column: SortColumn) => void;
}) {
  const active = sort?.column === column;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-medium"
      onClick={() => onToggle(column)}
    >
      {label}
      {active &&
        (sort!.direction === 'asc' ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        ))}
    </button>
  );
}

export function ReviewsTable({
  rows,
  columnOrder,
  columnVisibility,
}: {
  rows: ReviewsRow[];
  columnOrder: ReviewsColumnKey[];
  columnVisibility: ReviewsColumnVisibility;
}) {
  const [sort, setSort] = useState<SortState>(null);
  const sortedRows = useMemo(() => applySort(rows, sort), [rows, sort]);

  function toggleSort(column: SortColumn) {
    setSort((prev) => {
      if (!prev || prev.column !== column) return { column, direction: 'asc' };
      if (prev.direction === 'asc') return { column, direction: 'desc' };
      return null; // third click reverts to the server's default row order
    });
  }

  const cellRenderers: Record<ReviewsColumnKey, (row: ReviewsRow) => ReactNode> = {
    addEdit: () => (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Edit review"
        onClick={() => {
          // no-op for now - review editing isn't built yet
        }}
      >
        <SquarePen />
      </Button>
    ),
    meter: (row) => (
      <DifficultyBadge label={chartBadgeLabel(row.chart)} difficulty={row.chart.difficulty} />
    ),
    title: (row) => <TitleCell row={row} />,
    pack: (row) => row.pack,
    stepartist: (row) => row.stepartist,
    submitter: (row) => row.submitter,
    reviewCount: (row) => row.reviewCount,
    avgRating: (row) => formatRating(row.avgRating),
    minRating: (row) => formatRating(row.minRating),
    maxRating: (row) => formatRating(row.maxRating),
    stdevRating: (row) => formatRating(row.stdevRating),
  };

  // Add/Edit has no meaningful header text (it's just the icon-button column) - every other
  // header reuses the same label shown in the column-visibility settings dialog.
  const headerLabels: Record<ReviewsColumnKey, string> = { ...REVIEWS_COLUMN_LABELS, addEdit: '' };

  const visibleColumns = columnOrder.filter((key) => columnVisibility[key]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {visibleColumns.map((key) => (
            <TableHead key={key} className={columnClassName(key)}>
              {SORTABLE_COLUMNS.has(key as SortColumn) ? (
                <SortableHeader
                  label={headerLabels[key]}
                  column={key as SortColumn}
                  sort={sort}
                  onToggle={toggleSort}
                />
              ) : (
                headerLabels[key]
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.map((row) => (
          <TableRow key={row.fileId}>
            {visibleColumns.map((key) => (
              <TableCell key={key} className={columnClassName(key)}>
                {cellRenderers[key](row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
