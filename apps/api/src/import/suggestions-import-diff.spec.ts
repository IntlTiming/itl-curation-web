import { describe, expect, it } from 'vitest';
import { computeSuggestionDiff } from './suggestions-import-diff.js';
import type { NormalizedSuggestionInput } from './suggestions-import.types.js';

function input(position: number, overrides: Partial<NormalizedSuggestionInput> = {}) {
  return {
    position,
    submittedAt: new Date('2026-09-07T17:57:32Z'),
    submitter: `submitter-${position}`,
    chart: `Chart ${position}`,
    reason: 'Good chart',
    link: '',
    consentToPublicReview: null,
    ...overrides,
  } satisfies NormalizedSuggestionInput;
}

describe('computeSuggestionDiff', () => {
  it('inserts positions not yet in the DB', () => {
    const diff = computeSuggestionDiff([], [input(1), input(2)]);
    expect(diff.summary.toInsert).toBe(2);
    expect(diff.inserts.map((row) => row.position)).toEqual([1, 2]);
  });

  it('treats an identical rerun as unchanged, comparing submittedAt by value', () => {
    // Distinct Date objects with the same instant must not count as a change.
    const diff = computeSuggestionDiff(
      [input(1)],
      [input(1, { submittedAt: new Date('2026-09-07T17:57:32Z') })],
    );
    expect(diff.summary.unchanged).toBe(1);
    expect(diff.updates).toHaveLength(0);
  });

  it('records field changes as an update', () => {
    const diff = computeSuggestionDiff([input(1)], [input(1, { reason: 'Even better' })]);
    expect(diff.summary.toUpdate).toBe(1);
    expect(diff.updates[0].changedFields).toEqual([
      { field: 'reason', from: 'Good chart', to: 'Even better' },
    ]);
  });

  it('inserts only the newly appended entries when the file grows', () => {
    const diff = computeSuggestionDiff([input(1), input(2)], [input(1), input(2), input(3)]);
    expect(diff.summary).toMatchObject({ toInsert: 1, toUpdate: 0, unchanged: 2 });
    expect(diff.inserts.map((row) => row.position)).toEqual([3]);
  });
});
