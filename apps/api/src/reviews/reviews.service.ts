import { Injectable } from '@nestjs/common';
import type { CmodPreference, ConsentToPublicReview, Difficulty, Playstyle } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ReviewsQueryDto } from './dto/reviews-query.dto.js';

// Trigram similarity threshold for the fuzzy text search below. Deliberately below
// pg_trgm's default 0.3 GUC (which only governs the `%` operator, not similarity()
// directly) since these are short individual fields, not the longer concatenated text
// that default was tuned around. Tune after eyeballing real search results.
const SIMILARITY_THRESHOLD = 0.2;

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
};

export type ReviewsRow = {
  fileId: string;
  submitter: string;
  stepartist: string;
  pack: string;
  cmodPreference: CmodPreference;
  consentToPublicReview: ConsentToPublicReview | null;
  isIgnored: boolean;
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
};

export type ReviewsResponse = {
  rows: ReviewsRow[];
  meterBounds: { min: number; max: number } | null;
  // Total non-ignored submissions for this playstyle under the DEFAULT filter set (no search,
  // no unreviewed-only, full meter range) - a stable baseline the frontend uses for "Showing
  // x of y" text, independent of whichever other filters happen to be active right now.
  totalCount: number;
};

export function mapRawReviewRow(row: RawReviewRow): ReviewsRow {
  return {
    fileId: row.fileId,
    submitter: row.submitter,
    stepartist: row.stepartist,
    pack: row.pack,
    cmodPreference: row.cmodPreference,
    consentToPublicReview: row.consentToPublicReview,
    isIgnored: row.isIgnored,
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

  const term = query.search?.trim();
  if (term) {
    const similarityChecks = SEARCHED_COLUMNS.map(
      (column) => Prisma.sql`similarity(${column}, ${term}) > ${SIMILARITY_THRESHOLD}`,
    );
    fragments.push(Prisma.sql`(${Prisma.join(similarityChecks, ' OR ')})`);
  }

  return fragments;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForEvent(eventId: string, query: ReviewsQueryDto): Promise<ReviewsResponse> {
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
        SEARCHED_COLUMNS.map((column) => Prisma.sql`similarity(${column}, ${term})`),
        ', ',
      )})`;
      orderFragments.unshift(Prisma.sql`(${rankExpr}) DESC`);
    }
    const orderBy = Prisma.join(orderFragments, ', ');

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
          review_stats.stdev_rating       AS "stdevRating"
        FROM submissions s
        JOIN charts c ON c."submissionId" = s."fileId"
        JOIN LATERAL (
          SELECT
            COUNT(*)             AS review_count,
            AVG(rating)::float8  AS avg_rating,
            MIN(rating)          AS min_rating,
            MAX(rating)          AS max_rating,
            STDDEV_POP(rating)   AS stdev_rating
          FROM reviews r
          WHERE r."chartHash" = c.hash
        ) review_stats ON true
        WHERE ${rowsWhere}
        ORDER BY ${orderBy}
      `,
    );

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
      rows: rawRows.map(mapRawReviewRow),
      meterBounds: minMeter != null && maxMeter != null ? { min: minMeter, max: maxMeter } : null,
      totalCount: Number(totalCountRows[0]?.count ?? 0),
    };
  }
}
