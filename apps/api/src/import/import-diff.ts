import type {
  ChartOp,
  ExistingSubmissionSnapshot,
  FieldChange,
  ImportDiff,
  MissingSubmissionRow,
  NormalizedSubmissionInput,
} from './import.types.js';

// submittedAt (a Date) is deliberately excluded - reference equality via !== would always be
// true for two distinct Date objects, so it's compared explicitly by value below instead.
const SIMPLE_FIELDS = [
  'submitter',
  'stepartist',
  'pack',
  'playstyle',
  'difficulty',
  'focus',
  'derivedFocus',
  'cmodPreference',
  'releaseYear',
  'theme',
  'additionalNotes',
  'consentToPublicReview',
  'fileUrl',
  'driveMd5',
  'processingError',
  'songDir',
  'bannerSlug',
  'isInternal',
  'isIgnored',
  'singleTechTagId',
] as const satisfies readonly (keyof NormalizedSubmissionInput)[];

function toRow(input: NormalizedSubmissionInput) {
  return {
    fileId: input.fileId,
    submittedAt: input.submittedAt,
    submitter: input.submitter,
    stepartist: input.stepartist,
    pack: input.pack,
    songDir: input.songDir,
    status: input.processingError ?? 'Success',
  };
}

function toMissingRow(
  prior: ExistingSubmissionSnapshot,
  chartCleared: boolean,
): MissingSubmissionRow {
  return { ...toRow(prior), chartCleared };
}

function techTagSetsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

function chartOpFor(
  existing: ExistingSubmissionSnapshot['chart'],
  incoming: NormalizedSubmissionInput['chart'],
  changedFields: FieldChange[],
): ChartOp {
  if (existing === null && incoming === null) return 'none';
  if (existing === null && incoming !== null) {
    changedFields.push({ field: 'chart', from: null, to: incoming.hash });
    return 'create';
  }
  if (existing !== null && incoming === null) {
    changedFields.push({ field: 'chart', from: existing.hash, to: null });
    return 'delete';
  }
  // Both non-null: gated strictly on hash per REQUIREMENTS.md - a rerun with no real chart
  // change is a no-op even if other chart fields would otherwise differ under this payload.
  if (existing!.hash !== incoming!.hash) {
    changedFields.push({ field: 'chart.hash', from: existing!.hash, to: incoming!.hash });
    return 'update';
  }
  return 'none';
}

export function computeDiff(
  existing: ExistingSubmissionSnapshot[],
  incoming: NormalizedSubmissionInput[],
): ImportDiff {
  const existingByFileId = new Map(existing.map((row) => [row.fileId, row]));
  const incomingFileIds = new Set(incoming.map((row) => row.fileId));

  const diff: ImportDiff = {
    summary: {
      totalInFile: incoming.length,
      totalExistingInDb: existing.length,
      toInsert: 0,
      toUpdate: 0,
      toIgnore: 0,
      unchanged: 0,
      alreadyIgnored: 0,
    },
    inserts: [],
    updates: [],
    newlyIgnored: [],
    chartCleanup: [],
  };

  for (const input of incoming) {
    const prior = existingByFileId.get(input.fileId);
    if (!prior) {
      diff.inserts.push({ input, row: toRow(input) });
      diff.summary.toInsert += 1;
      continue;
    }

    const changedFields: FieldChange[] = [];
    for (const field of SIMPLE_FIELDS) {
      if (prior[field] !== input[field]) {
        changedFields.push({ field, from: prior[field], to: input[field] });
      }
    }
    if (prior.submittedAt.getTime() !== input.submittedAt.getTime()) {
      changedFields.push({
        field: 'submittedAt',
        from: prior.submittedAt.toISOString(),
        to: input.submittedAt.toISOString(),
      });
    }

    const chartOp = chartOpFor(prior.chart, input.chart, changedFields);
    const techTagsChanged = !techTagSetsEqual(prior.techTagIds, input.techTagIds);
    if (techTagsChanged) {
      changedFields.push({ field: 'techTagIds', from: prior.techTagIds, to: input.techTagIds });
    }

    if (changedFields.length === 0 && chartOp === 'none' && !techTagsChanged) {
      diff.summary.unchanged += 1;
      continue;
    }

    diff.updates.push({
      input,
      row: toRow(input),
      changedFields,
      chartOp,
      techTagsChanged,
      previousChart: prior.chart,
      previousInput: prior,
    });
    diff.summary.toUpdate += 1;
  }

  // A fileId missing from the file entirely is never deleted - it's treated exactly like
  // an entry that said "is_ignored: true, chart: null", since the file can ignore rows but
  // never delete them outright.
  for (const prior of existing) {
    if (incomingFileIds.has(prior.fileId)) continue;
    const chartCleared = prior.chart !== null;
    if (prior.isIgnored) {
      diff.summary.alreadyIgnored += 1;
      if (chartCleared) {
        diff.chartCleanup.push(toMissingRow(prior, chartCleared));
      }
    } else {
      diff.newlyIgnored.push(toMissingRow(prior, chartCleared));
      diff.summary.toIgnore += 1;
    }
  }

  return diff;
}
