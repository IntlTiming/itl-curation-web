import { cn } from 'cn';
import { format } from 'date-fns';
import { ChevronRight, CircleCheck, FileJson, UploadCloud, X } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  chartBadgeLabel,
  ChartDetail,
  DifficultyBadge,
  type ChartFields,
} from '@/components/chart-detail';
import { CopyButton } from '@/components/copy-button';
import { SubmissionDetail, type SubmissionFields } from '@/components/submission-detail';
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

type SubmissionRowSummary = {
  fileId: string;
  submittedAt: string;
  submitter: string;
  stepartist: string;
  pack: string;
  songDir: string | null;
  status: string;
};

type MissingSubmissionRow = SubmissionRowSummary & { chartCleared: boolean };

type FieldChange = { field: string; from: unknown; to: unknown };

type ImportSummary = {
  totalInFile: number;
  totalExistingInDb: number;
  toInsert: number;
  toUpdate: number;
  toIgnore: number;
  unchanged: number;
  alreadyIgnored: number;
};

type ImportPreviewResponse = {
  ok: true;
  summary: ImportSummary;
  inserts: (SubmissionRowSummary & { chart: ChartFields | null; submission: SubmissionFields })[];
  updates: (SubmissionRowSummary & {
    changedFields: FieldChange[];
    chart: ChartFields | null;
    previousChart: ChartFields | null;
    submission: SubmissionFields;
    previousSubmission: SubmissionFields;
  })[];
  newlyIgnored: MissingSubmissionRow[];
  chartCleanup: MissingSubmissionRow[];
};

type ImportApplyResponse = {
  ok: true;
  result: {
    inserted: number;
    updated: number;
    newlyIgnored: number;
    unchanged: number;
    alreadyIgnored: number;
    chartsCleared: number;
  };
};

type ImportValidationErrorResponse = { ok: false; errors: string[] };

type ImportPanelState =
  | { phase: 'picking' }
  | { phase: 'previewing' }
  | { phase: 'preview-error'; errors: string[] }
  | { phase: 'preview-ready'; file: File; preview: ImportPreviewResponse }
  | { phase: 'applying'; file: File }
  | { phase: 'apply-error'; errors: string[] }
  | { phase: 'applied'; result: ImportApplyResponse['result'] };

// Localized date+time, e.g. "Sep 7, 2026, 4:35 PM" - shown in the viewer's local timezone
// since format() operates on the Date object's local representation.
function formatTimestamp(iso: string): string {
  return format(new Date(iso), 'PP p');
}

function formatValue(field: string, value: unknown): string {
  if (field === 'submittedAt' && typeof value === 'string') return formatTimestamp(value);
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(none)';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

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

// Mirrors the conventional diff coloring (added/modified/removed) so the three kinds of
// change read at a glance, consistently across the summary, table, and result badges.
const CHANGE_KIND_CLASS = {
  insert:
    'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400',
  update: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
  ignore: 'border-transparent bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
} as const;

// Same tone driving the amber/red "Success"/"Error" badge above, applied to the whole row so
// an ignored or errored row draws the reviewer's eye without scanning the Status column - the
// expanded detail row gets a lighter tint of the same color, one step down.
const ROW_TONE_CLASS = {
  ignored: 'bg-amber-100 dark:bg-amber-500/25',
  error: 'bg-red-100 dark:bg-red-500/25',
} as const;
const ROW_TONE_EXPANDED_CLASS = {
  ignored: 'bg-amber-50 dark:bg-amber-500/10',
  error: 'bg-red-50 dark:bg-red-500/10',
} as const;

type RowTone = keyof typeof ROW_TONE_CLASS;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CopyFileIdButton({ fileId }: { fileId: string }) {
  return (
    <CopyButton value={fileId} title={fileId}>
      <span className="truncate">{fileId.slice(0, 10)}…</span>
    </CopyButton>
  );
}

function Dropzone({
  disabled,
  selectedFile,
  onSelect,
  onClear,
}: {
  disabled: boolean;
  selectedFile: File | null;
  onSelect: (file: File) => void;
  onClear: () => void;
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    disabled,
    multiple: false,
    accept: { 'application/json': ['.json'] },
    onDrop: (acceptedFiles) => {
      if (acceptedFiles[0]) onSelect(acceptedFiles[0]);
    },
  });

  if (selectedFile) {
    return (
      <div
        {...getRootProps()}
        className={cn(
          'border-primary/50 bg-primary/5 flex items-center gap-3 rounded-md border-2 p-4 text-sm transition-colors',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          isDragActive && 'border-primary bg-primary/10',
        )}
      >
        <input {...getInputProps()} />
        <FileJson className="text-primary size-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-medium">
            <CircleCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate">{selectedFile.name}</span>
          </p>
          <p className="text-muted-foreground">
            {formatFileSize(selectedFile.size)} ·{' '}
            {isDragActive ? 'Drop to replace' : 'Click or drop to replace'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        >
          <X />
          <span className="sr-only">Remove file</span>
        </Button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex flex-col items-center gap-1 rounded-md border border-dashed p-8 text-center text-sm transition-colors',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        isDragActive ? 'border-primary bg-muted/50' : 'border-input hover:bg-muted/30',
      )}
    >
      <input {...getInputProps()} />
      <UploadCloud className="text-muted-foreground size-6" />
      <p className="text-muted-foreground">
        {isDragActive
          ? 'Drop submissions.json here'
          : 'Drag & drop submissions.json, or click to browse'}
      </p>
    </div>
  );
}

