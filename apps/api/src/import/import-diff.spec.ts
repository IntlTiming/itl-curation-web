import { describe, expect, it } from 'vitest';
import { computeDiff } from './import-diff.js';
import type {
  ExistingSubmissionSnapshot,
  NormalizedChart,
  NormalizedSubmissionInput,
} from './import.types.js';

const BASE_CHART: NormalizedChart = {
  hash: 'hash-a',
  title: 'Title',
  titleRomaji: '',
  subtitle: '',
  subtitleRomaji: '',
  artist: 'Artist',
  artistRomaji: '',
  playstyle: 'SINGLE',
  difficulty: 'HARD',
  meter: 10,
  minBpm: 120,
  maxBpm: 120,
  totalSteps: 100,
  totalRolls: 0,
  totalHolds: 0,
  totalMines: 0,
  totalJumps: 0,
  lengthSeconds: 60,
  totalMeasures: 20,
  totalBreakMeasures: 0,
  totalStreamMeasures: 0,
  totalTrueStreamMeasures: 0,
  weightedNps: 5000,
  hasSignificantTimingChanges: false,
  bracketCount: 0,
  halfCrossoverCount: 0,
  fullCrossoverCount: 0,
  crossoverCount: 0,
  downFootswitchCount: 0,
  upFootswitchCount: 0,
  footswitchCount: 0,
  doublestepCount: 0,
  jackCount: 0,
  sideswitchCount: 0,
};

function makeInput(overrides: Partial<NormalizedSubmissionInput> = {}): NormalizedSubmissionInput {
  return {
    fileId: 'file-1',
    submitter: 'someone',
    stepartist: 'artist',
    pack: 'pack',
    playstyle: 'SINGLE',
    difficulty: 'HARD',
    focus: 'focus',
    derivedFocus: 'No Tech',
    cmodPreference: 'CMOD_OKAY',
    releaseYear: '2026',
    theme: '',
    additionalNotes: '',
    consentToPublicReview: null,
    fileUrl: 'https://example.com',
    driveMd5: 'md5',
    processingError: null,
    songDir: 'Single/Foo [file-1]',
    bannerSlug: 'slug',
    isInternal: false,
    submittedAt: new Date('2026-01-01T00:00:00Z'),
    isIgnored: false,
    techTagIds: ['tag-a'],
    singleTechTagId: null,
    chart: BASE_CHART,
    ...overrides,
  };
}

// The DB snapshot has the same shape as a file entry (ExistingSubmissionSnapshot is just an
// alias for NormalizedSubmissionInput) - this helper exists purely to make tests read as
// "what's already in the DB" vs. "what the file says."
function makeExisting(
  overrides: Partial<ExistingSubmissionSnapshot> = {},
): ExistingSubmissionSnapshot {
  return makeInput(overrides);
}

