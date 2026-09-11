import { cn } from 'cn';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import {
  chartBadgeLabel,
  ChartDetail,
  DifficultyBadge,
  type ChartFields,
} from '@/components/chart-detail';
import { CopyButton } from '@/components/copy-button';
import { Loading } from '@/components/loading';
import { SubmissionDetail, type SubmissionFields } from '@/components/submission-detail';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSubmissions } from '@/hooks/use-submissions';

// This table intentionally duplicates ImportPanel's actionable-rows table rather than
// sharing it - that one is a diff view (insert/update/kind, previous* values) and this one is
// a plain listing, and the two are expected to keep diverging as review-specific features
// land here. Copy from ImportPanel when this needs another column/behavior it already has;
// don't reach for a shared component.

// Localized date+time, e.g. "Sep 7, 2026, 4:35 PM" - shown in the viewer's local timezone
// since format() operates on the Date object's local representation.
function formatTimestamp(iso: string): string {
  return format(new Date(iso), 'PP p');
}

function CopyFileIdButton({ fileId }: { fileId: string }) {
  return (
    <CopyButton value={fileId} title={fileId}>
      <span className="truncate">{fileId.slice(0, 10)}…</span>
    </CopyButton>
  );
}

// Row tint so an ignored or errored submission reads at a glance without scanning the
// Status column - the expanded detail row gets a lighter tint of the same color, one step
// down. Mirrors ImportPanel's ROW_TONE_CLASS.
const ROW_TONE_CLASS = {
  ignored: 'bg-amber-100 dark:bg-amber-500/25',
  error: 'bg-red-100 dark:bg-red-500/25',
} as const;
const ROW_TONE_EXPANDED_CLASS = {
  ignored: 'bg-amber-50 dark:bg-amber-500/10',
  error: 'bg-red-50 dark:bg-red-500/10',
} as const;

type RowTone = keyof typeof ROW_TONE_CLASS;

// e.g. "[SX13 badge] Single/MIRROR (Subtitle)" - small difficulty badge first, then
// pack/title and optional subtitle. Stepartist is its own column, not folded in here.
// A submission whose chart failed to parse still has its own submitter-claimed
// playstyle/difficulty, so the badge falls back to that (without a meter, since the
// submission's claim - unlike the chart - carries no meter) rather than disappearing.
function ChartCell({
  chart,
  submission,
  pack,
}: {
  chart: ChartFields | null | undefined;
  submission: SubmissionFields | null | undefined;
  pack: string;
}) {
  if (chart) {
    const title = chart.titleRomaji || chart.title;
    const subtitle = chart.subtitleRomaji || chart.subtitle;
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <DifficultyBadge label={chartBadgeLabel(chart)} difficulty={chart.difficulty} small />
        <span>
          {pack}/{title}
          {subtitle ? ` ${subtitle}` : ''}
        </span>
      </span>
    );
  }
  if (submission) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <DifficultyBadge
          label={chartBadgeLabel(submission)}
          difficulty={submission.difficulty}
          small
        />
        <span>{pack}</span>
      </span>
    );
  }
  return <>{pack}</>;
}

export function SubmissionsPanel({ eventSlug }: { eventSlug: string }) {
  const result = useSubmissions(eventSlug);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead />
          <TableHead>Submitted</TableHead>
          <TableHead>Submitter</TableHead>
          <TableHead>Stepartist</TableHead>
          <TableHead>Chart</TableHead>
          <TableHead>File ID</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {result.submissions.map((submission) => {
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
                  {status === 'Success' ? (
                    submission.isIgnored ? (
                      <Badge className="border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
                        Success
                      </Badge>
                    ) : (
                      <Badge variant="outline">Success</Badge>
                    )
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="destructive">Error</Badge>
                      </TooltipTrigger>
                      <TooltipContent>{status}</TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
              {expanded.has(submission.fileId) && (
                <TableRow>
                  <TableCell
                    colSpan={7}
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
  );
}
