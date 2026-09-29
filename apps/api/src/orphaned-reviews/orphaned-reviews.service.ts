import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Difficulty, Playstyle } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { rankColumn, recomputeLastReviewAt } from '../reviews/reviews.service.js';

const CANDIDATE_LIMIT = 5;

// Below pg_trgm's default 0.3 GUC, same reasoning as reviews.service.ts's own
// SIMILARITY_THRESHOLD - these are short individual fields, not long concatenated text.
const SEARCH_SIMILARITY_THRESHOLD = 0.15;

export type OrphanedReviewCandidate = {
  fileId: string;
  stepartist: string;
  pack: string;
  submitter: string;
  // Whether this candidate shares the orphaned submission's own `submitter` field - the
  // strongest signal a curator has that this is the actual resubmission, since a submitter
  // re-uploading the same chart almost always does so under their own identity again.
  sameSubmitter: boolean;
  chart: {
    hash: string;
    title: string;
    titleRomaji: string;
    artist: string;
    artistRomaji: string;
    playstyle: Playstyle;
    difficulty: Difficulty;
    meter: number;
  };
};

export type OrphanedReview = {
  id: string;
  reviewer: {
    id: string;
    displayName: string;
    discordId: string;
    discordAvatarHash: string | null;
  };
  rating: number | null;
  passing: number | null;
  scoring: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  chartHash: string;
  // Snapshotted when this review was written - the only surviving record of what chart it was
  // about, since the source submission's own chart row is gone (see prisma/schema.prisma's
  // Review comment on chart-identity snapshots).
  chart: {
    title: string;
    titleRomaji: string;
    artist: string;
    artistRomaji: string;
    playstyle: Playstyle;
    difficulty: Difficulty;
    meter: number;
  };
};

export type OrphanedReviewGroup = {
  submission: {
    fileId: string;
    stepartist: string;
    pack: string;
    submitter: string;
    submittedAt: Date;
  };
  reviews: OrphanedReview[];
  // Ranked resubmission suggestions - always a curator-confirmed pick, never auto-applied. See
  // OrphanedReviewsService.relinkReview.
  candidates: OrphanedReviewCandidate[];
};

type RawCandidateRow = {
  fileId: string;
  stepartist: string;
  pack: string;
  submitter: string;
  hash: string;
  title: string;
  titleRomaji: string;
  artist: string;
  artistRomaji: string;
  playstyle: Playstyle;
  difficulty: Difficulty;
  meter: number;
  sameSubmitter: boolean;
};

function mapCandidate(row: RawCandidateRow): OrphanedReviewCandidate {
  return {
    fileId: row.fileId,
    stepartist: row.stepartist,
    pack: row.pack,
    submitter: row.submitter,
    sameSubmitter: row.sameSubmitter,
    chart: {
      hash: row.hash,
      title: row.title,
      titleRomaji: row.titleRomaji,
      artist: row.artist,
      artistRomaji: row.artistRomaji,
      playstyle: row.playstyle,
      difficulty: row.difficulty,
      meter: row.meter,
    },
  };
}

