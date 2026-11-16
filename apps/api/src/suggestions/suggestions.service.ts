import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BasicCheckLevel, Prisma, Suggestion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { UpsertReviewDto } from '../reviews/dto/upsert-review.dto.js';
import {
  mapUpsertedReview,
  recomputeLastReviewAt,
  reviewFieldsChanged,
  reviewFieldsEmpty,
  type ReviewsBasicCheck,
} from '../reviews/reviews.service.js';

type ReviewerRow = {
  id: string;
  displayName: string | null;
  discordUsername: string;
  discordId: string;
  discordAvatarHash: string | null;
};

type BasicCheckRow = {
  basicCheckReasonId: string;
  note: string | null;
  basicCheckReason: { code: string; label: string; level: BasicCheckLevel };
};

type ContentRow = {
  rating: number | null;
  passing: number | null;
  scoring: number | null;
  notes: string | null;
  basicCheckReasons: BasicCheckRow[];
};

type SuggestionReviewWithRelations = ContentRow & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  reviewer: ReviewerRow;
  revisions: (ContentRow & { supersededAt: Date })[];
};

const REVIEW_INCLUDE = {
  reviewer: true,
  basicCheckReasons: { include: { basicCheckReason: true } },
  revisions: {
    orderBy: { supersededAt: 'asc' },
    include: { basicCheckReasons: { include: { basicCheckReason: true } } },
  },
} satisfies Prisma.SuggestionReviewInclude;

function mapReviewer(reviewer: ReviewerRow) {
  return {
    id: reviewer.id,
    displayName: reviewer.displayName ?? reviewer.discordUsername,
    discordId: reviewer.discordId,
    discordAvatarHash: reviewer.discordAvatarHash,
  };
}

