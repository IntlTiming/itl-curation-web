import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Comment, CommentReaction, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCommentDto } from './dto/create-comment.dto.js';
import type { UpdateCommentDto } from './dto/update-comment.dto.js';

// Always rendered as an interactable pill even with zero reactions, so there's always a
// one-click way to react to a comment before reaching for the full picker.
export const DEFAULT_REACTION_EMOJI = '👍';

type ReactionRow = Pick<CommentReaction, 'emoji' | 'userId' | 'createdAt'> & {
  user: Pick<User, 'displayName' | 'discordUsername'>;
};

export type MappedReaction = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
  // Display names of everyone who reacted with this emoji, for a hover tooltip - the current
  // user (if among them) is always named "You" and always listed first, everyone else in the
  // order they reacted.
  reactedBy: string[];
};

// Standalone/exported so the grouping and default-pill logic is directly unit-testable
// without mocking Prisma - same reasoning as reviews.service.ts's mapRawReviewRow.
export function mapCommentReactions(
  reactions: ReactionRow[],
  currentUserId: string,
): MappedReaction[] {
  const groups = new Map<
    string,
    {
      count: number;
      reactedByMe: boolean;
      earliest: number;
      others: { name: string; at: number }[];
    }
  >();
  for (const reaction of reactions) {
    const at = reaction.createdAt.getTime();
    const isMe = reaction.userId === currentUserId;
    const name = reaction.user.displayName ?? reaction.user.discordUsername;
    const existing = groups.get(reaction.emoji);
    if (existing) {
      existing.count += 1;
      existing.reactedByMe = existing.reactedByMe || isMe;
      existing.earliest = Math.min(existing.earliest, at);
      if (!isMe) existing.others.push({ name, at });
    } else {
      groups.set(reaction.emoji, {
        count: 1,
        reactedByMe: isMe,
        earliest: at,
        others: isMe ? [] : [{ name, at }],
      });
    }
  }

  if (!groups.has(DEFAULT_REACTION_EMOJI)) {
    groups.set(DEFAULT_REACTION_EMOJI, {
      count: 0,
      reactedByMe: false,
      earliest: -Infinity,
      others: [],
    });
  }

  return [...groups.entries()]
    .sort(([emojiA, a], [emojiB, b]) => {
      if (emojiA === DEFAULT_REACTION_EMOJI) return -1;
      if (emojiB === DEFAULT_REACTION_EMOJI) return 1;
      return a.earliest - b.earliest;
    })
    .map(([emoji, group]) => {
      const otherNames = [...group.others].sort((a, b) => a.at - b.at).map((o) => o.name);
      return {
        emoji,
        count: group.count,
        reactedByMe: group.reactedByMe,
        reactedBy: group.reactedByMe ? ['You', ...otherNames] : otherNames,
      };
    });
}

type CommentAuthor = Pick<
  User,
  'id' | 'displayName' | 'discordUsername' | 'discordId' | 'discordAvatarHash'
>;

function mapCommentAuthor(author: CommentAuthor) {
  return {
    id: author.id,
    displayName: author.displayName ?? author.discordUsername,
    discordId: author.discordId,
    discordAvatarHash: author.discordAvatarHash,
  };
}

type CommentWithRelations = Comment & { author: CommentAuthor; reactions: ReactionRow[] };

