import { format } from 'date-fns';
import { chartBadgeLabel, DifficultyBadge } from '@/components/chart-detail';
import { CopyButton } from '@/components/copy-button';
import { Badge } from '@/components/ui/badge';

export type SubmissionFields = {
  submitter: string;
  stepartist: string;
  pack: string;
  playstyle: string;
  difficulty: string;
  focus: string;
  derivedFocus: string;
  cmodPreference: string;
  releaseYear: string;
  theme: string;
  additionalNotes: string;
  consentToPublicReview: string | null;
  fileUrl: string;
  driveMd5: string;
  processingError: string | null;
  songDir: string | null;
  bannerSlug: string;
  isInternal: boolean;
  submittedAt: string;
  isIgnored: boolean;
  techTags: string[];
  singleTechTag: string | null;
};

// Mirrors apps/api/src/events/tech-tags.seed-data.ts's label->code table (no shared
// package between frontend/backend here, same as the rest of this codebase's boundary
// types) - display-only, so an unmapped label just falls back to its full label below.
const TECH_TAG_CODE: Record<string, string> = {
  'Brackets (includes Bracket Taps)': 'BR',
  Crossovers: 'XO',
  Footswitches: 'FS',
  Jacks: 'JA',
  Sideswitches: 'SS',
  'Doublesteps w/ Mines': 'Mine-DS',
  'Holds/Rolls (Wadatsumis; Footswitching holds; Holdstream)': 'Holds-Rolls',
  'Center-tech': 'CT',
  'Mine dodge': 'MD',
  Kickswitches: 'KS',
  'Bursts (includes Drills)': 'BU',
  'Rhythms (Swing)': 'RH-SW',
  'Rhythms (Skittles)': 'RH-SK',
  Stepjumps: 'SJ',
  Flams: 'FL',
  'Doublesteps w/ Holds': 'Hold-DS',
  '(Doubles) Stretch': 'ST',
  '(Doubles) Movement': 'MV',
  '(Doubles) Center/Transitions': 'DUB-CT',
  '(Doubles) Half-Doubles': 'DUB-HD',
};

function shortenTechTag(label: string): string {
  return TECH_TAG_CODE[label] ?? label;
}

const CONSENT_LABEL: Record<string, string> = {
  CONSENTS: 'Yes',
  DOES_NOT_CONSENT: 'No',
  NOT_STEPARTIST: 'Unauthorized',
};

const CMOD_LABEL: Record<string, string> = {
  CMOD_OKAY: 'CMOD OKAY',
  NO_CMOD: 'NO CMOD',
  NOT_STEPARTIST: 'Unauthorized',
};