function mapContent(row: ContentRow) {
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

// Same shape as SubmissionsService's mapReviewForDetail so the frontend's review card renders
// it unchanged - a suggestion has no chart, so it's never stale or from another submission.
export function mapSuggestionReviewForDetail(review: SuggestionReviewWithRelations) {
  return {
    id: review.id,
    reviewer: mapReviewer(review.reviewer),
    ...mapContent(review),
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    isFromDifferentSubmission: false,
    isStale: false,
  };
}

// Mirrors submissions.service.ts's buildReviewRevisionEntries (same state-chain reconstruction,
// same entry shape) minus the chart-hash staleness, for the suggestion comments feed.
export function buildSuggestionReviewRevisionEntries(review: SuggestionReviewWithRelations) {
  const { revisions } = review;
  const states: { content: ReturnType<typeof mapContent>; timestamp: Date }[] =
    revisions.length === 0
      ? [{ content: mapContent(review), timestamp: review.createdAt }]
      : [
          { content: mapContent(revisions[0]), timestamp: review.createdAt },
          ...revisions.slice(1).map((r, i) => ({
            content: mapContent(r),
            timestamp: revisions[i].supersededAt,
          })),
          {
            content: mapContent(review),
            timestamp: revisions[revisions.length - 1].supersededAt,
          },
        ];

  return states.map((state, i) => ({
    id: `${review.id}:${i}`,
    kind: i === 0 ? ('submitted' as const) : ('updated' as const),
    reviewId: review.id,
    reviewer: mapReviewer(review.reviewer),
    content: state.content,
    timestamp: state.timestamp.toISOString(),
    isStale: false,
    showDetails: revisions.length > 0,
  }));
}

function ratingStats(ratings: number[]) {
  if (ratings.length === 0) {
    return { avgRating: null, minRating: null, maxRating: null, stdevRating: null };
  }
  const avg = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  // Same convention as buildReviewStatsFragment: population stdev, null under 2 ratings.
  const stdev =
    ratings.length < 2
      ? null
      : Math.sqrt(ratings.reduce((sum, r) => sum + (r - avg) ** 2, 0) / ratings.length);
  return {
    avgRating: avg / 100,
    minRating: Math.min(...ratings) / 100,
    maxRating: Math.max(...ratings) / 100,
    stdevRating: stdev == null ? null : stdev / 100,
  };
}

function sortBasicChecks(checks: ReviewsBasicCheck[]): ReviewsBasicCheck[] {
  return [...checks].sort((a, b) => {
    if (a.level !== b.level) return a.level === 'DISQUALIFIED' ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

function linkedSubmissionSummary(
  linked: {
    fileId: string;
    stepartist: string;
    chart: { title: string; titleRomaji: string } | null;
  } | null,
) {
  return linked
    ? {
        fileId: linked.fileId,
        stepartist: linked.stepartist,
        title: linked.chart ? linked.chart.titleRomaji || linked.chart.title : null,
      }
    : null;
}

const LINKED_SUBMISSION_SELECT = {
  select: {
    fileId: true,
    stepartist: true,
    chart: { select: { title: true, titleRomaji: true } },
  },
} as const;

// Recomputed via MAX, same reasoning as reviews.service.ts's recomputeLastReviewAt.
async function recomputeSuggestionLastReviewAt(
  tx: Prisma.TransactionClient,
  eventId: string,
  position: number,
) {
  const agg = await tx.suggestionReview.aggregate({
    where: { eventId, suggestionPosition: position },
    _max: { updatedAt: true },
  });
  await tx.suggestion.update({
    where: { eventId_position: { eventId, position } },
    data: { lastReviewAt: agg._max.updatedAt },
  });
}

// Linked suggestions are read-only: their reviews have been copied onto a submission, and
// further edits here would silently diverge from those copies.
export function assertSuggestionWritable(suggestion: Suggestion) {
  if (suggestion.linkedSubmissionId) {
    throw new BadRequestException('This suggestion is linked to a submission and is read-only');
  }
}

@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async loadOrThrow(eventId: string, position: number): Promise<Suggestion> {
    const suggestion = await this.prisma.suggestion.findUnique({
      where: { eventId_position: { eventId, position } },
    });
    if (!suggestion) throw new NotFoundException(`No suggestion #${position}`);
    return suggestion;
  }

  async listForEvent(eventId: string, userId: string) {
    const rows = await this.prisma.suggestion.findMany({
      where: { eventId },
      orderBy: { position: 'asc' },
      include: {
        reviews: {
          select: {
            reviewerId: true,
            rating: true,
            basicCheckReasons: {
              select: {
                basicCheckReason: { select: { id: true, code: true, label: true, level: true } },
              },
            },
          },
        },
        _count: { select: { comments: true } },
        linkedSubmission: LINKED_SUBMISSION_SELECT,
      },
    });

    return rows.map((row) => {
      const checks = new Map<string, ReviewsBasicCheck>();
      for (const review of row.reviews) {
        for (const { basicCheckReason } of review.basicCheckReasons) {
          checks.set(basicCheckReason.id, basicCheckReason);
        }
      }
      const basicChecks = sortBasicChecks([...checks.values()]);
      const ratings = row.reviews.flatMap((r) => (r.rating == null ? [] : [r.rating]));
      const lastActivity =
        [row.lastReviewAt, row.lastCommentAt]
          .filter((d): d is Date => d !== null)
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

      return {
        position: row.position,
        submittedAt: row.submittedAt,
        submitter: row.submitter,
        chart: row.chart,
        reason: row.reason,
        link: row.link,
        consentToPublicReview: row.consentToPublicReview,
        reviewCount: row.reviews.length,
        ...ratingStats(ratings),
        hasOwnReview: row.reviews.some((r) => r.reviewerId === userId),
        commentCount: row._count.comments,
        lastActivity,
        basicChecks,
        hasWarning: basicChecks.some((c) => c.level === 'WARNING'),
        hasDisqualification: basicChecks.some((c) => c.level === 'DISQUALIFIED'),
        linkedSubmission: linkedSubmissionSummary(row.linkedSubmission),
      };
    });
  }

  async getForEvent(eventId: string, position: number) {
    const row = await this.prisma.suggestion.findUnique({
      where: { eventId_position: { eventId, position } },
      include: {
        linkedSubmission: LINKED_SUBMISSION_SELECT,
        linkedBy: true,
        reviews: { include: REVIEW_INCLUDE, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException(`No suggestion #${position}`);

    const ratings = row.reviews.flatMap((r) => (r.rating == null ? [] : [r.rating]));
    return {
      suggestion: {
        position: row.position,
        submittedAt: row.submittedAt,
        submitter: row.submitter,
        chart: row.chart,
        reason: row.reason,
        link: row.link,
        consentToPublicReview: row.consentToPublicReview,
        linkedSubmission: linkedSubmissionSummary(row.linkedSubmission),
        linkedAt: row.linkedAt,
        linkedBy: row.linkedBy ? mapReviewer(row.linkedBy) : null,
      },
      reviews: row.reviews.map(mapSuggestionReviewForDetail),
      reviewRevisions: row.reviews.flatMap(buildSuggestionReviewRevisionEntries),
      stats: { reviewCount: row.reviews.length, ...ratingStats(ratings) },
    };
  }

  // Same upsert/revision semantics as ReviewsService.upsertReviewTransaction, minus the chart
  // snapshot - scoped to reviewerId = the caller, so only the author can edit their own.
  async upsertOwnReview(
    eventId: string,
    position: number,
    reviewerId: string,
    dto: UpsertReviewDto,
  ) {
    const suggestion = await this.loadOrThrow(eventId, position);
    assertSuggestionWritable(suggestion);

    const nextFields = {
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

    const reviewInclude = { basicCheckReasons: { include: { basicCheckReason: true } } };

    const saved = await this.prisma.$transaction(async (tx) => {
      const where = {
        eventId_suggestionPosition_reviewerId: {
          eventId,
          suggestionPosition: position,
          reviewerId,
        },
      };
      const existing = await tx.suggestionReview.findUnique({
        where,
        include: { basicCheckReasons: true },
      });

      let reviewId: string;
      if (existing) {
        const existingFields = {
          rating: existing.rating,
          passing: existing.passing,
          scoring: existing.scoring,
          notes: existing.notes,
          basicChecks: existing.basicCheckReasons.map((check) => ({
            basicCheckReasonId: check.basicCheckReasonId,
            note: check.note,
          })),
        };
        reviewId = existing.id;
        // An idempotent resave writes nothing - unlike Review there's no chart snapshot to
        // re-stamp, so there's nothing to un-stale either.
        if (reviewFieldsChanged(existingFields, nextFields)) {
          await tx.suggestionReviewRevision.create({
            data: {
              reviewId: existing.id,
              rating: existing.rating,
              passing: existing.passing,
              scoring: existing.scoring,
              notes: existing.notes,
              supersededById: reviewerId,
              basicCheckReasons: {
                create: existing.basicCheckReasons.map((check) => ({
                  basicCheckReasonId: check.basicCheckReasonId,
                  note: check.note,
                })),
              },
            },
          });
          await tx.suggestionReview.update({
            where: { id: existing.id },
            data: {
              rating: nextFields.rating,
              passing: nextFields.passing,
              scoring: nextFields.scoring,
              notes: nextFields.notes,
              basicCheckReasons: { deleteMany: {}, create: nextFields.basicChecks },
            },
          });
        }
      } else {
        const created = await tx.suggestionReview.create({
          data: {
            eventId,
            suggestionPosition: position,
            reviewerId,
            rating: nextFields.rating,
            passing: nextFields.passing,
            scoring: nextFields.scoring,
            notes: nextFields.notes,
            basicCheckReasons: { create: nextFields.basicChecks },
          },
        });
        reviewId = created.id;
      }

      await recomputeSuggestionLastReviewAt(tx, eventId, position);
      return tx.suggestionReview.findUniqueOrThrow({
        where: { id: reviewId },
        include: reviewInclude,
      });
    });

    return mapUpsertedReview(saved);
  }

  // Copies (never references) every suggestion review - with its basic checks and full
  // revision history - onto the target submission as ordinary Review rows. A reviewer who
  // already has their own review on that submission is skipped, keeping their existing one.
  // Copies are snapshotted against the submission's CURRENT chart, since the suggestion never
  // had one - so they count as up to date, not stale.
  async link(eventId: string, position: number, fileId: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const suggestion = await tx.suggestion.findUnique({
        where: { eventId_position: { eventId, position } },
      });
      if (!suggestion) throw new NotFoundException(`No suggestion #${position}`);
      if (suggestion.linkedSubmissionId) {
        throw new ConflictException('This suggestion is already linked to a submission');
      }

      const submission = await tx.submission.findUnique({
        where: { fileId },
        include: { chart: true },
      });
      if (!submission || submission.eventId !== eventId) {
        throw new NotFoundException(`No submission with id "${fileId}"`);
      }
      if (submission.isIgnored) {
        throw new BadRequestException('Cannot link to an ignored submission');
      }
      const chart = submission.chart;
      if (!chart) {
        throw new BadRequestException('Cannot link to a submission with no parsed chart');
      }

      // Same field list as ReviewsService.upsertReviewTransaction's chartSnapshot.
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

      const suggestionReviews = await tx.suggestionReview.findMany({
        where: { eventId, suggestionPosition: position },
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'asc' },
      });
      const alreadyReviewed = new Set(
        (
          await tx.review.findMany({
            where: {
              submissionId: fileId,
              reviewerId: { in: suggestionReviews.map((r) => r.reviewerId) },
            },
            select: { reviewerId: true },
          })
        ).map((r) => r.reviewerId),
      );

      const skipped: ReturnType<typeof mapReviewer>[] = [];
      let copied = 0;
      for (const review of suggestionReviews) {
        if (alreadyReviewed.has(review.reviewerId)) {
          skipped.push(mapReviewer(review.reviewer));
          continue;
        }
        await tx.review.create({
          data: {
            submissionId: fileId,
            reviewerId: review.reviewerId,
            ...chartSnapshot,
            rating: review.rating,
            passing: review.passing,
            scoring: review.scoring,
            notes: review.notes,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt,
            basicCheckReasons: {
              create: review.basicCheckReasons.map((bc) => ({
                basicCheckReasonId: bc.basicCheckReasonId,
                note: bc.note,
              })),
            },
            revisions: {
              create: review.revisions.map((revision) => ({
                ...chartSnapshot,
                rating: revision.rating,
                passing: revision.passing,
                scoring: revision.scoring,
                notes: revision.notes,
                supersededAt: revision.supersededAt,
                supersededById: revision.supersededById,
                basicCheckReasons: {
                  create: revision.basicCheckReasons.map((bc) => ({
                    basicCheckReasonId: bc.basicCheckReasonId,
                    note: bc.note,
                  })),
                },
              })),
            },
          },
        });
        copied += 1;
      }

      await recomputeLastReviewAt(tx, fileId);
      await tx.suggestion.update({
        where: { eventId_position: { eventId, position } },
        data: { linkedSubmissionId: fileId, linkedAt: new Date(), linkedById: adminId },
      });

      return { copied, skipped };
    });
  }

  // Only clears the link - reviews already copied onto the submission are independent rows
  // now and stay where they are.
  async unlink(eventId: string, position: number) {
    const suggestion = await this.loadOrThrow(eventId, position);
    if (!suggestion.linkedSubmissionId) {
      throw new BadRequestException('This suggestion is not linked to a submission');
    }
    await this.prisma.suggestion.update({
      where: { eventId_position: { eventId, position } },
      data: { linkedSubmissionId: null, linkedAt: null, linkedById: null },
    });
    return { ok: true };
  }
}
