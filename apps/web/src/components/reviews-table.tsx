import { cn } from 'cn';
import { format } from 'date-fns';
import { Ban, ChevronDown, ChevronUp, GlobeOff, SquareCheck, SquarePen } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import { chartBadgeLabel, DifficultyBadge } from '@/components/chart-detail';
import { GradientBadge } from '@/components/gradient-badge';
import {
  REVIEWS_COLUMN_LABELS,
  type ReviewsColumnKey,
  type ReviewsColumnVisibility,
} from '@/components/reviews-columns';
import { Badge } from '@/components/ui/badge';
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
import { RATING_GRADIENT, STDEV_GRADIENT } from '@/lib/gradient-color';
import { shortenTechTag, sortTechTags } from '@/lib/tech-tags';

// Columns a user can re-sort by clicking their header. Add/Edit has no sortable value.
// Exported (along with SortState/SORTABLE_COLUMNS below) so use-reviews-sort.ts can persist
// and validate this same state from outside the table - same cross-file split as
// use-submission-detail.ts importing ChartFields/SubmissionFields from their components.
export type SortColumn =
  | 'meter'
  | 'title'
  | 'pack'
  | 'stepartist'
  | 'submitter'
  | 'reviewCount'
  | 'avgRating'
  | 'minRating'
  | 'maxRating'
  | 'stdevRating'
  | 'commentCount'
  | 'lastActivity';
export type SortState = { column: SortColumn; direction: 'asc' | 'desc' } | null;

export const SORTABLE_COLUMNS = new Set<SortColumn>([
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
  'commentCount',
  'lastActivity',
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
  'commentCount',
  'lastActivity',
]);

// The plain numeric columns - right-aligned like a spreadsheet's number columns, unlike the
// icon/badge/text content in every other column here. lastActivity is a formatted date, not a
// number, so it stays left-aligned even though it's narrow.
const RIGHT_ALIGNED_COLUMNS = new Set<ReviewsColumnKey>([
  'reviewCount',
  'avgRating',
  'minRating',
  'maxRating',
  'stdevRating',
  'commentCount',
]);

// Review.rating (and its avg/min/max/stdev derivatives) is already scaled to a plain decimal by
// the API - null means no active review on this chart carries a rating.
export function formatRating(value: number | null): string {
  return value == null ? '—' : value.toFixed(2);
}

// A rating-scale value (a single review's rating, or an avg/min/max derived from one) shown in
// a red/yellow/green GradientBadge - null stays a plain dash rather than an oddly-colored empty
// badge.
export function RatingCell({ value }: { value: number | null }) {
  if (value == null) return formatRating(value);
  return (
    <GradientBadge value={value} {...RATING_GRADIENT}>
      {formatRating(value)}
    </GradientBadge>
  );
}

// Stdev is a spread statistic, not a quality score - "good"/"bad" here means low/high
// disagreement among reviewers, not the rating itself - so it gets its own gradient
// (STDEV_GRADIENT) clipped well below RatingCell's 0-3 domain. See that constant's comment for
// why 1 (not the mathematical 1.5 ceiling) is the red end.
export function StdevCell({ value }: { value: number | null }) {
  if (value == null) return formatRating(value);
  return (
    <GradientBadge value={value} {...STDEV_GRADIENT}>
      {formatRating(value)}
    </GradientBadge>
  );
}

// selectedTechTags is the Tech Tags filter's own selection (codes, e.g. "BR") - a submission's
// claimed tag gets the filled/default badge style instead of the plain outline one when it's
// one of the currently selected tags, so the tags driving the row's best-match rank are visible
// at a glance instead of blending into the rest of the list.
function TechTagsCell({
  techTags,
  selectedTechTags,
}: {
  techTags: string[];
  selectedTechTags: string[];
}) {
  if (techTags.length === 0) return '—';
  return (
    <div className="flex flex-wrap gap-1">
      {sortTechTags(techTags).map((label) => {
        const code = shortenTechTag(label);
        return (
          <Badge key={label} variant={selectedTechTags.includes(code) ? 'default' : 'outline'}>
            {code}
          </Badge>
        );
      })}
    </div>
  );
}

function columnClassName(key: ReviewsColumnKey): string | undefined {
  return cn(NARROW_COLUMNS.has(key) && 'w-px', RIGHT_ALIGNED_COLUMNS.has(key) && 'text-right');
}

function titleOf(chart: ReviewsChart): string {
  return chart.titleRomaji || chart.title;
}

// Same amber/red tint scale as submission-row.tsx's ROW_TONE_CLASS (ignored/error) - reused
// here for a different pair of row-level states, so kept as its own small constant rather than
// importing that submissions-domain one under a misleading key name. Disqualified wins over
// warning when a chart has both (see rowToneClassName below).
const REVIEWS_ROW_TONE_CLASS = {
  warning: 'bg-amber-100 dark:bg-amber-500/25',
  disqualified: 'bg-red-100 dark:bg-red-500/25',
} as const;

