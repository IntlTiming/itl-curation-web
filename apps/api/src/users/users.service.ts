import { Injectable, NotFoundException } from '@nestjs/common';
import type { BasicCheckLevel, Chart, Difficulty, Playstyle } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { RATING_OPTIONS } from '../reviews/dto/upsert-review.dto.js';

export type RawUserRow = {
  userId: string;
  discordId: string;
  discordUsername: string;
  displayName: string | null;
  discordAvatarHash: string | null;
  isCurrentMember: boolean;
  grantedAt: Date | null;
  reviewCount: bigint;
  commentCount: bigint;
  avgRating: number | null;
  minRating: number | null;
  maxRating: number | null;
  lastActivity: Date | null;
};

export type UserRow = {
  userId: string;
  discordId: string;
  discordUsername: string;
  displayName: string | null;
  discordAvatarHash: string | null;
  isCurrentMember: boolean;
  grantedAt: Date | null;
  reviewCount: number;
  commentCount: number;
  avgRating: number | null;
  minRating: number | null;
  maxRating: number | null;
  lastActivity: Date | null;
};

export type UserRecentReview = {
  id: string;
  submissionId: string;
  chartTitle: string;
  chartTitleRomaji: string;
  chartArtist: string;
  chartArtistRomaji: string;
  chartPlaystyle: Playstyle;
  chartDifficulty: Difficulty;
  chartMeter: number;
  rating: number | null;
  passing: number | null;
  scoring: number | null;
  notes: string | null;
  basicChecks: {
    id: string;
    code: string;
    label: string;
    level: BasicCheckLevel;
    note: string | null;
  }[];
  createdAt: Date;
  updatedAt: Date;
  isStale: boolean;
};

export type UserRecentComment = {
  id: string;
  submissionId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  isEdited: boolean;
  isStale: boolean;
  // Comment has no chart-identity snapshot the way Review does (see prisma/schema.prisma's
  // Comment model comment) - null when the submission's chart has since been deleted or never
  // parsed, in which case there's nothing to identify the chart by beyond the submissionId link.
  chart: {
    title: string;
    titleRomaji: string;
    artist: string;
    artistRomaji: string;
    playstyle: Playstyle;
    difficulty: Difficulty;
    meter: number;
  } | null;
};

// rating null means "reviewed but left the rating blank" - a distinct bucket from every
// RATING_OPTIONS value, not folded into any of them. counts[i] pairs with meters[i] in the
// enclosing RatingMeterTable; total is the row's sum across every meter.
export type RatingMeterRow = { rating: number | null; counts: number[]; total: number };
// meters is only the meters this reviewer has actually rated within this playstyle, ascending -
// not every meter that exists in the event, since an empty column for a meter they've never
// touched would just be dead space. columnTotals/grandTotal pair with meters the same way a
// spreadsheet's totals row would.
export type RatingMeterTable = {
  meters: number[];
  rows: RatingMeterRow[];
  columnTotals: number[];
  grandTotal: number;
};
export type RatingBreakdownByPlaystyle = { SINGLE: RatingMeterTable; DOUBLE: RatingMeterTable };

// Coverage split by chart.playstyle (parsed) rather than Submission.playstyle (submitter-
// claimed) - same "parsed, not claimed" convention SubmittersService uses for its own
// lowers/uppers/doubles split. reviewableCount is the same denominator for every reviewer in
// the event (how many of that playstyle exist to review at all); reviewedCount is this
// reviewer's own count within that playstyle.
export type PlaystyleCoverage = { reviewedCount: number; reviewableCount: number };
export type CoverageByPlaystyle = Record<Playstyle, PlaystyleCoverage>;

