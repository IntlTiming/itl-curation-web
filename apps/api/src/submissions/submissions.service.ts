import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  BasicCheckLevel,
  Chart,
  Review,
  Submission,
  SubmissionTechTag,
  TechTag,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  buildReviewStatsFragment,
  mapReviewStats,
  type RawReviewStats,
} from '../reviews/reviews.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

type SubmissionWithRelations = Submission & {
  chart: Chart | null;
  techTags: (SubmissionTechTag & { techTag: TechTag })[];
  singleTechTag: TechTag | null;
};

function mapSubmission(row: SubmissionWithRelations) {
  return {
    fileId: row.fileId,
    stepartist: row.stepartist,
    submitter: row.submitter,
    pack: row.pack,
    playstyle: row.playstyle,
    difficulty: row.difficulty,
    focus: row.focus,
    derivedFocus: row.derivedFocus,
    cmodPreference: row.cmodPreference,
    releaseYear: row.releaseYear,
    theme: row.theme,
    additionalNotes: row.additionalNotes,
    consentToPublicReview: row.consentToPublicReview,
    fileUrl: row.fileUrl,
    driveMd5: row.driveMd5,
    songDir: row.songDir,
    bannerSlug: row.bannerSlug,
    isInternal: row.isInternal,
    isIgnored: row.isIgnored,
    submittedAt: row.submittedAt,
    processingError: row.processingError,
    techTags: row.techTags.map((t) => t.techTag.label),
    singleTechTag: row.singleTechTag?.label ?? null,
    chart: row.chart && {
      hash: row.chart.hash,
      title: row.chart.title,
      titleRomaji: row.chart.titleRomaji,
      subtitle: row.chart.subtitle,
      subtitleRomaji: row.chart.subtitleRomaji,
      artist: row.chart.artist,
      artistRomaji: row.chart.artistRomaji,
      playstyle: row.chart.playstyle,
      difficulty: row.chart.difficulty,
      meter: row.chart.meter,
      minBpm: row.chart.minBpm,
      maxBpm: row.chart.maxBpm,
      totalSteps: row.chart.totalSteps,
      totalRolls: row.chart.totalRolls,
      totalHolds: row.chart.totalHolds,
      totalMines: row.chart.totalMines,
      totalJumps: row.chart.totalJumps,
      lengthSeconds: row.chart.lengthSeconds,
      totalMeasures: row.chart.totalMeasures,
      totalBreakMeasures: row.chart.totalBreakMeasures,
      totalStreamMeasures: row.chart.totalStreamMeasures,
      totalTrueStreamMeasures: row.chart.totalTrueStreamMeasures,
      weightedNps: row.chart.weightedNps / 1000,
      hasSignificantTimingChanges: row.chart.hasSignificantTimingChanges,
      bracketCount: row.chart.bracketCount,
      halfCrossoverCount: row.chart.halfCrossoverCount,
      fullCrossoverCount: row.chart.fullCrossoverCount,
      crossoverCount: row.chart.crossoverCount,
      downFootswitchCount: row.chart.downFootswitchCount,
      upFootswitchCount: row.chart.upFootswitchCount,
      footswitchCount: row.chart.footswitchCount,
      doublestepCount: row.chart.doublestepCount,
      jackCount: row.chart.jackCount,
      sideswitchCount: row.chart.sideswitchCount,
    },
  };
}

type ReviewWithRelations = Review & {
  reviewer: {
    id: string;
    displayName: string | null;
    discordUsername: string;
    discordId: string;
    discordAvatarHash: string | null;
  };
  basicCheckReasons: {
    basicCheckReasonId: string;
    note: string | null;
    basicCheckReason: { code: string; label: string; level: BasicCheckLevel };
  }[];
};

type ReviewRevisionRow = {
  chartHash: string;
  rating: number | null;
  passing: number | null;
  scoring: number | null;
  notes: string | null;
  supersededAt: Date;
  basicCheckReasons: {
    basicCheckReasonId: string;
    note: string | null;
    basicCheckReason: { code: string; label: string; level: BasicCheckLevel };
  }[];
};

export type ReviewRevisionEntryContent = {
  rating: number | null; // already descaled, same convention as mapReviewForDetail
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
};

export type ReviewRevisionEntry = {
  id: string; // `${reviewId}:${stateIndex}` - stable across refetches
  kind: 'submitted' | 'updated';
  reviewId: string;
  submissionId: string;
  reviewer: {
    id: string;
    displayName: string;
    discordId: string;
    discordAvatarHash: string | null;
  };
  content: ReviewRevisionEntryContent;
  timestamp: string; // ISO
  chartHash: string; // which chart hash this entry's opinion was about, snapshotted at the time
  isStale: boolean; // chartHash !== the chart's current hash - same derivation as mapReviewForDetail
  // False only for the single entry of a never-edited review: its content is identical to what's
  // already shown on that review's live card in the Reviews column, so the frontend renders just
  // the "submitted a review" row without duplicating rating/passing/scoring/notes/basicChecks.
  showDetails: boolean;
};

function toRevisionContent(row: {
  rating: number | null;
  passing: number | null;
  scoring: number | null;
  notes: string | null;
  basicCheckReasons: ReviewRevisionRow['basicCheckReasons'];
}): ReviewRevisionEntryContent {
  return {
    rating: row.rating == null ? null : row.rating / 100,
    passing: row.passing,
    scoring: row.scoring,
    notes: row.notes,
    basicChecks: row.basicCheckReasons.map((bc) => ({
      id: bc.basicCheckReasonId,
      code: bc.basicCheckReason.code,
      label: bc.basicCheckReason.label,
      level: bc.basicCheckReason.level,
      note: bc.note,
    })),
  };
}

