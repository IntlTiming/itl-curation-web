import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, SuggestionComment } from '@prisma/client';
import {
  type CommentAuthor,
  mapCommentAuthor,
  mapCommentReactions,
  type ReactionRow,
} from '../comments/comments.service.js';
import type { CreateCommentDto } from '../comments/dto/create-comment.dto.js';
import type { UpdateCommentDto } from '../comments/dto/update-comment.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertSuggestionWritable, SuggestionsService } from './suggestions.service.js';

const COMMENT_INCLUDE = { author: true, reactions: { include: { user: true } } } as const;

// Same response shape as CommentsService's mapCommentForResponse so the frontend's comment card
// renders it unchanged. isStale is always false - a suggestion has no chart to go stale against.
export function mapSuggestionCommentForResponse(
  comment: SuggestionComment & { author: CommentAuthor; reactions: ReactionRow[] },
  currentUserId: string,
) {
  return {
    id: comment.id,
    author: mapCommentAuthor(comment.author),
    body: comment.body,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    isStale: false,
    isEdited: comment.updatedAt.getTime() !== comment.createdAt.getTime(),
    reactions: mapCommentReactions(comment.reactions, currentUserId),
  };
}

// Mirrors CommentsService, scoped to a suggestion. Every write is refused once the suggestion is
// linked to a submission (see assertSuggestionWritable).
@Injectable()
export class SuggestionCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly suggestions: SuggestionsService,
  ) {}

  private async loadCommentOrThrow(eventId: string, position: number, commentId: string) {
    const comment = await this.prisma.suggestionComment.findUnique({ where: { id: commentId } });
    if (!comment || comment.eventId !== eventId || comment.suggestionPosition !== position) {
      throw new NotFoundException(`No comment with id "${commentId}" on suggestion #${position}`);
    }
    return comment;
  }

  private async recomputeLastCommentAt(
    tx: Prisma.TransactionClient,
    eventId: string,
    position: number,
  ) {
    const agg = await tx.suggestionComment.aggregate({
      where: { eventId, suggestionPosition: position },
      _max: { updatedAt: true },
    });
    await tx.suggestion.update({
      where: { eventId_position: { eventId, position } },
      data: { lastCommentAt: agg._max.updatedAt },
    });
  }

  private async loadWritable(eventId: string, position: number) {
    const suggestion = await this.suggestions.loadOrThrow(eventId, position);
    assertSuggestionWritable(suggestion);
    return suggestion;
  }

  async list(eventId: string, position: number, currentUserId: string) {
    await this.suggestions.loadOrThrow(eventId, position);
    const comments = await this.prisma.suggestionComment.findMany({
      where: { eventId, suggestionPosition: position },
      include: COMMENT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return comments.map((comment) => mapSuggestionCommentForResponse(comment, currentUserId));
  }

  async create(eventId: string, position: number, authorId: string, dto: CreateCommentDto) {
    await this.loadWritable(eventId, position);
    // Same createdAt === updatedAt stamping as CommentsService.createComment, for isEdited.
    const now = new Date();
    const created = await this.prisma.$transaction(async (tx) => {
      const comment = await tx.suggestionComment.create({
        data: {
          eventId,
          suggestionPosition: position,
          authorId,
          body: dto.body,
          createdAt: now,
          updatedAt: now,
        },
        include: COMMENT_INCLUDE,
      });
      await this.recomputeLastCommentAt(tx, eventId, position);
      return comment;
    });
    return mapSuggestionCommentForResponse(created, authorId);
  }

  async updateOwn(
    eventId: string,
    position: number,
    commentId: string,
    authorId: string,
    dto: UpdateCommentDto,
  ) {
    await this.loadWritable(eventId, position);
    const existing = await this.loadCommentOrThrow(eventId, position, commentId);
    if (existing.authorId !== authorId) {
      throw new ForbiddenException('You can only edit your own comments');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const comment = await tx.suggestionComment.update({
        where: { id: commentId },
        data: { body: dto.body },
        include: COMMENT_INCLUDE,
      });
      await this.recomputeLastCommentAt(tx, eventId, position);
      return comment;
    });
    return mapSuggestionCommentForResponse(updated, authorId);
  }

  async deleteOwn(eventId: string, position: number, commentId: string, authorId: string) {
    await this.loadWritable(eventId, position);
    const existing = await this.loadCommentOrThrow(eventId, position, commentId);
    if (existing.authorId !== authorId) {
      throw new ForbiddenException('You can only delete your own comments');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.suggestionComment.delete({ where: { id: commentId } });
      await this.recomputeLastCommentAt(tx, eventId, position);
    });
    return { id: commentId };
  }

  async toggleReaction(
    eventId: string,
    position: number,
    commentId: string,
    userId: string,
    emoji: string,
  ) {
    await this.loadWritable(eventId, position);
    await this.loadCommentOrThrow(eventId, position, commentId);
    const key = { commentId_userId_emoji: { commentId, userId, emoji } };
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.suggestionCommentReaction.findUnique({ where: key });
      if (existing) await tx.suggestionCommentReaction.delete({ where: key });
      else await tx.suggestionCommentReaction.create({ data: { commentId, userId, emoji } });
    });
    const reactions = await this.prisma.suggestionCommentReaction.findMany({
      where: { commentId },
      include: { user: true },
    });
    return { reactions: mapCommentReactions(reactions, userId) };
  }
}