function fmt(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(none)';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

// Drive MD5 and banner slug are long enough to blow past the last column's width - shown as
// a glance-friendly truncated prefix rather than the full value.
function truncate(value: string, length = 12): string {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}

// Localized date+time - same convention as import-panel.tsx's formatTimestamp.
function formatTimestamp(iso: string): string {
  return format(new Date(iso), 'PP p');
}

type FieldDef = {
  key: keyof SubmissionFields;
  label: string;
  format?: (value: unknown) => string;
};

const FIELD_DEFS: FieldDef[] = [
  { key: 'submitter', label: 'Submitter' },
  { key: 'stepartist', label: 'Stepartist' },
  { key: 'pack', label: 'Pack' },
  { key: 'songDir', label: 'Song dir' },
  { key: 'focus', label: 'Focus' },
  { key: 'derivedFocus', label: 'Derived focus' },
  {
    key: 'techTags',
    label: 'Tech tags',
    format: (v) => {
      const labels = v as string[];
      return labels.length ? labels.map(shortenTechTag).join(', ') : '(none)';
    },
  },
  {
    key: 'singleTechTag',
    label: 'Single tech tag',
    format: (v) => (v ? shortenTechTag(v as string) : '—'),
  },
  {
    key: 'cmodPreference',
    label: 'Cmod preference',
    format: (v) => CMOD_LABEL[v as string] ?? String(v),
  },
  { key: 'releaseYear', label: 'Release year' },
  { key: 'theme', label: 'Theme' },
  {
    key: 'consentToPublicReview',
    label: 'Consent to public review',
    format: (v) => (v === null ? '—' : (CONSENT_LABEL[v as string] ?? String(v))),
  },
  { key: 'driveMd5', label: 'Drive MD5', format: (v) => truncate(fmt(v)) },
  { key: 'processingError', label: 'Processing error' },
  { key: 'bannerSlug', label: 'Banner slug', format: (v) => truncate(fmt(v)) },
  { key: 'isInternal', label: 'Internal' },
  { key: 'submittedAt', label: 'Submitted', format: (v) => formatTimestamp(v as string) },
  { key: 'isIgnored', label: 'Ignored' },
];

// Comparison happens on the already-formatted display string, not the raw value - fields
// like techTags are arrays, so raw equality would flag them as "changed" on every render
// (a fresh array from the same data) rather than only when the actual content differs.
function FieldRow({
  fieldDef: { key, label, format: fieldFormat },
  submission,
  previousSubmission,
}: {
  fieldDef: FieldDef;
  submission: SubmissionFields;
  previousSubmission?: SubmissionFields | null;
}) {
  const display = fieldFormat ? fieldFormat(submission[key]) : fmt(submission[key]);
  if (!previousSubmission) {
    return (
      <div>
        <span className="text-muted-foreground">{label}:</span> {display}
      </div>
    );
  }
  const priorDisplay = fieldFormat
    ? fieldFormat(previousSubmission[key])
    : fmt(previousSubmission[key]);
  if (priorDisplay === display) {
    return (
      <div>
        <span className="text-muted-foreground">{label}:</span> {display}
      </div>
    );
  }
  return (
    <div className="text-amber-700 dark:text-amber-400">
      <span className="font-medium">{label}:</span>{' '}
      <span className="text-muted-foreground line-through">{priorDisplay}</span> {display}
    </div>
  );
}

// Label and value sit on separate lines, and whitespace-pre-wrap preserves any newlines a
// submitter typed into the notes - the generic FieldRow renders label+value inline, which
// would collapse those newlines like any other HTML text.
function AdditionalNotesRow({
  submission,
  previousSubmission,
}: {
  submission: SubmissionFields;
  previousSubmission?: SubmissionFields | null;
}) {
  const display = fmt(submission.additionalNotes);
  const priorDisplay = previousSubmission ? fmt(previousSubmission.additionalNotes) : null;
  if (priorDisplay === null || priorDisplay === display) {
    return (
      <div>
        <div className="text-muted-foreground">Additional notes:</div>
        <div className="whitespace-pre-wrap">{display}</div>
      </div>
    );
  }
  return (
    <div className="text-amber-700 dark:text-amber-400">
      <div className="font-medium">Additional notes:</div>
      <div className="text-muted-foreground whitespace-pre-wrap line-through">{priorDisplay}</div>
      <div className="whitespace-pre-wrap">{display}</div>
    </div>
  );
}

// The first 3 columns are fixed to this content, in this order. The last column starts with
// its own fixed prefix (in order), then whatever rows aren't claimed by any of the above -
// unlike the other columns, it's a hybrid rather than fully fixed or fully automatic.
const FIXED_COLUMN_KEYS = [
  ['songDir', 'difficulty', 'submitter', 'stepartist', 'pack'],
  ['focus', 'singleTechTag', 'techTags', 'derivedFocus', 'cmodPreference', 'consentToPublicReview'],
  ['additionalNotes', 'theme', 'releaseYear', 'isInternal', 'isIgnored'],
];
const LAST_COLUMN_PREFIX_KEYS = [
  'submittedAt',
  'fileUrl',
  'driveMd5',
  'bannerSlug',
  'processingError',
];

// previousSubmission omitted/null renders plainly (a brand-new submission, or one that
// hasn't changed). Passing a previousSubmission highlights each field that actually
// differs, same convention as ChartDetail.
//
// fileId is optional: only the import preview passes it (row.fileId is already available
// there), swapping the "File URL: Drive link" row for a truncated, copyable "File ID" plus
// a separate "(Drive link)" hyperlink. Without it (e.g. the submissions list), the row falls
// back to the plain File URL link.
export function SubmissionDetail({
  submission,
  previousSubmission,
  fileId,
}: {
  submission: SubmissionFields;
  previousSubmission?: SubmissionFields | null;
  fileId?: string;
}) {
  const badgeLabel = chartBadgeLabel(submission);
  const priorBadgeLabel = previousSubmission ? chartBadgeLabel(previousSubmission) : null;
  const badgeChanged = priorBadgeLabel !== null && priorBadgeLabel !== badgeLabel;

  const difficultyRow = {
    key: 'difficulty',
    node: (
      <div key="difficulty" className="flex items-center gap-2">
        <span className="text-muted-foreground">Difficulty:</span>
        {badgeChanged && (
          <Badge variant="outline" className="text-muted-foreground line-through">
            {priorBadgeLabel}
          </Badge>
        )}
        <DifficultyBadge label={badgeLabel} difficulty={submission.difficulty} size="small" />
      </div>
    ),
  };
  const fileUrlRow = {
    key: 'fileUrl',
    node: fileId ? (
      <div key="fileUrl">
        <span className="text-muted-foreground">File ID:</span>{' '}
        <CopyButton value={fileId} title={fileId}>
          <span className="truncate">{fileId.slice(0, 10)}…</span>
        </CopyButton>{' '}
        <a
          href={submission.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline"
        >
          (Drive link)
        </a>
      </div>
    ) : (
      <div key="fileUrl">
        <span className="text-muted-foreground">File URL:</span>{' '}
        <a
          href={submission.fileUrl}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline"
        >
          Drive link
        </a>
      </div>
    ),
  };
  const additionalNotesRow = {
    key: 'additionalNotes',
    node: (
      <AdditionalNotesRow
        key="additionalNotes"
        submission={submission}
        previousSubmission={previousSubmission}
      />
    ),
  };
  const allRows = [
    difficultyRow,
    fileUrlRow,
    additionalNotesRow,
    ...FIELD_DEFS.map((fieldDef) => ({
      key: fieldDef.key,
      node: (
        <FieldRow
          key={fieldDef.key}
          fieldDef={fieldDef}
          submission={submission}
          previousSubmission={previousSubmission}
        />
      ),
    })),
  ];

  const byKey = new Map(allRows.map((row) => [row.key, row]));
  const fixedColumns = FIXED_COLUMN_KEYS.map((keys) => keys.map((key) => byKey.get(key)!));
  const lastColumnPrefix = LAST_COLUMN_PREFIX_KEYS.map((key) => byKey.get(key)!);
  const claimedKeys = new Set([...FIXED_COLUMN_KEYS.flat(), ...LAST_COLUMN_PREFIX_KEYS]);
  const remainingRows = allRows.filter((row) => !claimedKeys.has(row.key));
  const columns = [...fixedColumns, [...lastColumnPrefix, ...remainingRows]];

  return (
    <div className="py-2">
      <p className="mb-1 text-left text-xs font-semibold">Submission</p>
      <div className="grid grid-cols-4 gap-x-6 gap-y-1 text-xs">
        {columns.map((column, i) => (
          <div key={i} className="flex flex-col gap-1">
            {column.map((row) => row.node)}
          </div>
        ))}
      </div>
    </div>
  );
}