export type UserDetail = UserRow & {
  recentReviews: UserRecentReview[];
  recentComments: UserRecentComment[];
  ratingBreakdown: RatingBreakdownByPlaystyle;
  coverageByPlaystyle: CoverageByPlaystyle;
  // Average |this reviewer's rating - the average of every OTHER reviewer's rating on that same
  // chart| across their own rated reviews - a "runs hot/cold relative to consensus" signal that
  // a plain average can't show (two reviewers can share the same avgRating while one always
  // matches the room and the other is consistently ±1 off it). null when there's no comparison
  // data at all (e.g. every chart they rated was a solo review). consensusSampleCount is how many
  // of their rated reviews actually had another rated reviewer to compare against - can be less
  // than reviewCount, so the UI can show the deviation isn't based on their full review count.
  consensusDeviation: number | null;
  consensusSampleCount: number;
};

// Population is a union of (a) current EventRole REVIEWER members - including those with zero
// reviews - and (b) any user with a Review on a submission in this event even if their EventRole
// was later revoked: CuratorsService.removeCurator deletes the EventRole row but never touches
// Review rows, so review history outlives membership (isCurrentMember flags the difference).
//
// event_reviews pre-scopes reviews to the event BEFORE the final LEFT JOIN keyed on reviewerId -
// tacking a `WHERE s."eventId" = ...` onto the outer query instead would silently turn that LEFT
// JOIN into an INNER JOIN and drop zero-review members entirely.
//
// member_ids filters to role = 'REVIEWER' specifically (not any EventRole row) - an ADMIN-only
// row (no REVIEWER row alongside it; see CuratorsService.listForEvent's comment on this DB-only,
// UI-unreachable case) must not count as membership here.
export function buildUsersQuery(eventId: string, userId?: string): Prisma.Sql {
  return Prisma.sql`
    WITH member_ids AS (
      SELECT "userId", "grantedAt"
      FROM event_roles
      WHERE "eventId" = ${eventId} AND role = 'REVIEWER'::"EventRoleType"
    ),
    event_reviews AS (
      SELECT r.*
      FROM reviews r
      JOIN submissions s ON s."fileId" = r."submissionId"
      WHERE s."eventId" = ${eventId}
    ),
    all_ids AS (
      SELECT "userId" FROM member_ids
      UNION
      SELECT DISTINCT "reviewerId" AS "userId" FROM event_reviews
    )
    SELECT
      u.id AS "userId", u."discordId", u."discordUsername", u."displayName", u."discordAvatarHash",
      (m."userId" IS NOT NULL) AS "isCurrentMember",
      m."grantedAt",
      COUNT(er.id) AS "reviewCount",
      -- Correlated scalar subquery rather than joining comments in alongside event_reviews - a
      -- second one-to-many join here would fan out against event_reviews' own rows and corrupt
      -- COUNT(er.id)/AVG(er.rating)/etc, since each comment would multiply every review row (and
      -- vice versa). This way each side is aggregated independently before the outer GROUP BY.
      (
        SELECT COUNT(*) FROM comments c
        JOIN submissions cs ON cs."fileId" = c."submissionId"
        WHERE cs."eventId" = ${eventId} AND c."authorId" = u.id
      ) AS "commentCount",
      AVG(er.rating)::float8 AS "avgRating",
      MIN(er.rating) AS "minRating",
      MAX(er.rating) AS "maxRating",
      MAX(er."updatedAt") AS "lastActivity"
    FROM all_ids a
    JOIN users u ON u.id = a."userId"
    LEFT JOIN member_ids m ON m."userId" = a."userId"
    LEFT JOIN event_reviews er ON er."reviewerId" = a."userId"
    ${userId ? Prisma.sql`WHERE a."userId" = ${userId}` : Prisma.empty}
    GROUP BY u.id, m."userId", m."grantedAt"
    ORDER BY u."discordUsername" ASC
  `;
}

// Review.rating is stored as hundredths, same convention (and same reasoning) as
// reviews.service.ts's mapReviewStats/mapRawReviewRow.
export function mapUserRow(row: RawUserRow): UserRow {
  return {
    ...row,
    reviewCount: Number(row.reviewCount),
    commentCount: Number(row.commentCount),
    avgRating: row.avgRating == null ? null : row.avgRating / 100,
    minRating: row.minRating == null ? null : row.minRating / 100,
    maxRating: row.maxRating == null ? null : row.maxRating / 100,
  };
}

