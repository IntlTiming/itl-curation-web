import { describe, expect, it } from 'vitest';
import { mapReviewForDetail } from './submissions.service.js';

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
