import { describe, expect, it } from 'vitest';
import {
  assertSuggestionWritable,
  buildSuggestionReviewRevisionEntries,
  mapSuggestionReviewForDetail,
} from './suggestions.service.js';

const REVIEWER = {
  id: 'user-1',
  displayName: null,
  discordUsername: 'reviewer',
  discordId: '123',
  discordAvatarHash: null,
};

const CHECK = {
  basicCheckReasonId: 'reason-1',
  note: 'beat 0',
  basicCheckReason: { code: 'BEAT0', label: 'Beat 0', level: 'WARNING' as const },
};

function review(
  overrides: Partial<Parameters<typeof buildSuggestionReviewRevisionEntries>[0]> = {},
) {
  return {
    id: 'review-1',
    rating: 250,
    passing: 3,
    scoring: 7,
    notes: 'live',
    basicCheckReasons: [CHECK],
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-03T00:00:00Z'),
    reviewer: REVIEWER,
    revisions: [],
    ...overrides,
  };
}

describe('mapSuggestionReviewForDetail', () => {
  it('descales rating and is never stale or from another submission', () => {
    const mapped = mapSuggestionReviewForDetail(review());
    expect(mapped.rating).toBe(2.5);
    expect(mapped.reviewer.displayName).toBe('reviewer');
    expect(mapped.basicChecks).toEqual([
      { id: 'reason-1', code: 'BEAT0', label: 'Beat 0', level: 'WARNING', note: 'beat 0' },
    ]);
    expect(mapped.isStale).toBe(false);
    expect(mapped.isFromDifferentSubmission).toBe(false);
  });
});

describe('buildSuggestionReviewRevisionEntries', () => {
  it('emits a single detail-less "submitted" entry for an unedited review', () => {
    const entries = buildSuggestionReviewRevisionEntries(review());
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'submitted', showDetails: false, isStale: false });
    expect(entries[0].timestamp).toBe('2026-10-01T00:00:00.000Z');
  });

  it('rebuilds the state chain from revisions, oldest first, ending at the live review', () => {
    const entries = buildSuggestionReviewRevisionEntries(
      review({
        revisions: [
          {
            rating: 100,
            passing: null,
            scoring: null,
            notes: 'first',
            basicCheckReasons: [],
            supersededAt: new Date('2026-10-02T00:00:00Z'),
          },
          {
            rating: 200,
            passing: null,
            scoring: null,
            notes: 'second',
            basicCheckReasons: [],
            supersededAt: new Date('2026-10-03T00:00:00Z'),
          },
        ],
      }),
    );
    expect(entries.map((e) => [e.kind, e.content.notes, e.timestamp])).toEqual([
      ['submitted', 'first', '2026-10-01T00:00:00.000Z'],
      ['updated', 'second', '2026-10-02T00:00:00.000Z'],
      ['updated', 'live', '2026-10-03T00:00:00.000Z'],
    ]);
    expect(entries.every((e) => e.showDetails)).toBe(true);
  });
});

describe('assertSuggestionWritable', () => {
  const base = {
    eventId: 'event-1',
    position: 1,
    submittedAt: new Date(),
    submitter: 's',
    chart: 'c',
    reason: 'r',
    link: '',
    consentToPublicReview: null,
    linkedSubmissionId: null,
    linkedAt: null,
    linkedById: null,
    lastReviewAt: null,
    lastCommentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('allows writes to an unlinked suggestion', () => {
    expect(() => assertSuggestionWritable(base)).not.toThrow();
  });

  it('refuses writes once the suggestion is linked to a submission', () => {
    expect(() => assertSuggestionWritable({ ...base, linkedSubmissionId: 'file-1' })).toThrow(
      /read-only/,
    );
  });
});
