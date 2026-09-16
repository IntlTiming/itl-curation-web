import { describe, expect, it } from 'vitest';
import {
  buildConsensusDeviationQuery,
  buildReviewableCountsByPlaystyleQuery,
  buildReviewedCountsByPlaystyleQuery,
  buildUsersQuery,
  computeReviewIsStale,
  mapConsensusDeviation,
  mapCoverageByPlaystyle,
  mapRatingBreakdown,
  mapUserRecentComment,
  mapUserRow,
  type RawUserRow,
} from './users.service.js';

describe('buildUsersQuery', () => {
  it('always includes the event_roles/REVIEWER and event_reviews CTEs', () => {
    const query = buildUsersQuery('event-1');
    expect(query.sql).toContain('event_roles');
    expect(query.sql).toContain('\'REVIEWER\'::"EventRoleType"');
    expect(query.sql).toContain('event_reviews');
    expect(query.sql).not.toContain('WHERE a."userId"');
  });

  it('adds a userId filter only when userId is passed', () => {
    const query = buildUsersQuery('event-1', 'user-1');
    expect(query.sql).toContain('WHERE a."userId"');
    expect(query.values).toContain('user-1');
  });

  it('computes commentCount as a correlated subquery, not a second LEFT JOIN', () => {
    const query = buildUsersQuery('event-1');
    expect(query.sql).toContain('"commentCount"');
    expect(query.sql).toContain('FROM comments c');
    // Still just the two pre-existing LEFT JOINs (member_ids, event_reviews) - a third
    // one-to-many join for comments would fan out and corrupt the review aggregates
    // (COUNT(er.id), AVG(er.rating), etc).
    expect(query.sql.match(/LEFT JOIN/g)).toHaveLength(2);
  });
});

describe('mapUserRow', () => {
  const base: RawUserRow = {
    userId: 'user-1',
    discordId: 'discord-1',
    discordUsername: 'someone',
    displayName: null,
    discordAvatarHash: null,
    isCurrentMember: true,
    grantedAt: new Date('2026-01-01'),
    reviewCount: 3n,
    commentCount: 2n,
    avgRating: 200,
    minRating: 100,
    maxRating: 300,
    stdevRating: 50,
    lastActivity: new Date('2026-02-01'),
  };

  it('scales rating fields from hundredths to a plain decimal', () => {
    const mapped = mapUserRow(base);
    expect(mapped.avgRating).toBe(2);
    expect(mapped.minRating).toBe(1);
    expect(mapped.maxRating).toBe(3);
    expect(mapped.stdevRating).toBe(0.5);
  });

  it('converts the bigint reviewCount and commentCount to numbers', () => {
    const mapped = mapUserRow(base);
    expect(mapped.reviewCount).toBe(3);
    expect(mapped.commentCount).toBe(2);
  });

  it('passes null rating fields through as null', () => {
    const mapped = mapUserRow({
      ...base,
      reviewCount: 0n,
      avgRating: null,
      minRating: null,
      maxRating: null,
      stdevRating: null,
    });
    expect(mapped.avgRating).toBeNull();
    expect(mapped.minRating).toBeNull();
    expect(mapped.maxRating).toBeNull();
    expect(mapped.stdevRating).toBeNull();
  });
});

describe('mapRatingBreakdown', () => {
  it('produces an empty table (no meter columns, every rating row zeroed) for a playstyle with no reviews', () => {
    const breakdown = mapRatingBreakdown([]);
    expect(breakdown.SINGLE.meters).toEqual([]);
    expect(breakdown.SINGLE.grandTotal).toBe(0);
    expect(breakdown.SINGLE.rows).toHaveLength(7); // 6 RATING_OPTIONS + the null bucket
    expect(breakdown.SINGLE.rows.every((r) => r.total === 0 && r.counts.length === 0)).toBe(true);
  });

  it('splits rows by playstyle and columns by meter, ascending', () => {
    const breakdown = mapRatingBreakdown([
      { rating: 150, chartPlaystyle: 'SINGLE', chartMeter: 13, _count: { _all: 3 } },
      { rating: 150, chartPlaystyle: 'SINGLE', chartMeter: 10, _count: { _all: 2 } },
      { rating: 300, chartPlaystyle: 'SINGLE', chartMeter: 10, _count: { _all: 1 } },
      { rating: null, chartPlaystyle: 'DOUBLE', chartMeter: 20, _count: { _all: 4 } },
    ]);

    expect(breakdown.SINGLE.meters).toEqual([10, 13]);
    const rating15 = breakdown.SINGLE.rows.find((r) => r.rating === 1.5)!;
    expect(rating15.counts).toEqual([2, 3]); // [meter 10, meter 13]
    expect(rating15.total).toBe(5);
    expect(breakdown.SINGLE.columnTotals).toEqual([3, 3]); // meter 10: 2+1, meter 13: 3
    expect(breakdown.SINGLE.grandTotal).toBe(6);

    expect(breakdown.DOUBLE.meters).toEqual([20]);
    const noRating = breakdown.DOUBLE.rows.find((r) => r.rating === null)!;
    expect(noRating.counts).toEqual([4]);
    expect(breakdown.DOUBLE.grandTotal).toBe(4);
  });
});

