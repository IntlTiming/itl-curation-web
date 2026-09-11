import { format } from 'date-fns';
import { chartBadgeLabel, DifficultyBadge, type ChartFields } from '@/components/chart-detail';
import { CopyButton } from '@/components/copy-button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { SubmissionFields } from '@/components/submission-detail';

// Shared between SubmissionsPanel (plain listing) and ImportPanel (diff preview) - both
// render the same submitted-row shape (timestamp, chart cell, file ID, status), so the
// Submissions table intentionally matches the Import preview table's look.

// Localized date+time, e.g. "Sep 7, 2026, 4:35 PM" - shown in the viewer's local timezone
// since format() operates on the Date object's local representation.
export function formatTimestamp(iso: string): string {
  return format(new Date(iso), 'PP p');
}

// Row tint so an ignored or errored submission reads at a glance without scanning the
// Status column - the expanded detail row gets a lighter tint of the same color, one step
// down.
export const ROW_TONE_CLASS = {
  ignored: 'bg-amber-100 dark:bg-amber-500/25',
  error: 'bg-red-100 dark:bg-red-500/25',
} as const;
export const ROW_TONE_EXPANDED_CLASS = {
  ignored: 'bg-amber-50 dark:bg-amber-500/10',
  error: 'bg-red-50 dark:bg-red-500/10',
} as const;

export type RowTone = keyof typeof ROW_TONE_CLASS;

// e.g. "[SX13 badge] Single/MIRROR (Subtitle)" - small difficulty badge first, then
// pack/title and optional subtitle. Stepartist is its own column, not folded in here.
// A submission whose chart failed to parse still has its own submitter-claimed
// playstyle/difficulty, so the badge falls back to that (without a meter, since the
// submission's claim - unlike the chart - carries no meter) rather than disappearing.
export function ChartCell({
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

export function CopyFileIdButton({ fileId }: { fileId: string }) {
  return (
    <CopyButton value={fileId} title={fileId}>
      <span className="truncate">{fileId.slice(0, 10)}…</span>
    </CopyButton>
  );
}

export function SubmissionStatusBadge({
  status,
  isIgnored,
}: {
  status: string;
  isIgnored: boolean;
}) {
  if (status !== 'Success') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive">Error</Badge>
        </TooltipTrigger>
        <TooltipContent>{status}</TooltipContent>
      </Tooltip>
    );
  }
  if (isIgnored) {
    return (
      <Badge className="border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">
        Success
      </Badge>
    );
  }
  return <Badge variant="outline">Success</Badge>;
}
