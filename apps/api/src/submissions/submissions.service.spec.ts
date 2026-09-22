import { describe, expect, it } from 'vitest';
import { buildReviewRevisionEntries, mapReviewForDetail } from './submissions.service.js';

function makeReview(overrides: Partial<Parameters<typeof mapReviewForDetail>[0]> = {}) {
  return {
    id: 'review-1',
    submissionId: 'file-1',
    chartHash: 'hash-a',
    rating: 150,
    passing: 3,
    scoring: 7,
    notes: 'looks good',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    reviewer: {
      id: 'user-1',
      displayName: 'lemone',
      discordUsername: 'lemone#0001',
      discordId: '111111111111111111',
      discordAvatarHash: 'abc123',
    },
    basicCheckReasons: [],
    ...overrides,
  } as Parameters<typeof mapReviewForDetail>[0];
}

function makeRevisionRow(
  overrides: Partial<Parameters<typeof buildReviewRevisionEntries>[0]['revisions'][number]> = {},
) {
  return {
    chartHash: 'hash-a',
    rating: 100,
    passing: 2,
    scoring: 5,
    notes: 'original notes',
    supersededAt: new Date('2026-01-02'),
    basicCheckReasons: [],
    ...overrides,
  };
}

describe('mapReviewForDetail', () => {
  it('flags a review from a different submission but the same chart hash', () => {
    const review = makeReview({ submissionId: 'other-file', chartHash: 'hash-a' });
    const mapped = mapReviewForDetail(review, 'file-1', 'hash-a');

    expect(mapped.isFromDifferentSubmission).toBe(true);
    expect(mapped.isStale).toBe(false);
  });

  it('flags a review of this exact submission whose chart hash is now stale', () => {
    const review = makeReview({ submissionId: 'file-1', chartHash: 'hash-old' });
    const mapped = mapReviewForDetail(review, 'file-1', 'hash-new');

    expect(mapped.isFromDifferentSubmission).toBe(false);
    expect(mapped.isStale).toBe(true);
  });

  it('flags neither for a current review of this exact submission', () => {
    const review = makeReview({ submissionId: 'file-1', chartHash: 'hash-a' });
    const mapped = mapReviewForDetail(review, 'file-1', 'hash-a');

    expect(mapped.isFromDifferentSubmission).toBe(false);
    expect(mapped.isStale).toBe(false);
  });

  it('falls back to discordUsername when displayName is null, and scales rating from hundredths', () => {
    const review = makeReview({
      reviewer: {
        id: 'u2',
        displayName: null,
        discordUsername: 'raw#0002',
        discordId: '222222222222222222',
        discordAvatarHash: null,
      },
    });
    const mapped = mapReviewForDetail(review, 'file-1', 'hash-a');

    expect(mapped.reviewer.displayName).toBe('raw#0002');
    expect(mapped.rating).toBe(1.5);
  });

  it('passes through the reviewer discord identity fields for building an avatar URL', () => {
    const review = makeReview();
    const mapped = mapReviewForDetail(review, 'file-1', 'hash-a');

    expect(mapped.reviewer.discordId).toBe('111111111111111111');
    expect(mapped.reviewer.discordAvatarHash).toBe('abc123');
  });
});

