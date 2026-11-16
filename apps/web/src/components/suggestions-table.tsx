import { cn } from 'cn';
import { format } from 'date-fns';
import { ExternalLink, Link2, SquareCheck, SquarePen } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  BasicCheckBadges,
  PublicConsentIndicator,
  RatingCell,
  rowToneClassName,
  SortableHeader,
  StdevCell,
} from '@/components/reviews-table';
import { formatTimestamp } from '@/components/submission-row';
import {
  SUGGESTIONS_COLUMN_LABELS,
  type SuggestionsColumnKey,
  type SuggestionsColumnVisibility,
} from '@/components/suggestions-columns';
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
import type { SuggestionRow } from '@/hooks/use-suggestions';
import { toExternalHref } from '@/lib/external-link';

export type SuggestionsSortColumn = Exclude<SuggestionsColumnKey, 'addEdit'>;
export type SuggestionsSortState = {
  column: SuggestionsSortColumn;
  direction: 'asc' | 'desc';
} | null;

// First click on these sorts descending (biggest/newest first), like the Reviews table.
const DESC_FIRST_COLUMNS = new Set<SuggestionsSortColumn>([
  'submittedAt',
  'reviewCount',
  'avgRating',
  'minRating',
  'maxRating',
  'stdevRating',
  'commentCount',
  'lastActivity',
]);

// Rows with no value here always sink to the bottom in both directions - "no data" is neither
// the lowest nor the highest value (same rule as the Reviews table).
const NULLS_LAST_COLUMNS = new Set<SuggestionsSortColumn>([
  'avgRating',
  'minRating',
  'maxRating',
  'stdevRating',
  'lastActivity',
  'linked',
  'link',
]);

const REVIEW_COUNT_TIEBREAK_COLUMNS = new Set<SuggestionsSortColumn>([
  'avgRating',
  'minRating',
  'maxRating',
  'stdevRating',
]);

const NARROW_COLUMNS = new Set<SuggestionsColumnKey>([
  'position',
  'addEdit',
  'reviewCount',
  'avgRating',
  'minRating',
  'maxRating',
  'stdevRating',
  'commentCount',
  'lastActivity',
  'submittedAt',
]);

const RIGHT_ALIGNED_COLUMNS = new Set<SuggestionsColumnKey>([
  'position',
  'reviewCount',
  'avgRating',
  'minRating',
  'maxRating',
  'stdevRating',
  'commentCount',
]);

function columnClassName(key: SuggestionsColumnKey): string | undefined {
  return cn(NARROW_COLUMNS.has(key) && 'w-px', RIGHT_ALIGNED_COLUMNS.has(key) && 'text-right');
}

function linkedLabel(row: SuggestionRow): string | null {
  const linked = row.linkedSubmission;
  return linked ? (linked.title ?? linked.fileId) : null;
}

function sortValue(row: SuggestionRow, column: SuggestionsSortColumn): number | string | null {
  switch (column) {
    case 'position':
      return row.position;
    case 'chart':
      return row.chart;
    case 'reason':
      return row.reason;
    case 'link':
      return row.link || null;
    case 'submitter':
      return row.submitter;
    case 'submittedAt':
      return Date.parse(row.submittedAt);
    case 'linked':
      return linkedLabel(row);
    case 'lastActivity':
      return row.lastActivity ? Date.parse(row.lastActivity) : null;
    default:
      return row[column];
  }
}

// No sort = file order (position ascending), which is also the API's own row order.
function sortSuggestions(rows: SuggestionRow[], sort: SuggestionsSortState) {
  if (!sort) return rows;
  const { column } = sort;
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = sortValue(a, column);
    const bv = sortValue(b, column);
    if (NULLS_LAST_COLUMNS.has(column) && (av === null || bv === null)) {
      if (av === null && bv === null) return a.position - b.position;
      return av === null ? 1 : -1;
    }
    const primary =
      typeof av === 'string' && typeof bv === 'string'
        ? direction * av.localeCompare(bv, undefined, { sensitivity: 'base' })
        : direction * ((av as number) - (bv as number));
    if (primary !== 0) return primary;
    if (REVIEW_COUNT_TIEBREAK_COLUMNS.has(column) && a.reviewCount !== b.reviewCount) {
      return b.reviewCount - a.reviewCount;
    }
    return a.position - b.position;
  });
}

function ChartCell({ row, eventSlug }: { row: SuggestionRow; eventSlug: string }) {
  return (
    <div className="flex min-w-48 flex-col gap-1 whitespace-normal">
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Link
          to={`/events/${encodeURIComponent(eventSlug)}/suggestions/${row.position}`}
          className="hover:underline"
        >
          {row.chart}
        </Link>
        <PublicConsentIndicator
          submitter={row.submitter}
          consentToPublicReview={row.consentToPublicReview}
        />
      </span>
      <BasicCheckBadges checks={row.basicChecks} />
    </div>
  );
}

