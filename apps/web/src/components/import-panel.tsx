import { cn } from 'cn';
import { ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { ChartDetail, type ChartFields } from '@/components/chart-detail';
import { CHANGE_KIND_CLASS, FileImportFlow, formatValue } from '@/components/file-import-flow';
import { SubmissionDetail, type SubmissionFields } from '@/components/submission-detail';
import {
  ChartCell,
  CopyFileIdButton,
  formatTimestamp,
  ROW_TONE_CLASS,
  ROW_TONE_EXPANDED_CLASS,
  SubmissionStatusBadge,
  type RowTone,
} from '@/components/submission-row';
import { SuggestionsImport } from '@/components/suggestions-import';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFileImport } from '@/hooks/use-file-import';

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

function SubmissionsImportPreview({
  preview,
  onConfirm,
  onReset,
}: {
  preview: ImportPreviewResponse;
  onConfirm: () => void;
  onReset: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(fileId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }

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
                      <SubmissionStatusBadge
                        status={row.status}
                        isIgnored={submission?.isIgnored ?? false}
                      />
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
        <Button onClick={onConfirm}>Confirm import</Button>
        <Button variant="outline" onClick={onReset}>
          Choose a different file
        </Button>
      </div>
    </div>
  );
}

function SubmissionsImport({ eventSlug }: { eventSlug: string }) {
  const importer = useFileImport<ImportPreviewResponse, ImportApplyResponse['result']>(
    `/api/events/${eventSlug}/import`,
  );
  return (
    <FileImportFlow
      fileName="submissions.json"
      importer={importer}
      renderPreview={(preview, onConfirm, onReset) => (
        <SubmissionsImportPreview preview={preview} onConfirm={onConfirm} onReset={onReset} />
      )}
      renderApplied={(result) => (
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
      )}
    />
  );
}

type ImportKind = 'submissions' | 'suggestions';

export function ImportPanel({ eventSlug }: { eventSlug: string }) {
  const [kind, setKind] = useState<ImportKind>('submissions');
  return (
    <div className="flex flex-col gap-4">
      <Tabs value={kind} onValueChange={(value) => setKind(value as ImportKind)}>
        <TabsList>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
        </TabsList>
      </Tabs>
      {/* Keyed so switching kinds always starts from a fresh, empty picker. */}
      {kind === 'submissions' ? (
        <SubmissionsImport key="submissions" eventSlug={eventSlug} />
      ) : (
        <SuggestionsImport key="suggestions" eventSlug={eventSlug} />
      )}
    </div>
  );
}
