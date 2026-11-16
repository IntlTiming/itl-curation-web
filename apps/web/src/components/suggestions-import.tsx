import { cn } from 'cn';
import { ChevronRight } from 'lucide-react';
import { Fragment, useState } from 'react';
import { CHANGE_KIND_CLASS, FileImportFlow, formatValue } from '@/components/file-import-flow';
import { formatTimestamp } from '@/components/submission-row';
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
import { useFileImport } from '@/hooks/use-file-import';

type SuggestionFields = {
  position: number;
  submittedAt: string;
  submitter: string;
  chart: string;
  reason: string;
  link: string;
  consentToPublicReview: string | null;
};

type FieldChange = { field: string; from: unknown; to: unknown };

type SuggestionsImportPreviewResponse = {
  ok: true;
  summary: {
    totalInFile: number;
    totalExistingInDb: number;
    toInsert: number;
    toUpdate: number;
    unchanged: number;
  };
  inserts: SuggestionFields[];
  updates: (SuggestionFields & {
    previous: SuggestionFields;
    changedFields: FieldChange[];
  })[];
};

type SuggestionsImportApplyResult = {
  inserted: number;
  updated: number;
  unchanged: number;
};

type ChangeKind = 'Insert' | 'Update';

const KIND_CLASS: Record<ChangeKind, string> = {
  Insert: CHANGE_KIND_CLASS.insert,
  Update: CHANGE_KIND_CLASS.update,
};

const DETAIL_FIELDS: { field: keyof SuggestionFields; label: string }[] = [
  { field: 'submittedAt', label: 'Submitted' },
  { field: 'submitter', label: 'Submitter' },
  { field: 'chart', label: 'Chart' },
  { field: 'reason', label: 'Reason' },
  { field: 'link', label: 'Link' },
  { field: 'consentToPublicReview', label: 'Consent' },
];

function SuggestionsImportPreview({
  preview,
  onConfirm,
  onReset,
}: {
  preview: SuggestionsImportPreviewResponse;
  onConfirm: () => void;
  onReset: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggleExpanded(position: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(position)) next.delete(position);
      else next.add(position);
      return next;
    });
  }

  const rows: {
    row: SuggestionFields;
    kind: ChangeKind;
    changedFields?: FieldChange[];
  }[] = [
    ...preview.inserts.map((row) => ({ row, kind: 'Insert' as const })),
    ...preview.updates.map((u) => ({
      row: u,
      kind: 'Update' as const,
      changedFields: u.changedFields,
    })),
  ].sort((a, b) => a.row.position - b.row.position);

  const { summary } = preview;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge className={CHANGE_KIND_CLASS.insert}>{summary.toInsert} to insert</Badge>
        <Badge className={CHANGE_KIND_CLASS.update}>{summary.toUpdate} to update</Badge>
        <Badge variant="outline">{summary.unchanged} unchanged</Badge>
      </div>

      {rows.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>#</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Submitter</TableHead>
              <TableHead>Chart</TableHead>
              <TableHead>Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ row, kind, changedFields }) => {
              const isOpen = expanded.has(row.position);
              return (
                <Fragment key={row.position}>
                  <TableRow className="cursor-pointer" onClick={() => toggleExpanded(row.position)}>
                    <TableCell className="w-4">
                      <ChevronRight
                        className={cn(
                          'text-muted-foreground size-4 transition-transform',
                          isOpen && 'rotate-90',
                        )}
                      />
                    </TableCell>
                    <TableCell className="tabular-nums">{row.position}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatTimestamp(row.submittedAt)}
                    </TableCell>
                    <TableCell>{row.submitter}</TableCell>
                    <TableCell className="max-w-md truncate">{row.chart}</TableCell>
                    <TableCell>
                      <Badge className={KIND_CLASS[kind]}>{kind}</Badge>
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/30 whitespace-normal">
                        {changedFields && changedFields.length > 0 ? (
                          <ul className="space-y-1 text-xs">
                            {changedFields.map((change) => (
                              <li key={change.field}>
                                <span className="font-medium">{change.field}</span>:{' '}
                                {formatValue(change.field, change.from)} →{' '}
                                {formatValue(change.field, change.to)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
                            {DETAIL_FIELDS.map(({ field, label }) => (
                              <Fragment key={field}>
                                <dt className="text-muted-foreground">{label}</dt>
                                <dd className="break-words">{formatValue(field, row[field])}</dd>
                              </Fragment>
                            ))}
                          </dl>
                        )}
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

export function SuggestionsImport({ eventSlug }: { eventSlug: string }) {
  const importer = useFileImport<SuggestionsImportPreviewResponse, SuggestionsImportApplyResult>(
    `/api/events/${eventSlug}/import/suggestions`,
  );
  return (
    <FileImportFlow
      fileName="suggestions.json"
      importer={importer}
      renderPreview={(preview, onConfirm, onReset) => (
        <SuggestionsImportPreview preview={preview} onConfirm={onConfirm} onReset={onReset} />
      )}
      renderApplied={(result) => (
        <div className="flex flex-wrap gap-2">
          <Badge className={CHANGE_KIND_CLASS.insert}>{result.inserted} inserted</Badge>
          <Badge className={CHANGE_KIND_CLASS.update}>{result.updated} updated</Badge>
          <Badge variant="outline">{result.unchanged} unchanged</Badge>
        </div>
      )}
    />
  );
}