@Injectable()
export class OrphanedReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  // Every ignored (chart-cleared) submission that still has at least one review attached,
  // paired with resubmission candidates ranked by title/artist similarity against the reviews'
  // own snapshotted chart identity and by matching submitter.
  async listForEvent(eventId: string): Promise<OrphanedReviewGroup[]> {
    const submissions = await this.prisma.submission.findMany({
      where: { eventId, isIgnored: true, reviews: { some: {} } },
      include: {
        reviews: {
          include: { reviewer: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const groups: OrphanedReviewGroup[] = [];
    for (const submission of submissions) {
      // Reference chart identity for candidate matching: the most recently touched review's own
      // snapshot, on the theory that it's closest to what the chart looked like right before
      // this submission was ignored (two reviewers' snapshots can differ slightly if the chart
      // was re-parsed between their saves).
      const reference = [...submission.reviews].sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      )[0];

      const candidates = reference
        ? await this.findCandidates(
            eventId,
            submission.fileId,
            submission.submitter,
            reference.chartTitle,
            reference.chartArtist,
          )
        : [];

      groups.push({
        submission: {
          fileId: submission.fileId,
          stepartist: submission.stepartist,
          pack: submission.pack,
          submitter: submission.submitter,
          submittedAt: submission.submittedAt,
        },
        reviews: submission.reviews.map((review) => ({
          id: review.id,
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
          createdAt: review.createdAt,
          updatedAt: review.updatedAt,
          chartHash: review.chartHash,
          chart: {
            title: review.chartTitle,
            titleRomaji: review.chartTitleRomaji,
            artist: review.chartArtist,
            artistRomaji: review.chartArtistRomaji,
            playstyle: review.chartPlaystyle,
            difficulty: review.chartDifficulty,
            meter: review.chartMeter,
          },
        })),
        candidates,
      });
    }
    return groups;
  }

  // Manual escape hatch for when none of listForEvent's ranked suggestions are the right one -
  // same matching columns, driven by a curator-typed query instead of a reference review's
  // snapshot. Mirrors CuratorsService.searchUsers' role as a fallback search alongside a
  // primary ranked list.
  async searchCandidates(eventId: string, query: string): Promise<OrphanedReviewCandidate[]> {
    const term = query.trim();
    if (!term) return [];
    const rows = await this.prisma.$queryRaw<RawCandidateRow[]>(Prisma.sql`
      SELECT
        s."fileId" AS "fileId", s.stepartist, s.pack, s.submitter,
        c.hash, c.title, c."titleRomaji", c.artist, c."artistRomaji",
        c.playstyle, c.difficulty, c.meter,
        false AS "sameSubmitter"
      FROM submissions s
      JOIN charts c ON c."submissionId" = s."fileId"
      WHERE s."eventId" = ${eventId} AND NOT s."isIgnored"
        AND (
          similarity(c.title, ${term}) > ${SEARCH_SIMILARITY_THRESHOLD}
          OR similarity(c.artist, ${term}) > ${SEARCH_SIMILARITY_THRESHOLD}
          OR similarity(s.stepartist, ${term}) > ${SEARCH_SIMILARITY_THRESHOLD}
          OR c.title ILIKE ${'%' + term + '%'}
          OR s.stepartist ILIKE ${'%' + term + '%'}
        )
      ORDER BY GREATEST(
        similarity(c.title, ${term}), similarity(c.artist, ${term}), similarity(s.stepartist, ${term})
      ) DESC
      LIMIT ${CANDIDATE_LIMIT}
    `);
    return rows.map(mapCandidate);
  }

  private async findCandidates(
    eventId: string,
    excludeFileId: string,
    submitter: string,
    chartTitle: string,
    chartArtist: string,
  ): Promise<OrphanedReviewCandidate[]> {
    const titleRank = rankColumn(Prisma.sql`c.title`, chartTitle);
    const artistRank = rankColumn(Prisma.sql`c.artist`, chartArtist);
    const rows = await this.prisma.$queryRaw<RawCandidateRow[]>(Prisma.sql`
      SELECT
        s."fileId" AS "fileId", s.stepartist, s.pack, s.submitter,
        c.hash, c.title, c."titleRomaji", c.artist, c."artistRomaji",
        c.playstyle, c.difficulty, c.meter,
        (s.submitter = ${submitter}) AS "sameSubmitter"
      FROM submissions s
      JOIN charts c ON c."submissionId" = s."fileId"
      WHERE s."eventId" = ${eventId} AND NOT s."isIgnored" AND s."fileId" != ${excludeFileId}
      ORDER BY "sameSubmitter" DESC, (${titleRank} + ${artistRank}) DESC
      LIMIT ${CANDIDATE_LIMIT}
    `);
    return rows.map(mapCandidate);
  }

  // Reassigns an orphaned review (one whose submission has been ignored) onto a live
  // resubmission, re-snapshotting its chart identity to match - the same fields
  // ReviewsService.upsertReviewTransaction re-stamps on every reviewer save. The pre-relink
  // state is archived as a ReviewRevision first, so the old chart hash/identity stay visible in
  // the comments/revision-history feed. supersededById is the CURATOR performing this, not the
  // review's own author - the one case where that field isn't the reviewer themself.
  async relinkReview(
    eventId: string,
    reviewId: string,
    targetFileId: string,
    curatorId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const review = await tx.review.findUnique({
        where: { id: reviewId },
        include: { submission: true, basicCheckReasons: true },
      });
      if (!review || review.submission.eventId !== eventId) {
        throw new NotFoundException(`No review with id "${reviewId}"`);
      }
      if (!review.submission.isIgnored) {
        throw new BadRequestException("This review isn't orphaned - its submission isn't ignored");
      }

      const target = await tx.submission.findUnique({
        where: { fileId: targetFileId },
        include: { chart: true },
      });
      if (!target || target.eventId !== eventId) {
        throw new NotFoundException(`No submission with id "${targetFileId}"`);
      }
      if (target.isIgnored) {
        throw new BadRequestException('Cannot relink to a submission that is itself ignored');
      }
      if (!target.chart) {
        throw new BadRequestException('Cannot relink to a submission with no parsed chart');
      }

      const conflict = await tx.review.findUnique({
        where: {
          submissionId_reviewerId: { submissionId: targetFileId, reviewerId: review.reviewerId },
        },
      });
      if (conflict) {
        throw new ConflictException(
          'This reviewer already has a review on the target submission - resolve that one manually first',
        );
      }

      const revision = await tx.reviewRevision.create({
        data: {
          reviewId: review.id,
          chartHash: review.chartHash,
          chartTitle: review.chartTitle,
          chartTitleRomaji: review.chartTitleRomaji,
          chartSubtitle: review.chartSubtitle,
          chartSubtitleRomaji: review.chartSubtitleRomaji,
          chartArtist: review.chartArtist,
          chartArtistRomaji: review.chartArtistRomaji,
          chartPlaystyle: review.chartPlaystyle,
          chartDifficulty: review.chartDifficulty,
          chartMeter: review.chartMeter,
          rating: review.rating,
          passing: review.passing,
          scoring: review.scoring,
          notes: review.notes,
          supersededById: curatorId,
        },
      });
      if (review.basicCheckReasons.length > 0) {
        await tx.reviewRevisionBasicCheck.createMany({
          data: review.basicCheckReasons.map((check) => ({
            reviewRevisionId: revision.id,
            basicCheckReasonId: check.basicCheckReasonId,
            note: check.note,
          })),
        });
      }

      await tx.review.update({
        where: { id: review.id },
        data: {
          submissionId: targetFileId,
          chartHash: target.chart.hash,
          chartTitle: target.chart.title,
          chartTitleRomaji: target.chart.titleRomaji,
          chartSubtitle: target.chart.subtitle,
          chartSubtitleRomaji: target.chart.subtitleRomaji,
          chartArtist: target.chart.artist,
          chartArtistRomaji: target.chart.artistRomaji,
          chartPlaystyle: target.chart.playstyle,
          chartDifficulty: target.chart.difficulty,
          chartMeter: target.chart.meter,
        },
      });

      // review.submissionId still holds the OLD fileId here - `review` was fetched before the
      // update above and never reassigned.
      await recomputeLastReviewAt(tx, review.submissionId);
      await recomputeLastReviewAt(tx, targetFileId);
    });
  }
}