describe('buildReviewRevisionEntries', () => {
  it('returns one showDetails:false "submitted" entry for a review with no ReviewRevision rows - its content duplicates the live Reviews-column card, so the card only shows the row, not the values', () => {
    const review = {
      ...makeReview({ rating: 150, passing: 3, scoring: 7, notes: 'looks good' }),
      revisions: [],
    };
    const entries = buildReviewRevisionEntries(review, 'hash-a');

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'review-1:0',
      kind: 'submitted',
      timestamp: review.createdAt.toISOString(),
      showDetails: false,
      content: { rating: 1.5, passing: 3, scoring: 7, notes: 'looks good', basicChecks: [] },
    });
  });

  it('returns exactly 2 entries for a review edited once: the original "submitted" state and the live "updated" state, both showDetails:true', () => {
    const review = {
      ...makeReview({ rating: 200, passing: 4, scoring: 8, notes: 'final notes' }),
      revisions: [makeRevisionRow()],
    };
    const entries = buildReviewRevisionEntries(review, 'hash-a');

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      id: 'review-1:0',
      kind: 'submitted',
      timestamp: review.createdAt.toISOString(),
      showDetails: true,
      content: { rating: 1, passing: 2, scoring: 5, notes: 'original notes', basicChecks: [] },
    });
    expect(entries[1]).toMatchObject({
      id: 'review-1:1',
      kind: 'updated',
      timestamp: review.revisions[0].supersededAt.toISOString(),
      showDetails: true,
      content: { rating: 2, passing: 4, scoring: 8, notes: 'final notes', basicChecks: [] },
    });
  });

  it('returns 3 entries for a review edited twice, chaining timestamps and content from the right source row', () => {
    const revision0 = makeRevisionRow({
      rating: 100,
      notes: 'v1',
      supersededAt: new Date('2026-01-02'),
    });
    const revision1 = makeRevisionRow({
      rating: 150,
      notes: 'v2',
      supersededAt: new Date('2026-01-03'),
    });
    const review = {
      ...makeReview({ rating: 200, notes: 'v3', createdAt: new Date('2026-01-01') }),
      revisions: [revision0, revision1],
    };
    const entries = buildReviewRevisionEntries(review, 'hash-a');

    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.kind)).toEqual(['submitted', 'updated', 'updated']);
    expect(entries.map((e) => e.content.notes)).toEqual(['v1', 'v2', 'v3']);
    expect(entries.map((e) => e.timestamp)).toEqual([
      review.createdAt.toISOString(),
      revision0.supersededAt.toISOString(),
      revision1.supersededAt.toISOString(),
    ]);
  });

  it('scales rating from hundredths and falls back reviewer.displayName to discordUsername, consistently across the chain', () => {
    const review = {
      ...makeReview({
        rating: 300,
        reviewer: {
          id: 'u2',
          displayName: null,
          discordUsername: 'raw#0002',
          discordId: '222222222222222222',
          discordAvatarHash: null,
        },
      }),
      revisions: [makeRevisionRow({ rating: 150 })],
    };
    const entries = buildReviewRevisionEntries(review, 'hash-a');

    expect(entries[0].content.rating).toBe(1.5);
    expect(entries[1].content.rating).toBe(3);
    expect(entries[0].reviewer.displayName).toBe('raw#0002');
    expect(entries[1].reviewer.displayName).toBe('raw#0002');
  });

  it("computes isStale independently per entry from each state's own chartHash, not inherited from the live review", () => {
    const review = {
      ...makeReview({ chartHash: 'hash-new' }),
      revisions: [makeRevisionRow({ chartHash: 'hash-old' })],
    };
    const entries = buildReviewRevisionEntries(review, 'hash-new');

    expect(entries[0].chartHash).toBe('hash-old');
    expect(entries[0].isStale).toBe(true);
    expect(entries[1].chartHash).toBe('hash-new');
    expect(entries[1].isStale).toBe(false);
  });

  it("surfaces basic checks per entry from each state's own snapshot", () => {
    const review = {
      ...makeReview({
        basicCheckReasons: [
          {
            basicCheckReasonId: 'bcr-2',
            note: 'final note',
            basicCheckReason: { code: 'AUDIO', label: 'Audio issue', level: 'WARNING' as const },
          },
        ],
      }),
      revisions: [
        makeRevisionRow({
          basicCheckReasons: [
            {
              basicCheckReasonId: 'bcr-1',
              note: null,
              basicCheckReason: {
                code: 'TIMING',
                label: 'Timing issue',
                level: 'DISQUALIFIED' as const,
              },
            },
          ],
        }),
      ],
    };
    const entries = buildReviewRevisionEntries(review, 'hash-a');

    expect(entries[0].content.basicChecks).toEqual([
      { id: 'bcr-1', code: 'TIMING', label: 'Timing issue', level: 'DISQUALIFIED', note: null },
    ]);
    expect(entries[1].content.basicChecks).toEqual([
      { id: 'bcr-2', code: 'AUDIO', label: 'Audio issue', level: 'WARNING', note: 'final note' },
    ]);
  });
});
