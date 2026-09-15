import { cn } from 'cn';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { ColumnsDialog } from '@/components/columns-dialog';
import { Loading } from '@/components/loading';
import {
  ChartCell,
  CopyFileIdButton,
  formatTimestamp,
  ROW_TONE_CLASS,
  SubmissionStatusBadge,
  type RowTone,
} from '@/components/submission-row';
import {
  DEFAULT_SUBMITTERS_COLUMN_VISIBILITY,
  FORCED_VISIBLE_SUBMITTERS_COLUMNS,
  sanitizeSubmittersColumnOrder,
  sanitizeSubmittersColumnVisibility,
  SUBMITTERS_COLUMN_LABELS,
  SUBMITTERS_COLUMN_ORDER,
  SUBMITTERS_COLUMN_ORDER_STORAGE_KEY,
  SUBMITTERS_COLUMN_STORAGE_KEY,
  SUBMITTERS_SORT_STORAGE_KEY,
  type SubmittersColumnKey,
  type SubmittersColumnVisibility,
} from '@/components/submitters-columns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';
import { useSubmissions, type Submission } from '@/hooks/use-submissions';
import { useSubmitters, type Submitter } from '@/hooks/use-submitters';

type Sort = { column: SubmittersColumnKey; direction: 'asc' | 'desc' };
type SortState = Sort | null;

// A submitter over this many Uppers charts gets their row flagged red (same tint as an errored
// row on the Submissions tab) - unlike Submissions, only the collapsed row itself is tinted;
// the expanded submissions list underneath stays plain (see the render below).
const MAX_SUBMISSIONS_UPPERS = 10;

// First-visit default (and what a cleared/never-set localStorage value falls back to) -
// surfaces the submitters closest to bumping into an Uppers-heavy pack first. Typed as the
// non-null Sort (not SortState) so DEFAULT_SORT.column below doesn't need a null check.
const DEFAULT_SORT: Sort = { column: 'uppers', direction: 'desc' };

function compareByColumn(a: Submitter, b: Submitter, column: SubmittersColumnKey): number {
  switch (column) {
    case 'submitter':
      return a.submitter.localeCompare(b.submitter);
    case 'lowers':
      return a.lowers - b.lowers;
    case 'uppers':
      return a.uppers - b.uppers;
    case 'doubles':
      return a.doubles - b.doubles;
    case 'ignored':
      return a.ignored - b.ignored;
    case 'errored':
      return a.errored - b.errored;
  }
}

function applySort(rows: Submitter[], sort: SortState): Submitter[] {
  if (!sort) return rows;
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => direction * compareByColumn(a, b, sort.column));
}