async function postFile<T>(url: string, file: File): Promise<T | ImportValidationErrorResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(url, { method: 'POST', body: form });
  const body = (await res.json().catch(() => null)) as T | ImportValidationErrorResponse | null;
  if (!body) {
    return { ok: false, errors: ["Couldn't reach the server. Try again."] };
  }
  return body;
}

export function ImportPanel({ eventSlug }: { eventSlug: string }) {
  const [state, setState] = useState<ImportPanelState>({ phase: 'picking' });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function handlePreview() {
    if (!pendingFile) return;
    const file = pendingFile;
    setState({ phase: 'previewing' });
    const body = await postFile<ImportPreviewResponse>(
      `/api/events/${eventSlug}/import/preview`,
      file,
    );
    if (!body.ok) {
      setState({ phase: 'preview-error', errors: body.errors });
      return;
    }
    setState({ phase: 'preview-ready', file, preview: body });
  }

  async function handleApply(file: File) {
    setState({ phase: 'applying', file });
    const body = await postFile<ImportApplyResponse>(`/api/events/${eventSlug}/import/apply`, file);
    if (!body.ok) {
      setState({ phase: 'apply-error', errors: body.errors });
      return;
    }
    setState({ phase: 'applied', result: body.result });
  }

  function reset() {
    setPendingFile(null);
    setExpanded(new Set());
    setState({ phase: 'picking' });
  }

  function toggleExpanded(fileId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }

  if (state.phase === 'picking' || state.phase === 'previewing') {
    return (
      <div className="flex flex-col gap-3">
        <Dropzone
          disabled={state.phase === 'previewing'}
          selectedFile={pendingFile}
          onSelect={setPendingFile}
          onClear={() => setPendingFile(null)}
        />
        <div>
          <Button disabled={!pendingFile || state.phase === 'previewing'} onClick={handlePreview}>
            {state.phase === 'previewing' ? 'Previewing…' : 'Preview'}
          </Button>
        </div>
      </div>
    );
  }

  if (state.phase === 'preview-error' || state.phase === 'apply-error') {
    return (
      <div className="flex flex-col gap-3">
        <div className="border-destructive/50 rounded-md border p-4">
          <ul className="list-disc space-y-1 pl-4">
            {state.errors.map((error, i) => (
              <li key={i} className="text-destructive text-sm">
                {error}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <Button variant="outline" onClick={reset}>
            Choose a different file
          </Button>
        </div>
      </div>
    );
  }

  if (state.phase === 'applying') {
    return <p className="text-muted-foreground text-sm">Applying import…</p>;
  }

  if (state.phase === 'applied') {
    const { result } = state;
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge className={CHANGE_KIND_CLASS.insert}>{result.inserted} inserted</Badge>
          <Badge className={CHANGE_KIND_CLASS.update}>{result.updated} updated</Badge>
          <Badge className={CHANGE_KIND_CLASS.ignore}>{result.newlyIgnored} newly ignored</Badge>
          <Badge className={CHANGE_KIND_CLASS.ignore}>
            {result.chartsCleared} chart(s) cleared
          </Badge>
          <Badge variant="outline">{result.unchanged} unchanged</Badge>
          <Badge variant="outline">{result.alreadyIgnored} already ignored</Badge>
        </div>
        <div>
          <Button onClick={reset}>Run another import</Button>
        </div>
      </div>
    );
  }

  // preview-ready
  const { file, preview } = state;
  const actionableRows: {
    row: SubmissionRowSummary;
    kind: string;
    changedFields?: FieldChange[];
    chart?: ChartFields | null;
    previousChart?: ChartFields | null;
    submission?: SubmissionFields;
    previousSubmission?: SubmissionFields | null;
  }[] = [
    ...preview.inserts.map((row) => ({
      row,
      kind: 'Insert',
      chart: row.chart,
      submission: row.submission,
    })),
    ...preview.updates.map((u) => ({
      row: u,
      kind: 'Update',
      changedFields: u.changedFields,
      chart: u.chart,
      previousChart: u.previousChart,
      submission: u.submission,
      previousSubmission: u.previousSubmission,
    })),
    ...preview.newlyIgnored.map((row) => ({ row, kind: 'Newly ignored' })),
    ...preview.chartCleanup.map((row) => ({ row, kind: 'Chart cleared' })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge className={CHANGE_KIND_CLASS.insert}>{preview.summary.toInsert} to insert</Badge>
        <Badge className={CHANGE_KIND_CLASS.update}>{preview.summary.toUpdate} to update</Badge>
        <Badge className={CHANGE_KIND_CLASS.ignore}>{preview.summary.toIgnore} to ignore</Badge>
        <Badge className={CHANGE_KIND_CLASS.ignore}>
          {preview.chartCleanup.length} chart(s) to clear
        </Badge>
        <Badge variant="outline">{preview.summary.unchanged} unchanged</Badge>
        <Badge variant="outline">{preview.summary.alreadyIgnored} already ignored</Badge>
      </div>

      {actionableRows.length > 0 && (
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
              <TableHead>Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actionableRows.map((actionableRow) => {
              const {
                row,
                kind,
                changedFields,
                chart,
                previousChart,
                submission,
                previousSubmission,
              } = actionableRow;
              const expandable =
                Boolean(chart) || Boolean(submission) || Boolean(changedFields?.length);
              const nonChartChanges = changedFields?.filter(
                (c) => c.field !== 'chart' && c.field !== 'chart.hash',
              );
              const rowTone: RowTone | null =
                row.status !== 'Success' ? 'error' : submission?.isIgnored ? 'ignored' : null;
              return (
                <Fragment key={row.fileId}>
                  <TableRow
                    className={cn(
                      expandable && 'cursor-pointer',
                      rowTone && ROW_TONE_CLASS[rowTone],
                    )}
                    onClick={expandable ? () => toggleExpanded(row.fileId) : undefined}
                  >
                    <TableCell className="w-4">
                      {expandable && (
                        <ChevronRight
                          className={cn(
                            'text-muted-foreground size-4 transition-transform',
                            expanded.has(row.fileId) && 'rotate-90',
                          )}
                        />
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatTimestamp(row.submittedAt)}
                    </TableCell>
                    <TableCell>{row.submitter}</TableCell>
                    <TableCell>{row.stepartist}</TableCell>
                    <TableCell>
                      <ChartCell chart={chart} submission={submission} pack={row.pack} />
                    </TableCell>
                    <TableCell>
                      <CopyFileIdButton fileId={row.fileId} />
                    </TableCell>
                    <TableCell>
                      {row.status === 'Success' ? (
                        submission?.isIgnored ? (
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
                          <TooltipContent>{row.status}</TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          kind === 'Insert'
                            ? CHANGE_KIND_CLASS.insert
                            : kind === 'Update'
                              ? CHANGE_KIND_CLASS.update
                              : CHANGE_KIND_CLASS.ignore
                        }
                      >
                        {kind}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {expandable && expanded.has(row.fileId) && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className={cn(
                          'whitespace-normal',
                          rowTone ? ROW_TONE_EXPANDED_CLASS[rowTone] : 'bg-muted/30',
                        )}
                      >
                        {nonChartChanges && nonChartChanges.length > 0 && (
                          <ul className="space-y-1 text-xs">
                            {nonChartChanges.map((change) => (
                              <li key={change.field}>
                                <span className="font-medium">{change.field}</span>:{' '}
                                {formatValue(change.field, change.from)} →{' '}
                                {formatValue(change.field, change.to)}
                              </li>
                            ))}
                          </ul>
                        )}
                        {submission && (
                          <SubmissionDetail
                            submission={submission}
                            previousSubmission={previousSubmission}
                            fileId={row.fileId}
                          />
                        )}
                        {chart && <ChartDetail chart={chart} previousChart={previousChart} />}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}

      <div className="flex gap-2">
        <Button onClick={() => handleApply(file)}>Confirm import</Button>
        <Button variant="outline" onClick={reset}>
          Choose a different file
        </Button>
      </div>
    </div>
  );
}