export type RawPlaystyleCountRow = { playstyle: Playstyle; count: bigint };

// Every reviewable submission in the event (not ignored, chart parsed successfully - a
// submission with no parsed chart can't be reviewed at all, see submission-detail-page.tsx's
// chart-gated "Add a review" button), grouped by the chart's own parsed playstyle. Independent
// of any particular reviewer - the same denominator applies to everyone in the event.
export function buildReviewableCountsByPlaystyleQuery(eventId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT c.playstyle, COUNT(*) AS count
    FROM submissions s
    JOIN charts c ON c."submissionId" = s."fileId"
    WHERE s."eventId" = ${eventId} AND NOT s."isIgnored" AND s."processingError" IS NULL
    GROUP BY c.playstyle
  `;
}

// This reviewer's own review count, grouped by the reviewed chart's current playstyle (not the
// review's own chartPlaystyle snapshot - the denominator above uses the chart's current parsed
// playstyle too, so both sides of the coverage fraction move together if a chart is reparsed).
export function buildReviewedCountsByPlaystyleQuery(eventId: string, userId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT c.playstyle, COUNT(*) AS count
    FROM reviews r
    JOIN submissions s ON s."fileId" = r."submissionId"
    JOIN charts c ON c."submissionId" = s."fileId"
    WHERE s."eventId" = ${eventId} AND r."reviewerId" = ${userId}
    GROUP BY c.playstyle
  `;
}

function mapPlaystyleCounts(rows: RawPlaystyleCountRow[]): Record<Playstyle, number> {
  const counts: Record<Playstyle, number> = { SINGLE: 0, DOUBLE: 0 };
  for (const row of rows) counts[row.playstyle] = Number(row.count);
  return counts;
}

export function mapCoverageByPlaystyle(
  reviewable: RawPlaystyleCountRow[],
  reviewed: RawPlaystyleCountRow[],
): CoverageByPlaystyle {
  const reviewableCounts = mapPlaystyleCounts(reviewable);
  const reviewedCounts = mapPlaystyleCounts(reviewed);
  return {
    SINGLE: { reviewedCount: reviewedCounts.SINGLE, reviewableCount: reviewableCounts.SINGLE },
    DOUBLE: { reviewedCount: reviewedCounts.DOUBLE, reviewableCount: reviewableCounts.DOUBLE },
  };
}

export type RawConsensusDeviationRow = {
  deviation: number | null;
  sampleCount: bigint;
};

export type ConsensusDeviation = {
  consensusDeviation: number | null;
  consensusSampleCount: number;
};