// The suggestion form's free-text link field. Shows just the domain to keep the column narrow;
// the full URL is in the tooltip. Text that isn't a usable http(s) URL is shown as-is, unlinked
// (see toExternalHref).
function LinkCell({ link }: { link: string }) {
  if (!link.trim()) return <span className="text-muted-foreground">—</span>;
  const href = toExternalHref(link);
  if (!href) return <span className="inline-block max-w-48 truncate">{link}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-primary inline-flex max-w-48 items-center gap-1 hover:underline"
        >
          <ExternalLink className="size-3.5 shrink-0" />
          <span className="truncate">{new URL(href).hostname.replace(/^www\./, '')}</span>
        </a>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm break-all">{href}</TooltipContent>
    </Tooltip>
  );
}

function LinkedCell({ row, eventSlug }: { row: SuggestionRow; eventSlug: string }) {
  const linked = row.linkedSubmission;
  if (!linked) return <span className="text-muted-foreground">—</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to={`/events/${encodeURIComponent(eventSlug)}/submissions/${encodeURIComponent(linked.fileId)}`}
        >
          <Badge variant="secondary" className="max-w-56 gap-1">
            <Link2 className="size-3 shrink-0" />
            <span className="truncate">{linkedLabel(row)}</span>
          </Badge>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        Linked to {linkedLabel(row)} by {linked.stepartist}
      </TooltipContent>
    </Tooltip>
  );
}

export function SuggestionsTable({
  rows,
  columnOrder,
  columnVisibility,
  eventSlug,
  onEditReview,
  sort,
  onSortChange,
}: {
  rows: SuggestionRow[];
  columnOrder: SuggestionsColumnKey[];
  columnVisibility: SuggestionsColumnVisibility;
  eventSlug: string;
  onEditReview: (position: number) => void;
  sort: SuggestionsSortState;
  onSortChange: (sort: SuggestionsSortState) => void;
}) {
  const sortedRows = useMemo(() => sortSuggestions(rows, sort), [rows, sort]);

  function toggleSort(column: SuggestionsSortColumn) {
    const firstDirection = DESC_FIRST_COLUMNS.has(column) ? 'desc' : 'asc';
    const secondDirection = firstDirection === 'desc' ? 'asc' : 'desc';
    if (!sort || sort.column !== column) {
      onSortChange({ column, direction: firstDirection });
    } else if (sort.direction === firstDirection) {
      onSortChange({ column, direction: secondDirection });
    } else {
      onSortChange(null); // third click reverts to file order
    }
  }

  const cellRenderers: Record<SuggestionsColumnKey, (row: SuggestionRow) => ReactNode> = {
    position: (row) => row.position,
    addEdit: (row) => (
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={row.linkedSubmission !== null}
        aria-label={row.hasOwnReview ? 'Edit your review' : 'Add a review'}
        onClick={() => onEditReview(row.position)}
      >
        {row.hasOwnReview ? <SquareCheck /> : <SquarePen />}
      </Button>
    ),
    chart: (row) => <ChartCell row={row} eventSlug={eventSlug} />,
    reason: (row) => (
      <span className="text-muted-foreground line-clamp-2 min-w-48 text-xs whitespace-normal">
        {row.reason}
      </span>
    ),
    link: (row) => <LinkCell link={row.link} />,
    submitter: (row) => row.submitter,
    submittedAt: (row) => formatTimestamp(row.submittedAt),
    linked: (row) => <LinkedCell row={row} eventSlug={eventSlug} />,
    reviewCount: (row) => row.reviewCount,
    avgRating: (row) => <RatingCell value={row.avgRating} />,
    minRating: (row) => <RatingCell value={row.minRating} />,
    maxRating: (row) => <RatingCell value={row.maxRating} />,
    stdevRating: (row) => <StdevCell value={row.stdevRating} />,
    commentCount: (row) => row.commentCount,
    lastActivity: (row) => (row.lastActivity ? format(new Date(row.lastActivity), 'PP p') : '—'),
  };

  const headerLabels: Record<SuggestionsColumnKey, string> = {
    ...SUGGESTIONS_COLUMN_LABELS,
    addEdit: '',
    linked: 'Linked',
  };
  const visibleColumns = columnOrder.filter((key) => columnVisibility[key]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {visibleColumns.map((key) => (
            <TableHead key={key} className={columnClassName(key)}>
              {key === 'addEdit' ? (
                headerLabels[key]
              ) : (
                <SortableHeader
                  label={headerLabels[key]}
                  column={key}
                  sort={sort}
                  onToggle={toggleSort}
                />
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.map((row) => (
          <TableRow key={row.position} className={rowToneClassName(row)}>
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
