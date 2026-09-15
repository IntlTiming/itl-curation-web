import { cn } from 'cn';
import { ChevronRight } from 'lucide-react';
import { Fragment, useId, useState } from 'react';
import { ChartDetail } from '@/components/chart-detail';
import { Loading } from '@/components/loading';
import { SubmissionDetail } from '@/components/submission-detail';
import {
  ChartCell,
  CopyFileIdButton,
  formatTimestamp,
  ROW_TONE_CLASS,
  ROW_TONE_EXPANDED_CLASS,
  SubmissionStatusBadge,
  type RowTone,
} from '@/components/submission-row';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';
import { useSubmissions } from '@/hooks/use-submissions';

// This table matches ImportPanel's actionable-rows table look - shared row pieces
// (timestamp, chart cell, file ID, status badge, row tone) live in submission-row.tsx.
// This one stays a plain listing rather than a diff view (no insert/update/kind column,
// no previous* values), so the two tables aren't merged into one component.

// A plain three-way radio selection (always exactly one option active) rather than the
// toggleable checkboxes this used to be - "Show all" is itself an explicit option, so there's
// no need to support deselecting the other two.
type SubmissionsFilterMode = 'all' | 'ignored' | 'errored';

const SUBMISSIONS_FILTER_STORAGE_KEY = 'itl-submissions-filter';

export function SubmissionsPanel({ eventSlug }: { eventSlug: string }) {
  const result = useSubmissions(eventSlug);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useLocalStorageState<SubmissionsFilterMode>(
    SUBMISSIONS_FILTER_STORAGE_KEY,
    'all',
  );
  const showAllId = useId();
  const showOnlyIgnoredId = useId();
  const showOnlyErroredId = useId();

  function toggleExpanded(fileId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }

  if (result.status === 'loading') {
    return <Loading message="Loading submissions…" />;
  }

  if (result.status === 'error') {
    return <p className="text-destructive text-sm">Couldn't load submissions. Try refreshing.</p>;
  }

  if (result.submissions.length === 0) {
    return <p className="text-muted-foreground text-sm">No submissions yet.</p>;
  }

  const visibleSubmissions = result.submissions.filter((submission) => {
    if (filterMode === 'ignored') return submission.isIgnored;
    if (filterMode === 'errored') return Boolean(submission.processingError);
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup
        className="flex w-auto flex-row items-center gap-6"
        value={filterMode}
        onValueChange={(value) => setFilterMode(value as SubmissionsFilterMode)}
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem id={showAllId} value="all" />
          <Label htmlFor={showAllId}>Show all</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem id={showOnlyIgnoredId} value="ignored" />
          <Label htmlFor={showOnlyIgnoredId}>Show only ignored</Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem id={showOnlyErroredId} value="errored" />
          <Label htmlFor={showOnlyErroredId}>Show only errored</Label>
        </div>
      </RadioGroup>
      {visibleSubmissions.length === 0 ? (
        <p className="text-muted-foreground text-sm">No submissions match these filters.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead className="w-12 text-right">#</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Submitter</TableHead>
              <TableHead>Stepartist</TableHead>
              <TableHead>Chart</TableHead>
              <TableHead>File ID</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleSubmissions.map((submission, index) => {
              const status = submission.processingError ?? 'Success';
              const rowTone: RowTone | null =
                status !== 'Success' ? 'error' : submission.isIgnored ? 'ignored' : null;
              return (
                <Fragment key={submission.fileId}>
                  <TableRow
                    className={cn('cursor-pointer', rowTone && ROW_TONE_CLASS[rowTone])}
                    onClick={() => toggleExpanded(submission.fileId)}
                  >
                    <TableCell className="w-4">
                      <ChevronRight
                        className={cn(
                          'text-muted-foreground size-4 transition-transform',
                          expanded.has(submission.fileId) && 'rotate-90',
                        )}
                      />
                    </TableCell>
                    <TableCell className="text-right">{index + 1}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatTimestamp(submission.submittedAt)}
                    </TableCell>
                    <TableCell>{submission.submitter}</TableCell>
                    <TableCell>{submission.stepartist}</TableCell>
                    <TableCell>
                      <ChartCell
                        chart={submission.chart}
                        submission={submission}
                        pack={submission.pack}
                      />
                    </TableCell>
                    <TableCell>
                      <CopyFileIdButton fileId={submission.fileId} />
                    </TableCell>
                    <TableCell>
                      <SubmissionStatusBadge status={status} isIgnored={submission.isIgnored} />
                    </TableCell>
                  </TableRow>
                  {expanded.has(submission.fileId) && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className={cn(
                          'whitespace-normal',
                          rowTone ? ROW_TONE_EXPANDED_CLASS[rowTone] : 'bg-muted/30',
                        )}
                      >
                        <SubmissionDetail submission={submission} />
                        {submission.chart && <ChartDetail chart={submission.chart} />}
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
