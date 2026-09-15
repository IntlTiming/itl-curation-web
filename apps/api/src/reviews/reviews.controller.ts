import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { EventsService } from '../events/events.service.js';
import { ReviewsQueryDto } from './dto/reviews-query.dto.js';
import { UpsertReviewDto } from './dto/upsert-review.dto.js';
import { ReviewsService } from './reviews.service.js';

// Same accessibility model as SubmissionsController - open to anyone with access to the
// event (reviewers included), not just event admins.
@Controller('events/:slug/reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly events: EventsService,
  ) {}

  @Get()
  async list(
    @Param('slug') slug: string,
    @Query() query: ReviewsQueryDto,
    @CurrentUser() user: User,
  ) {
    const event = await this.events.findAccessibleBySlug(user, slug);
    if (!event) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    return this.reviews.listForEvent(event.id, user.id, query);
  }

  @Put(':fileId')
  async upsert(
    @Param('slug') slug: string,
    @Param('fileId') fileId: string,
    @Body() dto: UpsertReviewDto,
    @CurrentUser() user: User,
  ) {
    const event = await this.events.findAccessibleBySlug(user, slug);
    if (!event) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    return this.reviews.upsertOwnReview(event.id, fileId, user.id, dto);
  }
}
