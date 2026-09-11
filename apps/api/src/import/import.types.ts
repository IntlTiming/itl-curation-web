import type { CmodPreference, ConsentToPublicReview, Difficulty, Playstyle } from '@prisma/client';

export type NormalizedChart = {
  hash: string;
  title: string;
  titleRomaji: string;
  subtitle: string;
  subtitleRomaji: string;
  artist: string;
  artistRomaji: string;
  playstyle: Playstyle;
  difficulty: Difficulty;
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
  weightedNps: number; // thousandths-scaled Int, e.g. 8667 = 8.667
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

// The mapper's normalized shape for one submissions.json entry - already resolved to
// Prisma-shaped values (enums, tech tag ids, thousandths-scaled nps), never raw JSON.
export type NormalizedSubmissionInput = {
  fileId: string;
  submitter: string;
  stepartist: string;
  pack: string;
  playstyle: Playstyle;
  difficulty: Difficulty;
  focus: string;
  derivedFocus: string;
  cmodPreference: CmodPreference;
  releaseYear: string;
  theme: string;
  additionalNotes: string;
  consentToPublicReview: ConsentToPublicReview | null;
  fileUrl: string;
  driveMd5: string;
  processingError: string | null;
  songDir: string | null;
  bannerSlug: string;
  isInternal: boolean;
  submittedAt: Date; // pipeline's "timestamp_utc"
  isIgnored: boolean; // mirrors the pipeline's "is_ignored" - mapped like any other field while present
  techTagIds: string[]; // resolved TechTag ids for tech_represented - order-independent set
  singleTechTagId: string | null;
  chart: NormalizedChart | null;
};

// A DB snapshot row for diffing carries the same shape as what the file would produce.
export type ExistingSubmissionSnapshot = NormalizedSubmissionInput;

export type SubmissionRowSummary = {
  fileId: string;
  submittedAt: Date;
  submitter: string;
  stepartist: string;
  pack: string;
  songDir: string | null;
  status: string; // "Success" or the pipeline's raw "Error: <message>" text - mirrors processingError
};

// A row missing entirely from the current file - treated as "is_ignored: true, chart: null"
// rather than deleted, per the file-never-deletes-rows rule.
export type MissingSubmissionRow = SubmissionRowSummary & { chartCleared: boolean };

export type FieldChange = { field: string; from: unknown; to: unknown };

export type ChartOp = 'none' | 'create' | 'update' | 'delete';

export type ImportInsert = { input: NormalizedSubmissionInput; row: SubmissionRowSummary };

export type ImportUpdate = {
  input: NormalizedSubmissionInput;
  row: SubmissionRowSummary;
  changedFields: FieldChange[];
  chartOp: ChartOp;
  techTagsChanged: boolean;
  previousChart: NormalizedChart | null; // for display only - the write path only ever uses chartOp
  previousInput: NormalizedSubmissionInput; // for display only, same reason
};

// Display-only mirror of NormalizedSubmissionInput - every field from the file should be
// checkable here so a curator can confirm the import read the file correctly. Drops only
// fileId (shown as its own column) and the raw chart object (shown via the chart panel).
// techTagIds/singleTechTagId are resolved from ids to their labels for display.
export type SubmissionDetailFields = {
  submitter: string;
  stepartist: string;
  pack: string;
  playstyle: Playstyle; // submitter-claimed - can differ from the chart's own parsed value
  difficulty: Difficulty; // submitter-claimed - can differ from the chart's own parsed value
  focus: string;
  derivedFocus: string;
  cmodPreference: CmodPreference;
  releaseYear: string;
  theme: string;
  additionalNotes: string;
  consentToPublicReview: ConsentToPublicReview | null;
  fileUrl: string;
  driveMd5: string;
  processingError: string | null;
  songDir: string | null;
  bannerSlug: string;
  isInternal: boolean;
  submittedAt: Date;
  isIgnored: boolean;
  techTags: string[]; // resolved TechTag labels, for display only
  singleTechTag: string | null; // resolved TechTag label, for display only
};

export type ImportDiff = {
  summary: {
    totalInFile: number;
    totalExistingInDb: number;
    toInsert: number;
    toUpdate: number;
    toIgnore: number;
    unchanged: number;
    alreadyIgnored: number;
  };
  inserts: ImportInsert[];
  updates: ImportUpdate[];
  // isIgnored transitioning false -> true this run (fileId dropped out of the file).
  newlyIgnored: MissingSubmissionRow[];
  // Already isIgnored=true and still missing, but had a lingering chart that's being
  // nulled now to catch up with the "missing = ignored + no chart" invariant.
  chartCleanup: MissingSubmissionRow[];
};

export type ImportValidationErrorResponse = { ok: false; errors: string[] };

export type ImportPreviewResponse = {
  ok: true;
  summary: ImportDiff['summary'];
  inserts: (SubmissionRowSummary & {
    chart: NormalizedChart | null;
    submission: SubmissionDetailFields;
  })[];
  updates: (SubmissionRowSummary & {
    changedFields: FieldChange[];
    chart: NormalizedChart | null;
    previousChart: NormalizedChart | null;
    submission: SubmissionDetailFields;
    previousSubmission: SubmissionDetailFields;
  })[];
  newlyIgnored: MissingSubmissionRow[];
  chartCleanup: MissingSubmissionRow[];
};

export type ImportApplyResponse = {
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
