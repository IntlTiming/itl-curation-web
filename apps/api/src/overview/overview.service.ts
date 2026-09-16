import { Injectable } from '@nestjs/common';
import type { Playstyle } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export type MeterCoverageRow = {
  playstyle: Playstyle;
  meter: number;
  reviewableCount: number;
  reviewedCount: number;
};

export type CategoryCountRow = {
  playstyle: Playstyle;
  meter: number;
  category: string;
  count: number;
};

export type OverviewResponse = {
  coverageByMeter: MeterCoverageRow[];
  focusBreakdown: CategoryCountRow[];
  derivedFocusBreakdown: CategoryCountRow[];
};

export type RawMeterCoverageRow = {
  playstyle: Playstyle;
  meter: number;
  reviewableCount: bigint;
  reviewedCount: bigint;
};

// Same "reviewable" population as users.service.ts's buildReviewableCountsByPlaystyleQuery (not
// ignored, chart parsed successfully - a reviewable submission always has a Chart row, so
// c.meter/c.playstyle are always available here), just also grouped by meter. reviewedCount uses
// an EXISTS rather than joining reviews directly, so a submission with multiple reviews can't fan
// out against this GROUP BY - same correlated-subquery reasoning as buildUsersQuery's
// commentCount. No chartHash filter on the EXISTS: a submission whose only review is stale (the
// chart was re-parsed since) still counts as reviewed here, matching this event's Reviewers-tab
// convention of treating "has been reviewed at all" and "review is still fresh" as separate
// concerns.
export function buildMeterCoverageQuery(eventId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT
      c.playstyle,
      c.meter,
      COUNT(*) AS "reviewableCount",
      COUNT(*) FILTER (
        WHERE EXISTS (SELECT 1 FROM reviews r WHERE r."submissionId" = s."fileId")
      ) AS "reviewedCount"
    FROM submissions s
    JOIN charts c ON c."submissionId" = s."fileId"
    WHERE s."eventId" = ${eventId} AND NOT s."isIgnored" AND s."processingError" IS NULL
    GROUP BY c.playstyle, c.meter
    ORDER BY c.playstyle, c.meter
  `;
}

export type RawCategoryCountRow = {
  playstyle: Playstyle;
  meter: number;
  category: string;
  count: bigint;
};

// Same reviewable population/join as buildMeterCoverageQuery, so every chart on the Overview tab
// shares one consistent denominator - grouped by the submitter's raw `focus` value instead.
export function buildFocusBreakdownQuery(eventId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT c.playstyle, c.meter, s.focus AS category, COUNT(*) AS count
    FROM submissions s
    JOIN charts c ON c."submissionId" = s."fileId"
    WHERE s."eventId" = ${eventId} AND NOT s."isIgnored" AND s."processingError" IS NULL
    GROUP BY c.playstyle, c.meter, s.focus
    ORDER BY c.playstyle, c.meter, s.focus
  `;
}

// Same shape as buildFocusBreakdownQuery, grouped by the computed derivedFocus bucket instead of
// the raw focus value - kept as its own named query rather than a column-parameterized helper,
// matching this codebase's convention of explicit query builders (no precedent here for
// dynamic-identifier raw SQL).
export function buildDerivedFocusBreakdownQuery(eventId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT c.playstyle, c.meter, s."derivedFocus" AS category, COUNT(*) AS count
    FROM submissions s
    JOIN charts c ON c."submissionId" = s."fileId"
    WHERE s."eventId" = ${eventId} AND NOT s."isIgnored" AND s."processingError" IS NULL
    GROUP BY c.playstyle, c.meter, s."derivedFocus"
    ORDER BY c.playstyle, c.meter, s."derivedFocus"
  `;
}

export function mapMeterCoverageRow(row: RawMeterCoverageRow): MeterCoverageRow {
  return {
    playstyle: row.playstyle,
    meter: row.meter,
    reviewableCount: Number(row.reviewableCount),
    reviewedCount: Number(row.reviewedCount),
  };
}

export function mapCategoryCountRow(row: RawCategoryCountRow): CategoryCountRow {
  return {
    playstyle: row.playstyle,
    meter: row.meter,
    category: row.category,
    count: Number(row.count),
  };
}

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getForEvent(eventId: string): Promise<OverviewResponse> {
    const [coverage, focus, derivedFocus] = await Promise.all([
      this.prisma.$queryRaw<RawMeterCoverageRow[]>(buildMeterCoverageQuery(eventId)),
      this.prisma.$queryRaw<RawCategoryCountRow[]>(buildFocusBreakdownQuery(eventId)),
      this.prisma.$queryRaw<RawCategoryCountRow[]>(buildDerivedFocusBreakdownQuery(eventId)),
    ]);

    return {
      coverageByMeter: coverage.map(mapMeterCoverageRow),
      focusBreakdown: focus.map(mapCategoryCountRow),
      derivedFocusBreakdown: derivedFocus.map(mapCategoryCountRow),
    };
  }
}