function SortableHeader({
  label,
  column,
  sort,
  onToggle,
  className,
}: {
  label: string;
  column: SubmittersColumnKey;
  sort: SortState;
  onToggle: (column: SubmittersColumnKey) => void;
  className?: string;
}) {
  const active = sort?.column === column;
  return (
    <button
      type="button"
      className={cn('inline-flex items-center gap-1 font-medium', className)}
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

// Groups the flat Submissions-tab list by submitter, so each Submitters row can expand into
// its own submissions without a dedicated backend endpoint - the same underlying rows the
// Submissions tab shows, just partitioned client-side.
function groupBySubmitter(submissions: Submission[]): Map<string, Submission[]> {
  const map = new Map<string, Submission[]>();
  for (const submission of submissions) {
    const list = map.get(submission.submitter);
    if (list) list.push(submission);
    else map.set(submission.submitter, [submission]);
  }
  return map;
}

// Same "counts toward # Uppers" rule as SubmittersService.listForEvent's `uppers` FILTER
// clause on the backend (NOT isIgnored AND no processingError AND chart is SINGLE/meter >= 10)
// - kept in sync by hand since this table only has the flat Submissions-tab rows to work with,
// not the aggregate endpoint's own SQL.
function qualifiesAsUpper(submission: Submission): boolean {
  return (
    !submission.isIgnored &&
    !submission.processingError &&
    submission.chart?.playstyle === 'SINGLE' &&
    submission.chart.meter >= 10
  );
}

// The expanded row's sub-table - a flat listing of one submitter's own submissions, matching
// the Submissions tab's columns (Submitted/Stepartist/Chart/File ID/Status) minus its own
// further per-row expansion, which this nested table doesn't need. The leading "#" column
// numbers only the rows that qualify toward that submitter's # Uppers count, in display order.
function SubmitterSubmissionsTable({
  submissions,
  loading,
  error,
}: {
  submissions: Submission[];
  loading: boolean;
  error: boolean;
}) {
  if (loading) {
    return <Loading message="Loading submissions…" />;
  }
  if (error) {
    return <p className="text-destructive text-sm">Couldn't load submissions. Try refreshing.</p>;
  }
  if (submissions.length === 0) {
    return <p className="text-muted-foreground text-sm">No submissions.</p>;
  }

  let upperCount = 0;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead>Stepartist</TableHead>
          <TableHead>Chart</TableHead>
          <TableHead>Notes</TableHead>
          <TableHead>File ID</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {submissions.map((submission) => {
          const status = submission.processingError ?? 'Success';
          const rowTone: RowTone | null =
            status !== 'Success' ? 'error' : submission.isIgnored ? 'ignored' : null;
          const isUpper = qualifiesAsUpper(submission);
          if (isUpper) upperCount += 1;
          return (
            <TableRow
              key={submission.fileId}
              className={rowTone ? ROW_TONE_CLASS[rowTone] : undefined}
            >
              <TableCell>{isUpper ? upperCount : '-'}</TableCell>
              <TableCell className="whitespace-nowrap">
                {formatTimestamp(submission.submittedAt)}
              </TableCell>
              <TableCell>{submission.stepartist}</TableCell>
              <TableCell>
                <ChartCell
                  chart={submission.chart}
                  submission={submission}
                  pack={submission.pack}
                />
              </TableCell>
              <TableCell className="whitespace-normal">
                {submission.additionalNotes || '—'}
              </TableCell>
              <TableCell>
                <CopyFileIdButton fileId={submission.fileId} />
              </TableCell>
              <TableCell>
                <SubmissionStatusBadge status={status} isIgnored={submission.isIgnored} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function SubmittersPanel({ eventSlug }: { eventSlug: string }) {
  const result = useSubmitters(eventSlug);
  const submissionsResult = useSubmissions(eventSlug);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const submissionsBySubmitter = useMemo(
    () =>
      submissionsResult.status === 'loaded'
        ? groupBySubmitter(submissionsResult.submissions)
        : new Map<string, Submission[]>(),
    [submissionsResult],
  );

  function toggleExpanded(submitter: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(submitter)) next.delete(submitter);
      else next.add(submitter);
      return next;
    });
  }
  // Persisted directly to localStorage (unlike Reviews' sort, which also round-trips through
  // the URL - see use-reviews-sort.ts) since this table has no other filters/state worth
  // sharing via a link.
  const [sort, setSort] = useLocalStorageState<SortState>(
    SUBMITTERS_SORT_STORAGE_KEY,
    DEFAULT_SORT,
  );
  const [columnVisibility, setColumnVisibility] = useLocalStorageState(
    SUBMITTERS_COLUMN_STORAGE_KEY,
    DEFAULT_SUBMITTERS_COLUMN_VISIBILITY,
  );
  const [columnOrder, setColumnOrder] = useLocalStorageState(
    SUBMITTERS_COLUMN_ORDER_STORAGE_KEY,
    SUBMITTERS_COLUMN_ORDER,
  );
  // Reconciled against the current canonical column set on every read, same reasoning as
  // reviews-panel.tsx's sanitizedColumnOrder/sanitizedColumnVisibility.
  const sanitizedColumnOrder = useMemo(
    () => sanitizeSubmittersColumnOrder(columnOrder),
    [columnOrder],
  );
  const sanitizedColumnVisibility = useMemo(
    () => sanitizeSubmittersColumnVisibility(columnVisibility),
    [columnVisibility],
  );
  const visibleColumns = sanitizedColumnOrder.filter((key) => sanitizedColumnVisibility[key]);

  const sortedSubmitters = useMemo(
    () => (result.status === 'loaded' ? applySort(result.submitters, sort) : []),
    [result, sort],
  );

  function toggleSort(column: SubmittersColumnKey) {
    if (!sort || sort.column !== column) {
      setSort({ column, direction: 'asc' });
    } else if (sort.direction === 'asc') {
      setSort({ column, direction: 'desc' });
    } else {
      setSort(null);
    }
  }

  function handleResetColumns() {
    setColumnVisibility(DEFAULT_SUBMITTERS_COLUMN_VISIBILITY);
    setColumnOrder(SUBMITTERS_COLUMN_ORDER);
  }

  // Hiding the column currently being sorted by would otherwise leave the table sorted by a
  // field with no visible header/arrow to explain or change it - same fallback as
  // reviews-panel.tsx's handleColumnVisibilityChange.
  function handleColumnVisibilityChange(next: SubmittersColumnVisibility) {
    setColumnVisibility(next);
    if (sort && !next[sort.column]) {
      setSort(next[DEFAULT_SORT.column] ? DEFAULT_SORT : null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <ColumnsDialog
          order={sanitizedColumnOrder}
          onOrderChange={setColumnOrder}
          visibility={sanitizedColumnVisibility}
          onVisibilityChange={handleColumnVisibilityChange}
          onReset={handleResetColumns}
          labels={SUBMITTERS_COLUMN_LABELS}
          forcedVisible={FORCED_VISIBLE_SUBMITTERS_COLUMNS}
          description="Drag to reorder, or check a column to show or hide it in the Submitters table."
        />
      </div>

      {result.status === 'loading' && <Loading message="Loading submitters…" />}
      {result.status === 'error' && (
        <p className="text-destructive text-sm">Couldn't load submitters. Try refreshing.</p>
      )}
      {result.status === 'loaded' && result.submitters.length === 0 && (
        <p className="text-muted-foreground text-sm">No submissions yet.</p>
      )}
      {result.status === 'loaded' && result.submitters.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              {visibleColumns.map((key) => (
                <TableHead key={key} className={key === 'submitter' ? undefined : 'text-right'}>
                  <SortableHeader
                    label={SUBMITTERS_COLUMN_LABELS[key]}
                    column={key}
                    sort={sort}
                    onToggle={toggleSort}
                    className={key === 'submitter' ? undefined : 'justify-end'}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSubmitters.map((submitter) => {
              const isExpanded = expanded.has(submitter.submitter);
              const exceedsMaxUppers = submitter.uppers > MAX_SUBMISSIONS_UPPERS;
              return (
                <Fragment key={submitter.submitter}>
                  <TableRow
                    className={cn('cursor-pointer', exceedsMaxUppers && ROW_TONE_CLASS.error)}
                    onClick={() => toggleExpanded(submitter.submitter)}
                  >
                    <TableCell className="w-4">
                      <ChevronRight
                        className={cn(
                          'text-muted-foreground size-4 transition-transform',
                          isExpanded && 'rotate-90',
                        )}
                      />
                    </TableCell>
                    {visibleColumns.map((key) => (
                      <TableCell
                        key={key}
                        className={key === 'submitter' ? undefined : 'text-right'}
                      >
                        {submitter[key]}
                      </TableCell>
                    ))}
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={visibleColumns.length + 1} className="bg-muted/30">
                        <SubmitterSubmissionsTable
                          submissions={submissionsBySubmitter.get(submitter.submitter) ?? []}
                          loading={submissionsResult.status === 'loading'}
                          error={submissionsResult.status === 'error'}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
