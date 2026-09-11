import { cn } from 'cn';
import { CopyButton } from '@/components/copy-button';
import { Badge } from '@/components/ui/badge';

export type ChartFields = {
  hash: string;
  title: string;
  titleRomaji: string;
  subtitle: string;
  subtitleRomaji: string;
  artist: string;
  artistRomaji: string;
  playstyle: string;
  difficulty: string;
  meter: number;
  minBpm: number;
  maxBpm: number;
  totalSteps: number;
  totalRolls: number;
  totalHolds: number;
  totalMines: number;
  totalJumps: number;
  lengthSeconds: number;
  totalMeasures: number;
  totalBreakMeasures: number;
  totalStreamMeasures: number;
  totalTrueStreamMeasures: number;
  weightedNps: number;
  hasSignificantTimingChanges: boolean;
  bracketCount: number | null;
  halfCrossoverCount: number | null;
  fullCrossoverCount: number | null;
  crossoverCount: number | null;
  downFootswitchCount: number | null;
  upFootswitchCount: number | null;
  footswitchCount: number | null;
  doublestepCount: number | null;
  jackCount: number | null;
  sideswitchCount: number | null;
};

export const PLAYSTYLE_LETTER: Record<string, string> = { SINGLE: 'S', DOUBLE: 'D' };
export const DIFFICULTY_LETTER: Record<string, string> = {
  BEGINNER: 'N',
  EASY: 'E',
  MEDIUM: 'M',
  HARD: 'H',
  CHALLENGE: 'X',
};

// e.g. "SX13" - playstyle letter + difficulty letter + meter, the compact shorthand used
// wherever a chart needs a one-glance identifier. meter is optional since the submission's
// own claimed playstyle/difficulty (as opposed to the chart's parsed values) has no meter
// at all - that case renders as just "SX".
export function chartBadgeLabel(chart: {
  playstyle: string;
  difficulty: string;
  meter?: number;
}): string {
  const playstyle = PLAYSTYLE_LETTER[chart.playstyle] ?? '?';
  const difficulty = DIFFICULTY_LETTER[chart.difficulty] ?? '?';
  return chart.meter === undefined
    ? `${playstyle}${difficulty}`
    : `${playstyle}${difficulty}${chart.meter}`;
}

// Colors sourced from itl-online-2026's ChartDifficultyDisplay.scss (its Light*/Dark* HSL
// pairs per difficulty) - only the color values are borrowed, this badge's layout/markup
// is our own, not copied from that repo.
const DIFFICULTY_BADGE_CLASS: Record<string, string> = {
  BEGINNER: 'bg-[hsl(277,100%,78%)] text-black dark:bg-[hsl(277,100%,22%)] dark:text-white',
  EASY: 'bg-[hsl(117,89%,71%)] text-black dark:bg-[hsl(117,89%,29%)] dark:text-white',
  MEDIUM: 'bg-[hsl(59,100%,75%)] text-black dark:bg-[hsl(59,100%,25%)] dark:text-white',
  HARD: 'bg-[hsl(0,100%,70%)] text-black dark:bg-[hsl(0,100%,30%)] dark:text-white',
  CHALLENGE: 'bg-[hsl(212,100%,70%)] text-black dark:bg-[hsl(212,100%,30%)] dark:text-white',
};

// small renders a more compact badge so it can sit inline alongside a text field label
// (see the "Difficulty" field row below) or inline in a table cell, rather than as the
// prominent header badge.
export function DifficultyBadge({
  label,
  difficulty,
  small,
}: {
  label: string;
  difficulty: string;
  small?: boolean;
}) {
  return (
    <Badge
      className={cn(DIFFICULTY_BADGE_CLASS[difficulty] ?? '', small && 'h-4 px-1.5 text-[10px]')}
    >
      {label}
    </Badge>
  );
}

