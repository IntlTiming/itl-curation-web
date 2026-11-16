import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Event, User } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateCommentDto } from '../comments/dto/create-comment.dto.js';
import { ToggleReactionDto } from '../comments/dto/toggle-reaction.dto.js';
import { UpdateCommentDto } from '../comments/dto/update-comment.dto.js';
import { EventAdminGuard } from '../events/event-admin.guard.js';
import { EventsService } from '../events/events.service.js';
import { OrphanedReviewsService } from '../orphaned-reviews/orphaned-reviews.service.js';
import { UpsertReviewDto } from '../reviews/dto/upsert-review.dto.js';
import { LinkSuggestionDto } from './dto/link-suggestion.dto.js';
import { SuggestionCommentsService } from './suggestion-comments.service.js';
import { SuggestionsService } from './suggestions.service.js';

// Event-admin only. Registered BEFORE SuggestionsController in SuggestionsModule so the literal
// search-submissions path is matched before SuggestionsController's GET :position.
@Controller('events/:slug/suggestions')
@UseGuards(JwtAuthGuard, EventAdminGuard)
export class SuggestionLinksController {
  constructor(
    private readonly suggestions: SuggestionsService,
    private readonly orphanedReviews: OrphanedReviewsService,
  ) {}

  @Get('search-submissions')
  searchSubmissions(@Req() req: Request & { event: Event }, @Query('q') q = '') {
    return this.orphanedReviews.searchCandidates(req.event.id, q);
  }

  @Post(':position/link')
  link(
    @Req() req: Request & { event: Event },
    @Param('position', ParseIntPipe) position: number,
    @Body() dto: LinkSuggestionDto,
    @CurrentUser() user: User,
  ) {
    return this.suggestions.link(req.event.id, position, dto.fileId, user.id);
  }

  @Delete(':position/link')
  unlink(
    @Req() req: Request & { event: Event },
    @Param('position', ParseIntPipe) position: number,
  ) {
    return this.suggestions.unlink(req.event.id, position);
  }
}

// Same accessibility model as ReviewsController/CommentsController - open to anyone with access
// to the event, not just event admins.
@Controller('events/:slug/suggestions')
@UseGuards(JwtAuthGuard)
export class SuggestionsController {
  constructor(
    private readonly suggestions: SuggestionsService,
    private readonly comments: SuggestionCommentsService,
    private readonly events: EventsService,
  ) {}

  private async eventIdOrThrow(user: User, slug: string): Promise<string> {
    const event = await this.events.findAccessibleBySlug(user, slug);
    if (!event) throw new NotFoundException(`No event with slug "${slug}"`);
    return event.id;
  }

  @Get()
  async list(@Param('slug') slug: string, @CurrentUser() user: User) {
    return this.suggestions.listForEvent(await this.eventIdOrThrow(user, slug), user.id);
  }

  @Get(':position')
  async get(
    @Param('slug') slug: string,
    @Param('position', ParseIntPipe) position: number,
    @CurrentUser() user: User,
  ) {
    return this.suggestions.getForEvent(await this.eventIdOrThrow(user, slug), position);
  }

  @Put(':position/review')
  async upsertReview(
    @Param('slug') slug: string,
    @Param('position', ParseIntPipe) position: number,
    @Body() dto: UpsertReviewDto,
    @CurrentUser() user: User,
  ) {
    const eventId = await this.eventIdOrThrow(user, slug);
    return this.suggestions.upsertOwnReview(eventId, position, user.id, dto);
  }

  @Get(':position/comments')
  async listComments(
    @Param('slug') slug: string,
    @Param('position', ParseIntPipe) position: number,
    @CurrentUser() user: User,
  ) {
    return this.comments.list(await this.eventIdOrThrow(user, slug), position, user.id);
  }

  @Post(':position/comments')
  async createComment(
    @Param('slug') slug: string,
    @Param('position', ParseIntPipe) position: number,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: User,
  ) {
    return this.comments.create(await this.eventIdOrThrow(user, slug), position, user.id, dto);
  }

  @Patch(':position/comments/:commentId')
  async updateComment(
    @Param('slug') slug: string,
    @Param('position', ParseIntPipe) position: number,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: User,
  ) {
    const eventId = await this.eventIdOrThrow(user, slug);
    return this.comments.updateOwn(eventId, position, commentId, user.id, dto);
  }

  @Delete(':position/comments/:commentId')
  async deleteComment(
    @Param('slug') slug: string,
    @Param('position', ParseIntPipe) position: number,
    @Param('commentId') commentId: string,
    @CurrentUser() user: User,
  ) {
    const eventId = await this.eventIdOrThrow(user, slug);
    return this.comments.deleteOwn(eventId, position, commentId, user.id);
  }

  @Post(':position/comments/:commentId/reactions/toggle')
  async toggleReaction(
    @Param('slug') slug: string,
    @Param('position', ParseIntPipe) position: number,
    @Param('commentId') commentId: string,
    @Body() dto: ToggleReactionDto,
    @CurrentUser() user: User,
  ) {
    const eventId = await this.eventIdOrThrow(user, slug);
    return this.comments.toggleReaction(eventId, position, commentId, user.id, dto.emoji);
  }
}