// Standalone/exported for the same unit-testability reason as mapCommentReactions -
// isStale here is submissionId-scoped info only (no cross-submission matching, unlike
// Review's isFromDifferentSubmission/isStale pair - see prisma/schema.prisma's Comment model).
export function mapCommentForResponse(
  comment: CommentWithRelations,
  currentChartHash: string,
  currentUserId: string,
) {
  return {
    id: comment.id,
    submissionId: comment.submissionId,
    author: mapCommentAuthor(comment.author),
    body: comment.body,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    isStale: comment.chartHash !== currentChartHash,
    // No edit-history log is kept (see file-level "Not in scope" note) - just a plain flag,
    // derived by comparing timestamps rather than a stored boolean. Relies on createComment
    // stamping createdAt/updatedAt with the exact same Date, since createdAt otherwise comes
    // from the DB's CURRENT_TIMESTAMP default while updatedAt is set client-side by Prisma -
    // without that, a fresh comment could spuriously show as "edited" from clock skew alone.
    isEdited: comment.updatedAt.getTime() !== comment.createdAt.getTime(),
    reactions: mapCommentReactions(comment.reactions, currentUserId),
  };
}

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadSubmissionWithChartOrThrow(eventId: string, fileId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { fileId },
      include: { chart: true },
    });
    if (!submission || submission.eventId !== eventId) {
      throw new NotFoundException(`No submission with id "${fileId}"`);
    }
    return submission;
  }

  private async loadCommentOrThrow(fileId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment || comment.submissionId !== fileId) {
      throw new NotFoundException(`No comment with id "${commentId}" on submission "${fileId}"`);
    }
    return comment;
  }

  // Recomputed via MAX rather than stamped with now() - self-healing after a delete removes
  // the most recent comment, correct across multiple commenters, no special-casing per caller.
  private async recomputeLastCommentAt(tx: Prisma.TransactionClient, fileId: string) {
    const agg = await tx.comment.aggregate({
      where: { submissionId: fileId },
      _max: { updatedAt: true },
    });
    await tx.submission.update({
      where: { fileId },
      data: { lastCommentAt: agg._max.updatedAt },
    });
  }

  async listForSubmission(eventId: string, fileId: string, currentUserId: string) {
    const submission = await this.loadSubmissionWithChartOrThrow(eventId, fileId);
    const currentChartHash = submission.chart?.hash ?? null;

    const comments = await this.prisma.comment.findMany({
      where: { submissionId: fileId },
      include: { author: true, reactions: { include: { user: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return comments.map((comment) =>
      mapCommentForResponse(comment, currentChartHash ?? '', currentUserId),
    );
  }

  async createComment(eventId: string, fileId: string, authorId: string, dto: CreateCommentDto) {
    const submission = await this.loadSubmissionWithChartOrThrow(eventId, fileId);
    if (!submission.chart) {
      throw new BadRequestException('Cannot comment on a submission with no parsed chart');
    }
    const chartHash = submission.chart.hash;

    // Stamped explicitly (rather than left to the DB default + Prisma's separate @updatedAt
    // handling) so createdAt and updatedAt are the exact same Date on creation - see
    // mapCommentForResponse's isEdited comment for why that equality matters.
    const now = new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          submissionId: fileId,
          authorId,
          chartHash,
          body: dto.body,
          createdAt: now,
          updatedAt: now,
        },
        include: { author: true, reactions: { include: { user: true } } },
      });
      await this.recomputeLastCommentAt(tx, fileId);
      return comment;
    });

    return mapCommentForResponse(created, chartHash, authorId);
  }

  async updateOwnComment(
    eventId: string,
    fileId: string,
    commentId: string,
    authorId: string,
    dto: UpdateCommentDto,
  ) {
    const submission = await this.loadSubmissionWithChartOrThrow(eventId, fileId);
    const existing = await this.loadCommentOrThrow(fileId, commentId);
    if (existing.authorId !== authorId) {
      throw new ForbiddenException('You can only edit your own comments');
    }
    if (!submission.chart) {
      throw new BadRequestException('Cannot comment on a submission with no parsed chart');
    }
    const chartHash = submission.chart.hash;

    const updated = await this.prisma.$transaction(async (tx) => {
      // Saving always re-snapshots chartHash to the chart's current state, same rationale
      // as Review's upsertReviewTransaction - editing re-affirms this comment against the
      // chart as it stands today.
      const comment = await tx.comment.update({
        where: { id: commentId },
        data: { body: dto.body, chartHash },
        include: { author: true, reactions: { include: { user: true } } },
      });
      await this.recomputeLastCommentAt(tx, fileId);
      return comment;
    });

    return mapCommentForResponse(updated, chartHash, authorId);
  }

  async deleteOwnComment(eventId: string, fileId: string, commentId: string, authorId: string) {
    await this.loadSubmissionWithChartOrThrow(eventId, fileId);
    const existing = await this.loadCommentOrThrow(fileId, commentId);
    if (existing.authorId !== authorId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.comment.delete({ where: { id: commentId } });
      await this.recomputeLastCommentAt(tx, fileId);
    });

    return { id: commentId };
  }

  // Any user with event access may react, not just the comment's author.
  async toggleReaction(
    eventId: string,
    fileId: string,
    commentId: string,
    userId: string,
    emoji: string,
  ) {
    await this.loadSubmissionWithChartOrThrow(eventId, fileId);
    await this.loadCommentOrThrow(fileId, commentId);

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.commentReaction.findUnique({
        where: { commentId_userId_emoji: { commentId, userId, emoji } },
      });
      if (existing) {
        await tx.commentReaction.delete({
          where: { commentId_userId_emoji: { commentId, userId, emoji } },
        });
      } else {
        await tx.commentReaction.create({ data: { commentId, userId, emoji } });
      }
    });

    const reactions = await this.prisma.commentReaction.findMany({
      where: { commentId },
      include: { user: true },
    });
    return { reactions: mapCommentReactions(reactions, userId) };
  }
}