function fmt(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function formatMinutesSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

type FieldDef = { key: string; label: string; getDisplay: (chart: ChartFields) => string };

function simpleField(
  key: keyof ChartFields,
  label: string,
  format?: (value: unknown) => string,
): FieldDef {
  return { key, label, getDisplay: (chart) => (format ? format(chart[key]) : fmt(chart[key])) };
}

// "{value} / {romaji}" when a romaji translit exists, else just the value - the romaji
// fields are "" when the simfile has no translit tag (see the Chart schema comment).
function titleField(
  key: string,
  label: string,
  mainKey: keyof ChartFields,
  romajiKey: keyof ChartFields,
): FieldDef {
  return {
    key,
    label,
    getDisplay: (chart) => {
      const main = String(chart[mainKey]);
      const romaji = String(chart[romajiKey]);
      return romaji ? `${main} / ${romaji}` : main;
    },
  };
}

// Identity fields, rendered first - title/subtitle/artist collapse with their romaji
// counterpart into one row instead of two.
const IDENTITY_FIELD_DEFS: FieldDef[] = [
  titleField('title', 'Title', 'title', 'titleRomaji'),
  titleField('subtitle', 'Subtitle', 'subtitle', 'subtitleRomaji'),
  titleField('artist', 'Artist', 'artist', 'artistRomaji'),
];

// "114" when the chart has no BPM change, else "114–120".
const BPM_FIELD: FieldDef = {
  key: 'bpm',
  label: 'BPM',
  getDisplay: (chart) =>
    chart.minBpm === chart.maxBpm ? `${chart.minBpm}` : `${chart.minBpm}–${chart.maxBpm}`,
};

// "12 (5↓ / 7↑)" - total, then the down/up split in parens.
const FOOTSWITCH_FIELD: FieldDef = {
  key: 'footswitches',
  label: 'Footswitches',
  getDisplay: (chart) =>
    `${fmt(chart.footswitchCount)} (${fmt(chart.downFootswitchCount)}↓ / ${fmt(chart.upFootswitchCount)}↑)`,
};

// "12 (5h / 7f)" - total, then the half/full split in parens.
const CROSSOVER_FIELD: FieldDef = {
  key: 'crossovers',
  label: 'Crossovers',
  getDisplay: (chart) =>
    `${fmt(chart.crossoverCount)} (${fmt(chart.halfCrossoverCount)}h / ${fmt(chart.fullCrossoverCount)}f)`,
};

// Everything else - playstyle/meter stay condensed into the inline Difficulty row's badge,
// not repeated as their own rows.
const REST_FIELD_DEFS: FieldDef[] = [
  BPM_FIELD,
  simpleField('lengthSeconds', 'Length', (v) => formatMinutesSeconds(v as number)),
  simpleField('totalSteps', 'Steps'),
  simpleField('totalHolds', 'Holds'),
  simpleField('totalRolls', 'Rolls'),
  simpleField('totalMines', 'Mines'),
  simpleField('totalJumps', 'Jumps'),
  simpleField('totalMeasures', 'Measures'),
  simpleField('totalBreakMeasures', 'Break measures'),
  simpleField('totalStreamMeasures', 'Stream measures'),
  simpleField('totalTrueStreamMeasures', 'True stream measures'),
  simpleField('weightedNps', 'Weighted NPS', (v) => (v as number).toFixed(3)),
  simpleField('hasSignificantTimingChanges', 'Significant timing changes'),
  simpleField('bracketCount', 'Brackets'),
  CROSSOVER_FIELD,
  FOOTSWITCH_FIELD,
  simpleField('doublestepCount', 'Doublesteps'),
  simpleField('jackCount', 'Jacks'),
  simpleField('sideswitchCount', 'Sideswitches'),
];

function FieldRow({
  fieldDef: { label, getDisplay },
  chart,
  previousChart,
}: {
  fieldDef: FieldDef;
  chart: ChartFields;
  previousChart?: ChartFields | null;
}) {
  const display = getDisplay(chart);
  const priorDisplay = previousChart ? getDisplay(previousChart) : null;
  if (priorDisplay === null || priorDisplay === display) {
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

// The first N columns are fixed to this content, in this order. Whatever's left fills the
// remaining columns, in normal order, split as evenly as possible.
const TOTAL_COLUMNS = 4;
const FIXED_COLUMN_KEYS = [
  [
    'title',
    'subtitle',
    'artist',
    'difficulty',
    'lengthSeconds',
    'bpm',
    'hasSignificantTimingChanges',
  ],
  ['totalSteps', 'totalHolds', 'totalRolls', 'totalMines', 'totalJumps', 'jackCount'],
  ['crossovers', 'footswitches', 'bracketCount', 'doublestepCount', 'sideswitchCount'],
];

// previousChart omitted/null renders plainly (a brand-new chart, or one that hasn't
// changed). Passing a previousChart highlights each field that actually differs -
// label and new value in amber, old value struck through - so a reviewer can see
// exactly which measurements moved on a re-parse, even though the chart is written
// as a single hash-gated unit rather than field by field.
export function ChartDetail({
  chart,
  previousChart,
}: {
  chart: ChartFields;
  previousChart?: ChartFields | null;
}) {
  const difficultyRow = {
    key: 'difficulty',
    node: (
      <div key="difficulty">
        <span className="text-muted-foreground">Difficulty:</span>{' '}
        <DifficultyBadge label={chartBadgeLabel(chart)} difficulty={chart.difficulty} small />
      </div>
    ),
  };
  // Unlike other fields, the hash isn't diffed/highlighted here even on an update - it's
  // exactly what chartOp is already gated on, so a change is implied by the row existing
  // at all; showing it struck-through/new would just repeat that signal in raw hash form.
  const hashRow = {
    key: 'hash',
    node: (
      <div key="hash">
        <span className="text-muted-foreground">Hash:</span>{' '}
        <CopyButton value={chart.hash} className="align-middle">
          {chart.hash}
        </CopyButton>
      </div>
    ),
  };
  const allRows = [
    ...IDENTITY_FIELD_DEFS.map((fieldDef) => ({
      key: fieldDef.key,
      node: (
        <FieldRow
          key={fieldDef.key}
          fieldDef={fieldDef}
          chart={chart}
          previousChart={previousChart}
        />
      ),
    })),
    difficultyRow,
    ...REST_FIELD_DEFS.map((fieldDef) => ({
      key: fieldDef.key,
      node: (
        <FieldRow
          key={fieldDef.key}
          fieldDef={fieldDef}
          chart={chart}
          previousChart={previousChart}
        />
      ),
    })),
    hashRow,
  ];

  const byKey = new Map(allRows.map((row) => [row.key, row]));
  const fixedColumns = FIXED_COLUMN_KEYS.map((keys) => keys.map((key) => byKey.get(key)!));
  const fixedKeys = new Set(FIXED_COLUMN_KEYS.flat());
  const remainingRows = allRows.filter((row) => !fixedKeys.has(row.key));
  const autoColumnCount = TOTAL_COLUMNS - FIXED_COLUMN_KEYS.length;
  const perColumn = Math.ceil(remainingRows.length / autoColumnCount);
  const columns = [...fixedColumns];
  for (let i = 0; i < autoColumnCount; i++) {
    columns.push(remainingRows.slice(i * perColumn, (i + 1) * perColumn));
  }

  return (
    <div className="py-2">
      <p className="mb-1 text-left text-xs font-semibold">Chart</p>
      {/* Fixed 4 columns, not responsive - this expands inline in a curator's review table,
          a desktop-only workflow, so it isn't worth collapsing for narrow viewports. */}
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