function rowToneClassName(row: ReviewsRow): string | undefined {
  if (row.hasDisqualification) return REVIEWS_ROW_TONE_CLASS.disqualified;
  if (row.hasWarning) return REVIEWS_ROW_TONE_CLASS.warning;
  return undefined;
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
    case 'commentCount':
      return a.commentCount - b.commentCount;
    case 'lastActivity':
      return (
        (a.lastActivity ? Date.parse(a.lastActivity) : -Infinity) -
        (b.lastActivity ? Date.parse(b.lastActivity) : -Infinity)
      );
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
export function CmoddabilityIndicator({
  chart,
  cmodPreference,
}: {
  chart: Pick<ReviewsChart, 'hasSignificantTimingChanges'>;
  cmodPreference: string;
}) {
  if (!chart.hasSignificantTimingChanges || cmodPreference === 'CMOD_OKAY') return null;
  const tooltip = cmodPreference === 'NO_CMOD' ? 'NO CMOD' : 'NO CMOD (not the author)';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Ban className="text-destructive size-3.5 shrink-0" aria-label={tooltip} />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// Shown inline after the title whenever the submitter has explicitly withheld public-review
// consent or isn't the stepartist. Silent for CONSENTS/unanswered - absence already
// communicates "no objection on file," mirroring how the cmoddability icon stays silent for
// the default-okay case.
export function PublicConsentIndicator({
  submitter,
  consentToPublicReview,
}: {
  submitter: string;
  consentToPublicReview: string | null;
}) {
  if (consentToPublicReview !== 'DOES_NOT_CONSENT' && consentToPublicReview !== 'NOT_STEPARTIST') {
    return null;
  }
  const tooltip =
    consentToPublicReview === 'NOT_STEPARTIST'
      ? `${submitter} is not the stepartist`
      : `${submitter} does NOT consent to public review`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <GlobeOff className="text-destructive size-3.5 shrink-0" aria-label={tooltip} />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function TitleCell({ row, eventSlug }: { row: ReviewsRow; eventSlug: string }) {
  const title = titleOf(row.chart);
  const subtitle = row.chart.subtitleRomaji || row.chart.subtitle;
  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5">
        <Link
          to={`/events/${encodeURIComponent(eventSlug)}/submissions/${encodeURIComponent(row.fileId)}`}
          className="hover:underline"
        >
          {title}
        </Link>
        <CmoddabilityIndicator chart={row.chart} cmodPreference={row.cmodPreference} />
        <PublicConsentIndicator
          submitter={row.submitter}
          consentToPublicReview={row.consentToPublicReview}
        />
      </span>
      {subtitle && <span className="text-muted-foreground text-xs">{subtitle}</span>}
      {row.basicChecks.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {row.basicChecks.map((check) =>
            check.level === 'DISQUALIFIED' ? (
              // Both badges get an explicit border, not just a fill - the row itself is tinted
              // the same amber/red family (REVIEWS_ROW_TONE_CLASS above), so a same-hue fill
              // alone can end up nearly indistinguishable from the row behind it (this is what
              // happened to the warning badge before the border was added: bg-amber-100 badge
              // on a bg-amber-100 row is a completely invisible edge). destructive's own fill
              // happens to differ enough from bg-red-100 to read on its own, but the border
              // makes that robust rather than incidental.
              <Badge key={check.id} variant="destructive" className="border-destructive/30">
                {check.label}
              </Badge>
            ) : (
              <Badge
                key={check.id}
                className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-400"
              >
                {check.label}
              </Badge>
            ),
          )}
        </div>
      )}
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
  eventSlug,
  onEditReview,
  sort,
  onSortChange,
  selectedTechTags,
}: {
  rows: ReviewsRow[];
  columnOrder: ReviewsColumnKey[];
  columnVisibility: ReviewsColumnVisibility;
  eventSlug: string;
  onEditReview: (fileId: string) => void;
  // Lifted to the caller (rather than owned here) so it can be persisted the same way the
  // filters are - see use-reviews-sort.ts.
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  // The Tech Tags filter's own selection (codes) - highlighted in the Tech Tags column so the
  // tags driving a row's best-match rank stand out from the rest of its claimed tags.
  selectedTechTags: string[];
}) {
  const sortedRows = useMemo(() => applySort(rows, sort), [rows, sort]);

  function toggleSort(column: SortColumn) {
    if (!sort || sort.column !== column) {
      onSortChange({ column, direction: 'asc' });
    } else if (sort.direction === 'asc') {
      onSortChange({ column, direction: 'desc' });
    } else {
      onSortChange(null); // third click reverts to the server's default row order
    }
  }

  const cellRenderers: Record<ReviewsColumnKey, (row: ReviewsRow) => ReactNode> = {
    addEdit: (row) => (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={row.hasOwnReview ? 'Edit your review' : 'Add a review'}
        onClick={() => onEditReview(row.fileId)}
      >
        {row.hasOwnReview ? <SquareCheck /> : <SquarePen />}
      </Button>
    ),
    meter: (row) => (
      <DifficultyBadge label={chartBadgeLabel(row.chart)} difficulty={row.chart.difficulty} />
    ),
    title: (row) => <TitleCell row={row} eventSlug={eventSlug} />,
    pack: (row) => row.pack,
    stepartist: (row) => row.stepartist,
    submitter: (row) => row.submitter,
    techTags: (row) => <TechTagsCell techTags={row.techTags} selectedTechTags={selectedTechTags} />,
    reviewCount: (row) => row.reviewCount,
    avgRating: (row) => <RatingCell value={row.avgRating} />,
    minRating: (row) => <RatingCell value={row.minRating} />,
    maxRating: (row) => <RatingCell value={row.maxRating} />,
    stdevRating: (row) => <StdevCell value={row.stdevRating} />,
    commentCount: (row) => row.commentCount,
    lastActivity: (row) => (row.lastActivity ? format(new Date(row.lastActivity), 'PP p') : '—'),
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
          <TableRow key={row.fileId} className={rowToneClassName(row)}>
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
