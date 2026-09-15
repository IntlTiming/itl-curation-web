import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { EventsService } from '../events/events.service.js';
import { CommentsService } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { ToggleReactionDto } from './dto/toggle-reaction.dto.js';
import { UpdateCommentDto } from './dto/update-comment.dto.js';

// Same accessibility model as ReviewsController/SubmissionsController - open to anyone with
// access to the event, not just event admins. Nested under submissions/:fileId since every
// operation here is submission-scoped - unlike Reviews there's no cross-submission list.
@Controller('events/:slug/submissions/:fileId/comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(
    private readonly comments: CommentsService,
    private readonly events: EventsService,
  ) {}

  @Get()
  async list(
    @Param('slug') slug: string,
    @Param('fileId') fileId: string,
    @CurrentUser() user: User,
  ) {
    const event = await this.events.findAccessibleBySlug(user, slug);
    if (!event) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    return this.comments.listForSubmission(event.id, fileId, user.id);
  }

  @Post()
  async create(
    @Param('slug') slug: string,
    @Param('fileId') fileId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: User,
  ) {
    const event = await this.events.findAccessibleBySlug(user, slug);
    if (!event) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    return this.comments.createComment(event.id, fileId, user.id, dto);
  }

  @Patch(':commentId')
  async update(
    @Param('slug') slug: string,
    @Param('fileId') fileId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: User,
  ) {
    const event = await this.events.findAccessibleBySlug(user, slug);
    if (!event) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    return this.comments.updateOwnComment(event.id, fileId, commentId, user.id, dto);
  }

  @Delete(':commentId')
  async remove(
    @Param('slug') slug: string,
    @Param('fileId') fileId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: User,
  ) {
    const event = await this.events.findAccessibleBySlug(user, slug);
    if (!event) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    return this.comments.deleteOwnComment(event.id, fileId, commentId, user.id);
  }

  @Post(':commentId/reactions/toggle')
  async toggleReaction(
    @Param('slug') slug: string,
    @Param('fileId') fileId: string,
    @Param('commentId') commentId: string,
    @Body() dto: ToggleReactionDto,
    @CurrentUser() user: User,
  ) {
    const event = await this.events.findAccessibleBySlug(user, slug);
    if (!event) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    return this.comments.toggleReaction(event.id, fileId, commentId, user.id, dto.emoji);
  }
}