describe('computeDiff', () => {
  it('classifies a fileId with no existing row as an insert', () => {
    const diff = computeDiff([], [makeInput()]);
    expect(diff.summary.toInsert).toBe(1);
    expect(diff.inserts).toHaveLength(1);
    expect(diff.summary.toUpdate).toBe(0);
  });

  it('classifies an identical entry as unchanged, not an update', () => {
    const existing = makeExisting();
    const diff = computeDiff([existing], [makeInput()]);
    expect(diff.summary.unchanged).toBe(1);
    expect(diff.updates).toHaveLength(0);
  });

  it('classifies a scalar field difference as an update with the field named', () => {
    const existing = makeExisting();
    const diff = computeDiff([existing], [makeInput({ stepartist: 'new-artist' })]);
    expect(diff.summary.toUpdate).toBe(1);
    expect(diff.updates[0]?.changedFields).toContainEqual({
      field: 'stepartist',
      from: 'artist',
      to: 'new-artist',
    });
  });

  it('diffs isIgnored like any other mapped field, sourced from the file', () => {
    const existing = makeExisting({ isIgnored: false });
    const diff = computeDiff([existing], [makeInput({ isIgnored: true })]);
    expect(diff.updates[0]?.changedFields).toContainEqual({
      field: 'isIgnored',
      from: false,
      to: true,
    });
  });

  it('diffs submittedAt by value, not by Date reference', () => {
    const sameInstant = new Date('2026-01-01T00:00:00Z');
    const existing = makeExisting({ submittedAt: new Date(sameInstant.getTime()) });
    const diff = computeDiff(
      [existing],
      [makeInput({ submittedAt: new Date(sameInstant.getTime()) })],
    );
    expect(diff.summary.unchanged).toBe(1);
    expect(diff.updates).toHaveLength(0);

    const diffChanged = computeDiff(
      [existing],
      [makeInput({ submittedAt: new Date('2026-02-01T00:00:00Z') })],
    );
    expect(diffChanged.updates[0]?.changedFields.some((c) => c.field === 'submittedAt')).toBe(true);
  });

  it('creates a chart when the submission previously had none', () => {
    const existing = makeExisting({ chart: null });
    const diff = computeDiff([existing], [makeInput({ chart: BASE_CHART })]);
    expect(diff.updates[0]?.chartOp).toBe('create');
  });

  it('deletes the chart when the file now reports parsing failure', () => {
    const existing = makeExisting({ chart: BASE_CHART });
    const diff = computeDiff([existing], [makeInput({ chart: null })]);
    expect(diff.updates[0]?.chartOp).toBe('delete');
  });

  it('updates the chart in place when the hash changed', () => {
    const existing = makeExisting({ chart: BASE_CHART });
    const newChart = { ...BASE_CHART, hash: 'hash-b', meter: 12 };
    const diff = computeDiff([existing], [makeInput({ chart: newChart })]);
    expect(diff.updates[0]?.chartOp).toBe('update');
  });

  it('carries the prior chart alongside the new one, for display purposes only', () => {
    const existing = makeExisting({ chart: BASE_CHART });
    const newChart = { ...BASE_CHART, hash: 'hash-b', meter: 12 };
    const diff = computeDiff([existing], [makeInput({ chart: newChart })]);
    expect(diff.updates[0]?.previousChart).toEqual(BASE_CHART);
    expect(diff.updates[0]?.input.chart).toEqual(newChart);
  });

  it('does not write the chart at all when the hash is unchanged, even if other chart fields differ', () => {
    const existing = makeExisting({ chart: BASE_CHART });
    // Same hash, but meter differs under the new payload - per REQUIREMENTS.md, the pipeline
    // must bump the hash to push a correction; an unchanged hash means "no real change."
    const newChart = { ...BASE_CHART, meter: 99 };
    const diff = computeDiff([existing], [makeInput({ chart: newChart })]);
    expect(diff.summary.unchanged).toBe(1);
    expect(diff.updates).toHaveLength(0);
  });

  it('queues a tech-tag replace only when the resolved set actually differs', () => {
    const existing = makeExisting({ techTagIds: ['tag-a', 'tag-b'] });
    const sameOrderDifferent = makeInput({ techTagIds: ['tag-b', 'tag-a'] });
    const diffSameSet = computeDiff([existing], [sameOrderDifferent]);
    expect(diffSameSet.summary.unchanged).toBe(1);

    const diffChanged = computeDiff([existing], [makeInput({ techTagIds: ['tag-a'] })]);
    expect(diffChanged.updates[0]?.techTagsChanged).toBe(true);
  });

  it('marks a fileId missing from the file as newly-ignored, clearing its chart', () => {
    const existing = makeExisting({ isIgnored: false, chart: BASE_CHART });
    const diff = computeDiff([existing], []);
    expect(diff.summary.toIgnore).toBe(1);
    expect(diff.newlyIgnored).toEqual([expect.objectContaining({ chartCleared: true })]);
  });

  it('marks a fileId missing from the file as newly-ignored without a chart op when it had none', () => {
    const existing = makeExisting({ isIgnored: false, chart: null });
    const diff = computeDiff([existing], []);
    expect(diff.newlyIgnored).toEqual([expect.objectContaining({ chartCleared: false })]);
  });

  it('leaves an already-ignored, still-missing, chartless fileId fully untouched', () => {
    const existing = makeExisting({ isIgnored: true, chart: null });
    const diff = computeDiff([existing], []);
    expect(diff.summary.toIgnore).toBe(0);
    expect(diff.summary.alreadyIgnored).toBe(1);
    expect(diff.newlyIgnored).toHaveLength(0);
    expect(diff.chartCleanup).toHaveLength(0);
  });

  it('queues a chart cleanup for an already-ignored, still-missing fileId with a lingering chart', () => {
    const existing = makeExisting({ isIgnored: true, chart: BASE_CHART });
    const diff = computeDiff([existing], []);
    expect(diff.summary.alreadyIgnored).toBe(1);
    expect(diff.newlyIgnored).toHaveLength(0);
    expect(diff.chartCleanup).toEqual([expect.objectContaining({ chartCleared: true })]);
  });

  it('treats a present, unchanged-except-ignored-flag row as a normal update, not special-cased', () => {
    const existing = makeExisting({ isIgnored: true });
    const diff = computeDiff([existing], [makeInput({ isIgnored: false })]);
    expect(diff.updates).toHaveLength(1);
    expect(diff.updates[0]?.changedFields).toContainEqual({
      field: 'isIgnored',
      from: true,
      to: false,
    });
  });
});