// "Other reviewers" is chart-hash scoped with no eventId filter, deliberately mirroring
// buildReviewStatsFragment's own convention (reviews.service.ts) - the same chart can be
// resubmitted across events, and the Reviews tab's own avgRating for a chart already includes
// every event's reviews of it, so comparing against that same population keeps this deviation
// consistent with the number a reviewer would see displayed elsewhere for that chart. own_reviews
// stays scoped to this event/user, since we only ever want to know about their own reviews here.
export function buildConsensusDeviationQuery(eventId: string, userId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT
      AVG(ABS(own.rating - other_avg.avg_rating))::float8 AS deviation,
      COUNT(*) AS "sampleCount"
    FROM reviews own
    JOIN submissions os ON os."fileId" = own."submissionId"
    CROSS JOIN LATERAL (
      SELECT AVG(other.rating)::float8 AS avg_rating
      FROM reviews other
      WHERE other."chartHash" = own."chartHash"
        AND other."reviewerId" <> ${userId}
        AND other.rating IS NOT NULL
    ) other_avg
    WHERE os."eventId" = ${eventId}
      AND own."reviewerId" = ${userId}
      AND own.rating IS NOT NULL
      AND other_avg.avg_rating IS NOT NULL
  `;
}

// Rating fields are hundredths-scaled ints, so ABS(own - other_avg) is hundredths-scaled too -
// same /100 convention as mapUserRow.
export function mapConsensusDeviation(
  row: RawConsensusDeviationRow | undefined,
): ConsensusDeviation {
  return {
    consensusDeviation: row?.deviation == null ? null : row.deviation / 100,
    consensusSampleCount: Number(row?.sampleCount ?? 0n),
  };
}

export type RawRatingMeterRow = {
  rating: number | null;
  chartPlaystyle: Playstyle;
  chartMeter: number;
  _count: { _all: number };
};

// Uses each Review's own chartPlaystyle/chartMeter snapshot (not the submission's current
// chart) - this table is about what the reviewer actually rated at the time, same reasoning as
// mapUserRecentReview displaying the review's own chart-identity snapshot rather than the
// submission's current one.
function buildRatingMeterTable(rows: RawRatingMeterRow[], playstyle: Playstyle): RatingMeterTable {
  const filtered = rows.filter((r) => r.chartPlaystyle === playstyle);
  const meters = [...new Set(filtered.map((r) => r.chartMeter))].sort((a, b) => a - b);
  const countsByKey = new Map(filtered.map((r) => [`${r.rating}:${r.chartMeter}`, r._count._all]));

  // Enumerates every RATING_OPTIONS value (scaled to hundredths for the lookup) plus a trailing
  // null bucket for "reviewed but left the rating blank" - a zero-count value still shows a row
  // instead of silently disappearing, so the table reads as a complete distribution rather than
  // an arbitrary subset of whatever this reviewer happened to pick.
  const buckets: { display: number | null; raw: number | null }[] = [
    ...RATING_OPTIONS.map((rating) => ({ display: rating, raw: Math.round(rating * 100) })),
    { display: null, raw: null },
  ];

  const rowsOut: RatingMeterRow[] = buckets.map(({ display, raw }) => {
    const counts = meters.map((meter) => countsByKey.get(`${raw}:${meter}`) ?? 0);
    return { rating: display, counts, total: counts.reduce((a, b) => a + b, 0) };
  });

  const columnTotals = meters.map((_meter, i) =>
    rowsOut.reduce((sum, row) => sum + row.counts[i], 0),
  );
  const grandTotal = columnTotals.reduce((a, b) => a + b, 0);

  return { meters, rows: rowsOut, columnTotals, grandTotal };
}

export function mapRatingBreakdown(rows: RawRatingMeterRow[]): RatingBreakdownByPlaystyle {
  return {
    SINGLE: buildRatingMeterTable(rows, 'SINGLE'),
    DOUBLE: buildRatingMeterTable(rows, 'DOUBLE'),
  };
}

// Standalone/exported so this is directly unit-testable, same reasoning as
// submissions.service.ts's mapReviewForDetail.
export function computeReviewIsStale(chartHash: string, currentChartHash: string | null): boolean {
  return chartHash !== currentChartHash;
}

type ReviewWithRelationsForDetail = {
  id: string;
  submissionId: string;
  chartHash: string;
  chartTitle: string;
  chartTitleRomaji: string;
  chartArtist: string;
  chartArtistRomaji: string;
  chartPlaystyle: Playstyle;
  chartDifficulty: Difficulty;
  chartMeter: number;
  rating: number | null;
  passing: number | null;
  scoring: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  submission: { chart: Chart | null };
  basicCheckReasons: {
    basicCheckReasonId: string;
    note: string | null;
    basicCheckReason: { code: string; label: string; level: BasicCheckLevel };
  }[];
};

export function mapUserRecentReview(review: ReviewWithRelationsForDetail): UserRecentReview {
  const currentChartHash = review.submission.chart?.hash ?? null;
  return {
    id: review.id,
    submissionId: review.submissionId,
    chartTitle: review.chartTitle,
    chartTitleRomaji: review.chartTitleRomaji,
    chartArtist: review.chartArtist,
    chartArtistRomaji: review.chartArtistRomaji,
    chartPlaystyle: review.chartPlaystyle,
    chartDifficulty: review.chartDifficulty,
    chartMeter: review.chartMeter,
    rating: review.rating == null ? null : review.rating / 100,
    passing: review.passing,
    scoring: review.scoring,
    notes: review.notes,
    basicChecks: review.basicCheckReasons.map((bc) => ({
      id: bc.basicCheckReasonId,
      code: bc.basicCheckReason.code,
      label: bc.basicCheckReason.label,
      level: bc.basicCheckReason.level,
      note: bc.note,
    })),
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    isStale: computeReviewIsStale(review.chartHash, currentChartHash),
  };
}

type CommentWithRelationsForDetail = {
  id: string;
  submissionId: string;
  chartHash: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  submission: { chart: Chart | null };
};

// Mirrors comments.service.ts's mapCommentForResponse's isStale/isEdited derivation - author is
// omitted here (it's always this reviewer, the fixed context of the whole page), and chart
// identity comes from the submission's CURRENT chart (Comment carries no identity snapshot of
// its own, unlike Review - see prisma/schema.prisma's Comment model comment).
export function mapUserRecentComment(comment: CommentWithRelationsForDetail): UserRecentComment {
  const chart = comment.submission.chart;
  return {
    id: comment.id,
    submissionId: comment.submissionId,
    body: comment.body,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    isEdited: comment.updatedAt.getTime() !== comment.createdAt.getTime(),
    isStale: comment.chartHash !== (chart?.hash ?? null),
    chart: chart && {
      title: chart.title,
      titleRomaji: chart.titleRomaji,
      artist: chart.artist,
      artistRomaji: chart.artistRomaji,
      playstyle: chart.playstyle,
      difficulty: chart.difficulty,
      meter: chart.meter,
    },
  };
}

const RECENT_REVIEWS_LIMIT = 25;
const RECENT_COMMENTS_LIMIT = 25;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listForEvent(eventId: string): Promise<UserRow[]> {
    const rows = await this.prisma.$queryRaw<RawUserRow[]>(buildUsersQuery(eventId));
    return rows.map(mapUserRow);
  }

  async getDetail(eventId: string, userId: string): Promise<UserDetail> {
    const rows = await this.prisma.$queryRaw<RawUserRow[]>(buildUsersQuery(eventId, userId));
    if (rows.length === 0) {
      throw new NotFoundException('No such user in this event');
    }

    const [reviews, grouped, reviewableByPlaystyle, reviewedByPlaystyle, comments, consensusRows] =
      await Promise.all([
        this.prisma.review.findMany({
          where: { reviewerId: userId, submission: { eventId } },
          orderBy: { updatedAt: 'desc' },
          take: RECENT_REVIEWS_LIMIT,
          include: {
            submission: { include: { chart: true } },
            basicCheckReasons: { include: { basicCheckReason: true } },
          },
        }),
        this.prisma.review.groupBy({
          by: ['rating', 'chartPlaystyle', 'chartMeter'],
          where: { reviewerId: userId, submission: { eventId } },
          _count: { _all: true },
        }),
        this.prisma.$queryRaw<RawPlaystyleCountRow[]>(
          buildReviewableCountsByPlaystyleQuery(eventId),
        ),
        this.prisma.$queryRaw<RawPlaystyleCountRow[]>(
          buildReviewedCountsByPlaystyleQuery(eventId, userId),
        ),
        this.prisma.comment.findMany({
          where: { authorId: userId, submission: { eventId } },
          orderBy: { updatedAt: 'desc' },
          take: RECENT_COMMENTS_LIMIT,
          include: { submission: { include: { chart: true } } },
        }),
        this.prisma.$queryRaw<RawConsensusDeviationRow[]>(
          buildConsensusDeviationQuery(eventId, userId),
        ),
      ]);

    return {
      ...mapUserRow(rows[0]),
      recentReviews: reviews.map(mapUserRecentReview),
      recentComments: comments.map(mapUserRecentComment),
      ratingBreakdown: mapRatingBreakdown(grouped),
      coverageByPlaystyle: mapCoverageByPlaystyle(reviewableByPlaystyle, reviewedByPlaystyle),
      ...mapConsensusDeviation(consensusRows[0]),
    };
  }
}
