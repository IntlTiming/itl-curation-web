import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  BasicCheckLevel,
  Chart,
  CmodPreference,
  ConsentToPublicReview,
  Difficulty,
  Playstyle,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ReviewsQueryDto } from './dto/reviews-query.dto.js';
import type { UpsertReviewDto } from './dto/upsert-review.dto.js';

// Trigram similarity threshold for the fuzzy text search below. Deliberately below
// pg_trgm's default 0.3 GUC (which only governs the `%` operator, not similarity()
// directly) since these are short individual fields, not the longer concatenated text
// that default was tuned around. Tune after eyeballing real search results.
const SIMILARITY_THRESHOLD = 0.2;

// pg_trgm's similarity() needs real trigram overlap to mean anything: a 1-2 character term
// only ever produces its own leading/trailing padding trigrams (e.g. "a" -> {"  a", " a "}),
// which essentially never occur inside a normal column value, so similarity() comes back ~0
// and the threshold above filters out every row - including exact matches. Below this length,
// match/rank by plain substring instead (see isMatchColumn/rankColumn).
const SHORT_SEARCH_TERM_LENGTH = 3;

// Escapes LIKE/ILIKE's own wildcard syntax out of user-typed search input, so e.g. searching
// literally for "%" doesn't become a match-everything wildcard. Postgres's default LIKE escape
// character is itself a backslash, so escaping backslash first (before introducing new ones for
// % and _) is what keeps this correct without an explicit ESCAPE clause.
function escapeLikePattern(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// Whether `column` counts as a match for `term` in the WHERE clause - see
// SHORT_SEARCH_TERM_LENGTH's comment for why short terms need a different strategy than
// similarity().
function isMatchColumn(column: Prisma.Sql, term: string): Prisma.Sql {
  if (term.length < SHORT_SEARCH_TERM_LENGTH) {
    return Prisma.sql`${column} ILIKE ${'%' + escapeLikePattern(term) + '%'}`;
  }
  return Prisma.sql`similarity(${column}, ${term}) > ${SIMILARITY_THRESHOLD}`;
}

// Per-column relevance score for ORDER BY - similarity() is a real 0..1 score at 3+ characters,
// but degrades to a plain 0/1 "does it contain the term at all" below that, since there's no
// meaningful gradient to rank by yet.
function rankColumn(column: Prisma.Sql, term: string): Prisma.Sql {
  if (term.length < SHORT_SEARCH_TERM_LENGTH) {
    return Prisma.sql`(CASE WHEN ${column} ILIKE ${'%' + escapeLikePattern(term) + '%'} THEN 1 ELSE 0 END)`;
  }
  return Prisma.sql`similarity(${column}, ${term})`;
}

type RawReviewRow = {
  fileId: string;
  submitter: string;
  stepartist: string;
  pack: string;
  cmodPreference: CmodPreference;
  consentToPublicReview: ConsentToPublicReview | null;
  isIgnored: boolean;
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
  hasSignificantTimingChanges: boolean;
  reviewCount: bigint;
  avgRating: number | null;
  minRating: number | null;
  maxRating: number | null;
  stdevRating: number | null;
  hasOwnReview: boolean;
  commentCount: bigint;
  lastActivity: Date | null;
  // TechTag.label values (not codes - shortened to codes for display client-side, same as
  // submission-detail's techTags field) the submission has claimed, alphabetical for a stable
  // display order.
  techTags: string[];
};

// A union member of ReviewsRow.basicChecks - deduped by BasicCheckReason across every active
// review on the chart, so a reason two different reviewers both flagged appears once.
export type ReviewsBasicCheck = {
  id: string;
  code: string;
  label: string;
  level: BasicCheckLevel;
};

export type ReviewsRow = {
  fileId: string;
  submitter: string;
  stepartist: string;
  pack: string;
  cmodPreference: CmodPreference;
  consentToPublicReview: ConsentToPublicReview | null;
  isIgnored: boolean;
  // TechTag labels this submission has claimed (submissionId-scoped, like commentCount/
  // lastActivity above - not chart-hash scoped). Alphabetical, for a stable display order.
  techTags: string[];
  chart: {
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
    hasSignificantTimingChanges: boolean;
  };
  reviewCount: number;
  // avgRating/minRating/maxRating/stdevRating are all computed over only the active reviews
  // that actually carry a rating (Review.rating is nullable - reviewers sometimes leave it
  // blank while still recording passing/scoring/notes) - null when none of them do.
  avgRating: number | null;
  minRating: number | null;
  maxRating: number | null;
  stdevRating: number | null;
  // Whether the CURRENT user already has a review row on this exact submission (by fileId, not
  // chart hash - matches the Review@@unique([submissionId, reviewerId]) scope the edit modal's
  // upsert endpoint operates on), so the Add/Edit icon can distinguish the two states.
  hasOwnReview: boolean;
  // Both of the following are submissionId-scoped, NOT chart-hash matched like every field
  // above them - deliberately different from reviewCount/avgRating/etc. See Comment's schema
  // comment and the file header's chart-identity note for why comments never cross-match.
  commentCount: number;
  lastActivity: Date | null;
  // Union of every basic-check flag raised across all of this chart's active reviews, and the
  // two booleans summarizing it for the Reviews table's row tint - DISQUALIFIED takes visual
  // precedence over WARNING when a chart has both. Chart-hash scoped, like reviewCount/
  // avgRating above (not submissionId-scoped like commentCount/lastActivity).
  basicChecks: ReviewsBasicCheck[];
  hasWarning: boolean;
  hasDisqualification: boolean;
};

export type ReviewsResponse = {
  rows: ReviewsRow[];
  meterBounds: { min: number; max: number } | null;
  // Total non-ignored submissions for this playstyle under the DEFAULT filter set (no search,
  // no unreviewed-only, full meter range) - a stable baseline the frontend uses for "Showing
  // x of y" text, independent of whichever other filters happen to be active right now.
  totalCount: number;
};

export function mapRawReviewRow(row: RawReviewRow, basicChecks: ReviewsBasicCheck[]): ReviewsRow {
  return {
    fileId: row.fileId,
    submitter: row.submitter,
    stepartist: row.stepartist,
    pack: row.pack,
    cmodPreference: row.cmodPreference,
    consentToPublicReview: row.consentToPublicReview,
    isIgnored: row.isIgnored,
    techTags: row.techTags,
    chart: {
      hash: row.hash,
      title: row.title,
      titleRomaji: row.titleRomaji,
      subtitle: row.subtitle,
      subtitleRomaji: row.subtitleRomaji,
      artist: row.artist,
      artistRomaji: row.artistRomaji,
      playstyle: row.playstyle,
      difficulty: row.difficulty,
      meter: row.meter,
      hasSignificantTimingChanges: row.hasSignificantTimingChanges,
    },
    reviewCount: Number(row.reviewCount),
    // Review.rating is stored as hundredths (e.g. 150 = 1.50); AVG/MIN/MAX preserve that scale
    // exactly and STDDEV_POP scales linearly, so all four convert the same way on the way out.
    avgRating: row.avgRating == null ? null : row.avgRating / 100,
    minRating: row.minRating == null ? null : row.minRating / 100,
    maxRating: row.maxRating == null ? null : row.maxRating / 100,
    stdevRating: row.stdevRating == null ? null : row.stdevRating / 100,
    hasOwnReview: row.hasOwnReview,
    commentCount: Number(row.commentCount),
    lastActivity: row.lastActivity,
    basicChecks,
    hasWarning: basicChecks.some((check) => check.level === 'WARNING'),
    hasDisqualification: basicChecks.some((check) => check.level === 'DISQUALIFIED'),
  };
}

// DISQUALIFIED-level checks sort before WARNING (the more severe state first), then
// alphabetically by label within a level - a stable, predictable order for the Reviews
// table's under-title check list.
function sortReviewsBasicChecks(checks: ReviewsBasicCheck[]): ReviewsBasicCheck[] {
  return [...checks].sort((a, b) => {
    if (a.level !== b.level) return a.level === 'DISQUALIFIED' ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

// Shared by the Reviews tab's per-chart aggregate stats and the submission-detail page's
// single-chart lookup, so the two pages' numbers are computed by the exact same SQL rather than
// risking drift from two hand-written copies. `chartHashRef` is a Prisma.Sql fragment - either a
// correlated column reference (e.g. `Prisma.sql\`c.hash\``, for use inside a LATERAL join) or a
// literal value wrapped as `Prisma.sql\`${hash}\`` (for a standalone query).
export function buildReviewStatsFragment(chartHashRef: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    SELECT
      COUNT(*)             AS review_count,
      AVG(rating)::float8  AS avg_rating,
      MIN(rating)          AS min_rating,
      MAX(rating)          AS max_rating,
      -- STDDEV_POP of a single value is 0, not NULL - misleadingly reading as "reviewers
      -- agree" rather than "not enough ratings to measure agreement yet". COUNT(rating) (not
      -- review_count/COUNT(*)) since rating itself is nullable - a review can exist with no
      -- rating set, and that shouldn't count toward "enough data".
      CASE WHEN COUNT(rating) < 2 THEN NULL ELSE STDDEV_POP(rating) END AS stdev_rating
    FROM reviews r
    WHERE r."chartHash" = ${chartHashRef}
  `;
}

export type RawReviewStats = {
  review_count: bigint;
  avg_rating: number | null;
  min_rating: number | null;
  max_rating: number | null;
  stdev_rating: number | null;
};

export type ReviewStats = {
  reviewCount: number;
  avgRating: number | null;
  minRating: number | null;
  maxRating: number | null;
  stdevRating: number | null;
};

type BasicCheckPair = { basicCheckReasonId: string; note: string | null };

function sortedBasicChecks(checks: BasicCheckPair[]): BasicCheckPair[] {
  return [...checks].sort((a, b) => a.basicCheckReasonId.localeCompare(b.basicCheckReasonId));
}

type ReviewFields = {
  rating: number | null;
  passing: number | null;
  scoring: number | null;
  notes: string | null;
  basicChecks: BasicCheckPair[];
};

// The DTO makes every field optional so partial edits (e.g. only touching notes) don't have to
// resend everything, but a review saved with literally nothing set is never a real opinion - the
// client already blocks this in review-modal.tsx, and this is the server-side backstop for any
// other caller (direct API use, a future second frontend) that might not.
export function reviewFieldsEmpty(fields: ReviewFields): boolean {
  return (
    fields.rating == null &&
    fields.passing == null &&
    fields.scoring == null &&
    !fields.notes &&
    fields.basicChecks.length === 0
  );
}

// Decides whether saving a review needs a ReviewRevision written at all - an idempotent re-save
// (e.g. the reviewer just reopened and resubmitted without changing anything) shouldn't flood the
// append-only audit trail with no-op entries.
export function reviewFieldsChanged(existing: ReviewFields, next: ReviewFields): boolean {
  if (existing.rating !== next.rating) return true;
  if (existing.passing !== next.passing) return true;
  if (existing.scoring !== next.scoring) return true;
  if (existing.notes !== next.notes) return true;

  const a = sortedBasicChecks(existing.basicChecks);
  const b = sortedBasicChecks(next.basicChecks);
  if (a.length !== b.length) return true;
  return a.some(
    (check, i) => check.basicCheckReasonId !== b[i].basicCheckReasonId || check.note !== b[i].note,
  );
}

// Scales rating back to a plain decimal (same convention as mapRawReviewRow) before returning
// an upserted review to the client - the DTO takes/returns plain decimals everywhere else, so
// the raw hundredths-scaled Review row shouldn't leak through this one endpoint.
export function mapUpsertedReview<
  T extends {
    rating: number | null;
    basicCheckReasons: {
      basicCheckReasonId: string;
      note: string | null;
      basicCheckReason: { code: string; label: string; level: string };
    }[];
  },
>(review: T) {
  return {
    ...review,
    rating: review.rating == null ? null : review.rating / 100,
    basicCheckReasons: review.basicCheckReasons.map((check) => ({
      basicCheckReasonId: check.basicCheckReasonId,
      note: check.note,
      code: check.basicCheckReason.code,
      label: check.basicCheckReason.label,
      level: check.basicCheckReason.level,
    })),
  };
}

export function mapReviewStats(row: RawReviewStats | undefined): ReviewStats {
  return {
    reviewCount: Number(row?.review_count ?? 0n),
    avgRating: row?.avg_rating == null ? null : row.avg_rating / 100,
    minRating: row?.min_rating == null ? null : row.min_rating / 100,
    maxRating: row?.max_rating == null ? null : row.max_rating / 100,
    stdevRating: row?.stdev_rating == null ? null : row.stdev_rating / 100,
  };
}

const SEARCHED_COLUMNS = [
  Prisma.sql`c.title`,
  Prisma.sql`c."titleRomaji"`,
  Prisma.sql`c.subtitle`,
  Prisma.sql`c."subtitleRomaji"`,
  Prisma.sql`c.artist`,
  Prisma.sql`c."artistRomaji"`,
  Prisma.sql`s.stepartist`,
  Prisma.sql`s.pack`,
];

// Per-submission tag-overlap stats against the currently-selected tech tag codes, used only for
// the "best match" default ordering (see buildTechTagRankFragment) - never exposed in the SELECT
// list since the frontend doesn't need to see match detail, only row order. Meant to be joined
// in as a LATERAL correlated to s."fileId" (see listForEvent), aliased "tag_match".
export function buildTechTagMatchFragment(techTagCodes: string[]): Prisma.Sql {
  return Prisma.sql`
    SELECT
      COUNT(*) FILTER (WHERE tt.code IN (${Prisma.join(techTagCodes)})) AS overlap_count,
      COUNT(*)                                                          AS claimed_count
    FROM submission_tech_tags stt
    JOIN tech_tags tt ON tt.id = stt."techTagId"
    WHERE stt."submissionId" = s."fileId"
  `;
}

// Ranks the currently-selected tech tags the same way search relevance ranks a term: a
// submission whose full claimed tag SET exactly equals the selection (no more, no fewer) ranks
// first, then by overlap count descending, then by extra/unrelated claimed-tag count ascending
// (fewer extras is closer to an exact match). Only meaningful when buildTechTagMatchFragment's
// LATERAL join (aliased tag_match) is present in the FROM clause - see listForEvent.
export function buildTechTagRankFragment(techTagCodes: string[]): Prisma.Sql {
  return Prisma.sql`
    (CASE WHEN tag_match.overlap_count = tag_match.claimed_count
               AND tag_match.claimed_count = ${techTagCodes.length}
          THEN 0 ELSE 1 END) ASC,
    tag_match.overlap_count DESC,
    (tag_match.claimed_count - tag_match.overlap_count) ASC
  `;
}

// Row order used whenever no user-triggered column sort is active: Playstyle single before
// double (moot in practice since Playstyle is a forced single-select filter, but applied
// for completeness), then meter, then difficulty slot in its natural (not alphabetical)
// order, then title. When a search term is present, relevance ranks first.
const DEFAULT_ORDER_FRAGMENTS = [
  Prisma.sql`c.playstyle ASC`,
  Prisma.sql`c.meter ASC`,
  Prisma.sql`CASE c.difficulty WHEN 'BEGINNER' THEN 0 WHEN 'EASY' THEN 1 WHEN 'MEDIUM' THEN 2 WHEN 'HARD' THEN 3 WHEN 'CHALLENGE' THEN 4 END ASC`,
  Prisma.sql`COALESCE(NULLIF(c."titleRomaji", ''), c.title) ASC`,
];

// Shared by the bounds query and the rows query so the meter range shown to the user is
// always computed against every OTHER active filter (search/playstyle/unreviewed) without
// being narrowed by the user's own meter selection. Exported standalone (rather than a
// private service method) so it's directly unit-testable without mocking Prisma.
export function buildBaseWhereFragments(eventId: string, query: ReviewsQueryDto): Prisma.Sql[] {
  // Both queries below INNER JOIN charts, so submissions with no successfully parsed
  // chart (Meter/Title have nothing to show for them) are excluded implicitly. Ignored
  // submissions are always excluded too - there's no UI control for surfacing them yet
  // (removed along with ReviewsQueryDto.includeIgnored; see git history to reintroduce).
  const fragments: Prisma.Sql[] = [
    Prisma.sql`s."eventId" = ${eventId}`,
    Prisma.sql`c.playstyle = ${query.playstyle}::"Playstyle"`,
    Prisma.sql`s."isIgnored" = false`,
  ];

  if (query.unreviewedOnly) {
    fragments.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM reviews r WHERE r."chartHash" = c.hash)`);
  }

  if (query.publiclyReviewableOnly) {
    fragments.push(Prisma.sql`s."consentToPublicReview" = 'CONSENTS'::"ConsentToPublicReview"`);
  }

  if (query.techTags.length > 0) {
    fragments.push(Prisma.sql`
      EXISTS (
        SELECT 1 FROM submission_tech_tags stt
        JOIN tech_tags tt ON tt.id = stt."techTagId"
        WHERE stt."submissionId" = s."fileId"
          AND tt.code IN (${Prisma.join(query.techTags)})
      )
    `);
  }

  const term = query.search?.trim();
  if (term) {
    const matchChecks = SEARCHED_COLUMNS.map((column) => isMatchColumn(column, term));
    fragments.push(Prisma.sql`(${Prisma.join(matchChecks, ' OR ')})`);
  }

  return fragments;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForEvent(
    eventId: string,
    userId: string,
    query: ReviewsQueryDto,
  ): Promise<ReviewsResponse> {
    const term = query.search?.trim() || null;
    const baseFragments = buildBaseWhereFragments(eventId, query);
    const baseWhere = Prisma.join(baseFragments, ' AND ');

    const bounds = await this.prisma.$queryRaw<
      { minMeter: number | null; maxMeter: number | null }[]
    >(
      Prisma.sql`
        SELECT MIN(c.meter)::int AS "minMeter", MAX(c.meter)::int AS "maxMeter"
        FROM submissions s
        JOIN charts c ON c."submissionId" = s."fileId"
        WHERE ${baseWhere}
      `,
    );

    const rowFragments = [...baseFragments];
    if (query.minMeter !== undefined) {
      rowFragments.push(Prisma.sql`c.meter >= ${query.minMeter}`);
    }
    if (query.maxMeter !== undefined) {
      rowFragments.push(Prisma.sql`c.meter <= ${query.maxMeter}`);
    }
    const rowsWhere = Prisma.join(rowFragments, ' AND ');

    const orderFragments = [...DEFAULT_ORDER_FRAGMENTS];
    if (term) {
      const rankExpr = Prisma.sql`GREATEST(${Prisma.join(
        SEARCHED_COLUMNS.map((column) => rankColumn(column, term)),
        ', ',
      )})`;
      orderFragments.unshift(Prisma.sql`(${rankExpr}) DESC`);
    }
    // Unshifted after (so it ends up before) the search-relevance rank above: a deliberate
    // structured tag selection is a stronger "best match" signal than fuzzy free-text relevance
    // when both are active at once.
    if (query.techTags.length > 0) {
      orderFragments.unshift(buildTechTagRankFragment(query.techTags));
    }
    const orderBy = Prisma.join(orderFragments, ', ');

    // Only joined when a tag filter is active - buildTechTagRankFragment's ORDER BY references
    // are meaningless (and this LATERAL join unnecessary work) otherwise.
    const techTagJoin =
      query.techTags.length > 0
        ? Prisma.sql`JOIN LATERAL (${buildTechTagMatchFragment(query.techTags)}) tag_match ON true`
        : Prisma.sql``;

    const rawRows = await this.prisma.$queryRaw<RawReviewRow[]>(
      Prisma.sql`
        SELECT
          s."fileId"                      AS "fileId",
          s.submitter,
          s.stepartist,
          s.pack,
          s."cmodPreference"              AS "cmodPreference",
          s."consentToPublicReview"       AS "consentToPublicReview",
          s."isIgnored"                   AS "isIgnored",
          c.hash,
          c.title,
          c."titleRomaji"                 AS "titleRomaji",
          c.subtitle,
          c."subtitleRomaji"              AS "subtitleRomaji",
          c.artist,
          c."artistRomaji"                AS "artistRomaji",
          c.playstyle,
          c.difficulty,
          c.meter,
          c."hasSignificantTimingChanges" AS "hasSignificantTimingChanges",
          review_stats.review_count       AS "reviewCount",
          review_stats.avg_rating         AS "avgRating",
          review_stats.min_rating         AS "minRating",
          review_stats.max_rating         AS "maxRating",
          review_stats.stdev_rating       AS "stdevRating",
          EXISTS (
            SELECT 1 FROM reviews r2
            WHERE r2."submissionId" = s."fileId" AND r2."reviewerId" = ${userId}
          )                                AS "hasOwnReview",
          (SELECT COUNT(*) FROM comments cm WHERE cm."submissionId" = s."fileId")
                                           AS "commentCount",
          GREATEST(s."lastReviewAt", s."lastCommentAt") AS "lastActivity",
          (
            SELECT COALESCE(array_agg(tt3.label ORDER BY tt3.label), ARRAY[]::text[])
            FROM submission_tech_tags stt3
            JOIN tech_tags tt3 ON tt3.id = stt3."techTagId"
            WHERE stt3."submissionId" = s."fileId"
          )                                AS "techTags"
        FROM submissions s
        JOIN charts c ON c."submissionId" = s."fileId"
        JOIN LATERAL (${buildReviewStatsFragment(Prisma.sql`c.hash`)}) review_stats ON true
        ${techTagJoin}
        WHERE ${rowsWhere}
        ORDER BY ${orderBy}
      `,
    );

    // Fetched separately from the raw-SQL rows above (via the ordinary Prisma query builder,
    // same as submission-detail's getForEvent) rather than folded into the same query as a
    // json_agg LATERAL - a chart can carry an unbounded set of distinct check reasons, which
    // doesn't fit the fixed-column raw-SQL row shape as cleanly as one extra include-style
    // fetch keyed by chartHash.
    const chartHashes = [...new Set(rawRows.map((row) => row.hash))];
    const basicCheckRows = chartHashes.length
      ? await this.prisma.reviewBasicCheck.findMany({
          where: { review: { chartHash: { in: chartHashes } } },
          select: {
            review: { select: { chartHash: true } },
            basicCheckReason: { select: { id: true, code: true, label: true, level: true } },
          },
        })
      : [];

    // Deduped by BasicCheckReason id within a chartHash, since two different reviewers can
    // raise the exact same reason - the table shows the union of distinct reasons, not one
    // badge per reviewer.
    const basicChecksByHash = new Map<string, Map<string, ReviewsBasicCheck>>();
    for (const { review, basicCheckReason } of basicCheckRows) {
      let checks = basicChecksByHash.get(review.chartHash);
      if (!checks) {
        checks = new Map();
        basicChecksByHash.set(review.chartHash, checks);
      }
      checks.set(basicCheckReason.id, basicCheckReason);
    }

    const minMeter = bounds[0]?.minMeter;
    const maxMeter = bounds[0]?.maxMeter;

    const defaultFragments: Prisma.Sql[] = [
      Prisma.sql`s."eventId" = ${eventId}`,
      Prisma.sql`c.playstyle = ${query.playstyle}::"Playstyle"`,
      Prisma.sql`s."isIgnored" = false`,
    ];
    const totalCountRows = await this.prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`
        SELECT COUNT(*) AS count
        FROM submissions s
        JOIN charts c ON c."submissionId" = s."fileId"
        WHERE ${Prisma.join(defaultFragments, ' AND ')}
      `,
    );

    return {
      rows: rawRows.map((row) =>
        mapRawReviewRow(
          row,
          sortReviewsBasicChecks([...(basicChecksByHash.get(row.hash)?.values() ?? [])]),
        ),
      ),
      meterBounds: minMeter != null && maxMeter != null ? { min: minMeter, max: maxMeter } : null,
      totalCount: Number(totalCountRows[0]?.count ?? 0),
    };
  }

  // Upsert semantics via Review's own @@unique([submissionId, reviewerId]) - always scoped to
  // reviewerId = the calling user, so "only the author can edit their own review" holds by
  // construction rather than needing a separate ownership check.
  async upsertOwnReview(eventId: string, fileId: string, reviewerId: string, dto: UpsertReviewDto) {
    const submission = await this.prisma.submission.findUnique({
      where: { fileId },
      include: { chart: true },
    });
    if (!submission || submission.eventId !== eventId) {
      throw new NotFoundException(`No submission with id "${fileId}"`);
    }
    if (!submission.chart) {
      throw new BadRequestException('Cannot review a submission with no parsed chart');
    }

    const upserted = await this.upsertReviewTransaction(fileId, reviewerId, submission.chart, dto);
    return mapUpsertedReview(upserted);
  }

  // Recomputed via MAX rather than stamped with now() - correct across multiple reviewers,
  // no special-casing needed for the no-op-resave branch below (see CommentsService's
  // recomputeLastCommentAt for the same reasoning on the Comments side).
  private async recomputeLastReviewAt(tx: Prisma.TransactionClient, fileId: string) {
    const agg = await tx.review.aggregate({
      where: { submissionId: fileId },
      _max: { updatedAt: true },
    });
    await tx.submission.update({
      where: { fileId },
      data: { lastReviewAt: agg._max.updatedAt },
    });
  }

  private upsertReviewTransaction(
    fileId: string,
    reviewerId: string,
    chart: Chart,
    dto: UpsertReviewDto,
  ) {
    // Snapshotted onto the Review row alongside chartHash below - see the schema comment
    // on Review.chartTitle for why.
    const chartSnapshot = {
      chartHash: chart.hash,
      chartTitle: chart.title,
      chartTitleRomaji: chart.titleRomaji,
      chartSubtitle: chart.subtitle,
      chartSubtitleRomaji: chart.subtitleRomaji,
      chartArtist: chart.artist,
      chartArtistRomaji: chart.artistRomaji,
      chartPlaystyle: chart.playstyle,
      chartDifficulty: chart.difficulty,
      chartMeter: chart.meter,
    };

    const nextFields: ReviewFields = {
      rating: dto.rating == null ? null : Math.round(dto.rating * 100),
      passing: dto.passing ?? null,
      scoring: dto.scoring ?? null,
      notes: dto.notes ?? null,
      basicChecks: (dto.basicChecks ?? []).map((check) => ({
        basicCheckReasonId: check.basicCheckReasonId,
        note: check.note ?? null,
      })),
    };

    if (reviewFieldsEmpty(nextFields)) {
      throw new BadRequestException('Review must include at least one field');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.review.findUnique({
        where: { submissionId_reviewerId: { submissionId: fileId, reviewerId } },
        include: { basicCheckReasons: true },
      });

      const reviewInclude = { basicCheckReasons: { include: { basicCheckReason: true } } };

      if (existing) {
        const existingFields: ReviewFields = {
          rating: existing.rating,
          passing: existing.passing,
          scoring: existing.scoring,
          notes: existing.notes,
          basicChecks: existing.basicCheckReasons.map((check) => ({
            basicCheckReasonId: check.basicCheckReasonId,
            note: check.note,
          })),
        };

        if (!reviewFieldsChanged(existingFields, nextFields)) {
          // No ReviewRevision here - nothing about the review's own opinion changed, so there's
          // nothing worth auditing. But the chart identity (chartHash included) still gets
          // re-snapshotted: resaving an unmodified review is itself an explicit re-affirmation
          // that it still applies to the chart as it stands today, and should un-stale it the
          // same as an edit does below - otherwise a reviewer who resaves without touching any
          // field would see the review stay marked outdated indefinitely.
          const unchanged = await tx.review.update({
            where: { id: existing.id },
            data: { ...chartSnapshot },
            include: reviewInclude,
          });
          await this.recomputeLastReviewAt(tx, fileId);
          return unchanged;
        }

        const revision = await tx.reviewRevision.create({
          data: {
            reviewId: existing.id,
            chartHash: existing.chartHash,
            chartTitle: existing.chartTitle,
            chartTitleRomaji: existing.chartTitleRomaji,
            chartSubtitle: existing.chartSubtitle,
            chartSubtitleRomaji: existing.chartSubtitleRomaji,
            chartArtist: existing.chartArtist,
            chartArtistRomaji: existing.chartArtistRomaji,
            chartPlaystyle: existing.chartPlaystyle,
            chartDifficulty: existing.chartDifficulty,
            chartMeter: existing.chartMeter,
            rating: existing.rating,
            passing: existing.passing,
            scoring: existing.scoring,
            notes: existing.notes,
            supersededById: reviewerId,
          },
        });
        if (existing.basicCheckReasons.length > 0) {
          await tx.reviewRevisionBasicCheck.createMany({
            data: existing.basicCheckReasons.map((check) => ({
              reviewRevisionId: revision.id,
              basicCheckReasonId: check.basicCheckReasonId,
              note: check.note,
            })),
          });
        }

        // Saving always re-snapshots chartHash (and the rest of the chart identity fields)
        // to the chart's current state - any edit re-affirms the review still applies to
        // the chart as it stands today, un-staling it.
        await tx.review.update({
          where: { id: existing.id },
          data: {
            ...chartSnapshot,
            rating: nextFields.rating,
            passing: nextFields.passing,
            scoring: nextFields.scoring,
            notes: nextFields.notes,
          },
        });
        await tx.reviewBasicCheck.deleteMany({ where: { reviewId: existing.id } });
        if (nextFields.basicChecks.length > 0) {
          await tx.reviewBasicCheck.createMany({
            data: nextFields.basicChecks.map((check) => ({
              reviewId: existing.id,
              basicCheckReasonId: check.basicCheckReasonId,
              note: check.note,
            })),
          });
        }

        const updated = await tx.review.findUniqueOrThrow({
          where: { id: existing.id },
          include: reviewInclude,
        });
        await this.recomputeLastReviewAt(tx, fileId);
        return updated;
      }

      const created = await tx.review.create({
        data: {
          submissionId: fileId,
          reviewerId,
          ...chartSnapshot,
          rating: nextFields.rating,
          passing: nextFields.passing,
          scoring: nextFields.scoring,
          notes: nextFields.notes,
        },
      });
      if (nextFields.basicChecks.length > 0) {
        await tx.reviewBasicCheck.createMany({
          data: nextFields.basicChecks.map((check) => ({
            reviewId: created.id,
            basicCheckReasonId: check.basicCheckReasonId,
            note: check.note,
          })),
        });
      }

      const result = await tx.review.findUniqueOrThrow({
        where: { id: created.id },
        include: reviewInclude,
      });
      await this.recomputeLastReviewAt(tx, fileId);
      return result;
    });
  }
}