// Reconstructs a review's chronological content-state chain from its append-only
// ReviewRevision rows (each holds the PRE-edit content of one past state) plus the live Review
// row (the current/final state), and emits one entry per state: the first is "submitted", every
// subsequent one (including the current live state) is "updated". An unedited review (no
// ReviewRevision rows) still yields one "submitted" entry - so it appears in the comments feed
// alongside real comments - but with showDetails: false, since its content is identical to what's
// already shown on the live review card in the Reviews column.
export function buildReviewRevisionEntries(
  review: ReviewWithRelations & { revisions: ReviewRevisionRow[] },
  currentChartHash: string,
): ReviewRevisionEntry[] {
  const reviewerSummary = {
    id: review.reviewer.id,
    displayName: review.reviewer.displayName ?? review.reviewer.discordUsername,
    discordId: review.reviewer.discordId,
    discordAvatarHash: review.reviewer.discordAvatarHash,
  };

  // states[0] = original submission (revisions[0] holds the pre-edit content of the first edit,
  // i.e. what was originally submitted); states[i] (1..k-1) = revisions[i]'s content, submitted
  // at the moment revisions[i-1] was superseded; states[last] = the live review, submitted at the
  // moment the final revision was superseded. chartHash is carried per-state too, since it's an
  // independent snapshot column re-stamped on every save (including idempotent resaves that
  // don't produce a new ReviewRevision row). When there are no revisions at all, the live review
  // is itself the only (and original) state.
  const states: { content: ReviewRevisionEntryContent; timestamp: Date; chartHash: string }[] =
    review.revisions.length === 0
      ? [
          {
            content: toRevisionContent(review),
            timestamp: review.createdAt,
            chartHash: review.chartHash,
          },
        ]
      : [
          {
            content: toRevisionContent(review.revisions[0]),
            timestamp: review.createdAt,
            chartHash: review.revisions[0].chartHash,
          },
          ...review.revisions.slice(1).map((r, i) => ({
            content: toRevisionContent(r),
            timestamp: review.revisions[i].supersededAt,
            chartHash: r.chartHash,
          })),
          {
            content: toRevisionContent(review),
            timestamp: review.revisions[review.revisions.length - 1].supersededAt,
            chartHash: review.chartHash,
          },
        ];

  const showDetails = review.revisions.length > 0;

  return states.map((state, i) => ({
    id: `${review.id}:${i}`,
    kind: i === 0 ? ('submitted' as const) : ('updated' as const),
    reviewId: review.id,
    submissionId: review.submissionId,
    reviewer: reviewerSummary,
    content: state.content,
    timestamp: state.timestamp.toISOString(),
    chartHash: state.chartHash,
    isStale: state.chartHash !== currentChartHash,
    showDetails,
  }));
}

// Standalone/exported so the isFromDifferentSubmission/isStale derivation is directly
// unit-testable without mocking Prisma - same reasoning as reviews.service.ts's
// buildBaseWhereFragments/mapRawReviewRow.
export function mapReviewForDetail(
  review: ReviewWithRelations,
  currentFileId: string,
  currentChartHash: string,
) {
  return {
    id: review.id,
    submissionId: review.submissionId,
    reviewer: {
      id: review.reviewer.id,
      displayName: review.reviewer.displayName ?? review.reviewer.discordUsername,
      discordId: review.reviewer.discordId,
      discordAvatarHash: review.reviewer.discordAvatarHash,
    },
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
    // review.chartHash != submission.chart?.hash - see prisma/schema.prisma's file header.
    isFromDifferentSubmission: review.submissionId !== currentFileId,
    isStale: review.chartHash !== currentChartHash,
  };
}

@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForEvent(eventId: string) {
    const rows = await this.prisma.submission.findMany({
      where: { eventId },
      include: { chart: true, techTags: { include: { techTag: true } }, singleTechTag: true },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map(mapSubmission);
  }

  // Powers the submission details page: the submission+chart, every review that's either about
  // THIS submission (including a stale one, whose chartHash no longer matches) or about another
  // submission sharing the same current chart hash, and the same aggregate stats shown on the
  // Reviews tab (scoped to the chart's current hash only).
  async getForEvent(eventId: string, fileId: string) {
    const row = await this.prisma.submission.findUnique({
      where: { fileId },
      include: { chart: true, techTags: { include: { techTag: true } }, singleTechTag: true },
    });
    if (!row || row.eventId !== eventId) {
      throw new NotFoundException(`No submission with id "${fileId}"`);
    }

    const submission = mapSubmission(row);
    const chart = row.chart;
    if (!chart) {
      return { submission, reviews: [], reviewRevisions: [], stats: null };
    }

    const reviewRows = await this.prisma.review.findMany({
      where: { OR: [{ submissionId: fileId }, { chartHash: chart.hash }] },
      include: {
        reviewer: true,
        basicCheckReasons: { include: { basicCheckReason: true } },
        revisions: {
          orderBy: { supersededAt: 'asc' },
          include: { basicCheckReasons: { include: { basicCheckReason: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const reviews = reviewRows.map((review) => mapReviewForDetail(review, fileId, chart.hash));
    const reviewRevisions = reviewRows.flatMap((review) =>
      buildReviewRevisionEntries(review, chart.hash),
    );

    const [statsRow] = await this.prisma.$queryRaw<RawReviewStats[]>(
      buildReviewStatsFragment(Prisma.sql`${chart.hash}`),
    );

    return { submission, reviews, reviewRevisions, stats: mapReviewStats(statsRow) };
  }
}