describe('buildConsensusDeviationQuery', () => {
  it("excludes the reviewer's own reviews from the comparison group", () => {
    const query = buildConsensusDeviationQuery('event-1', 'user-1');
    expect(query.sql).toContain('other."reviewerId" <>');
    expect(query.sql).toContain('own."reviewerId" =');
    expect(query.values).toContain('user-1');
    expect(query.values).toContain('event-1');
  });

  it('is not scoped to the event on the comparison side, mirroring buildReviewStatsFragment', () => {
    const query = buildConsensusDeviationQuery('event-1', 'user-1');
    const lateralClause = query.sql.split('CROSS JOIN LATERAL (')[1].split(') other_avg')[0];
    expect(lateralClause).not.toContain('"eventId"');
  });
});

describe('mapConsensusDeviation', () => {
  it('scales the deviation from hundredths to a plain decimal', () => {
    const mapped = mapConsensusDeviation({ deviation: 75, sampleCount: 4n });
    expect(mapped.consensusDeviation).toBe(0.75);
    expect(mapped.consensusSampleCount).toBe(4);
  });

  it('is null with a zero sample count when there is no row at all', () => {
    const mapped = mapConsensusDeviation(undefined);
    expect(mapped.consensusDeviation).toBeNull();
    expect(mapped.consensusSampleCount).toBe(0);
  });
});

describe('buildReviewableCountsByPlaystyleQuery / buildReviewedCountsByPlaystyleQuery', () => {
  it('groups reviewable submissions by chart.playstyle, excluding ignored/errored ones', () => {
    const query = buildReviewableCountsByPlaystyleQuery('event-1');
    expect(query.sql).toContain('GROUP BY c.playstyle');
    expect(query.sql).toContain('"isIgnored"');
    expect(query.sql).toContain('"processingError"');
  });

  it("scopes the reviewer's own counts by both eventId and reviewerId", () => {
    const query = buildReviewedCountsByPlaystyleQuery('event-1', 'user-1');
    expect(query.sql).toContain('GROUP BY c.playstyle');
    expect(query.values).toEqual(['event-1', 'user-1']);
  });
});

describe('mapCoverageByPlaystyle', () => {
  it('defaults missing playstyles to zero on both sides', () => {
    const coverage = mapCoverageByPlaystyle([], []);
    expect(coverage).toEqual({
      SINGLE: { reviewedCount: 0, reviewableCount: 0 },
      DOUBLE: { reviewedCount: 0, reviewableCount: 0 },
    });
  });

  it("pairs each playstyle's reviewed count with its reviewable count independently", () => {
    const coverage = mapCoverageByPlaystyle(
      [
        { playstyle: 'SINGLE', count: 40n },
        { playstyle: 'DOUBLE', count: 10n },
      ],
      [{ playstyle: 'SINGLE', count: 12n }],
    );
    expect(coverage.SINGLE).toEqual({ reviewedCount: 12, reviewableCount: 40 });
    expect(coverage.DOUBLE).toEqual({ reviewedCount: 0, reviewableCount: 10 });
  });
});

describe('mapUserRecentComment', () => {
  const base = {
    id: 'comment-1',
    submissionId: 'sub-1',
    chartHash: 'hash-1',
    body: 'nice chart',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    submission: {
      chart: {
        hash: 'hash-1',
        title: 'Title',
        titleRomaji: 'Title',
        artist: 'Artist',
        artistRomaji: 'Artist',
        playstyle: 'SINGLE' as const,
        difficulty: 'HARD' as const,
        meter: 13,
      },
    },
  };

  it('is not edited when createdAt and updatedAt are identical', () => {
    expect(mapUserRecentComment(base).isEdited).toBe(false);
  });

  it('is edited when updatedAt differs from createdAt', () => {
    const mapped = mapUserRecentComment({
      ...base,
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    });
    expect(mapped.isEdited).toBe(true);
  });

  it('is stale when the chart hash no longer matches the current chart hash', () => {
    const mapped = mapUserRecentComment({
      ...base,
      submission: { chart: { ...base.submission.chart, hash: 'hash-2' } },
    });
    expect(mapped.isStale).toBe(true);
  });

  it('chart is null when the submission has no parsed chart', () => {
    const mapped = mapUserRecentComment({ ...base, submission: { chart: null } });
    expect(mapped.chart).toBeNull();
    expect(mapped.isStale).toBe(true);
  });
});

describe('computeReviewIsStale', () => {
  it('is false when the chart hash still matches the current chart hash', () => {
    expect(computeReviewIsStale('hash-1', 'hash-1')).toBe(false);
  });

  it('is true when the chart hash no longer matches the current chart hash', () => {
    expect(computeReviewIsStale('hash-1', 'hash-2')).toBe(true);
  });

  it('is true when there is no current chart at all', () => {
    expect(computeReviewIsStale('hash-1', null)).toBe(true);
  });
});
