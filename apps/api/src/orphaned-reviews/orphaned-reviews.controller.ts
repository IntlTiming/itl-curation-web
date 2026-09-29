import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Event, User } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { EventAdminGuard } from '../events/event-admin.guard.js';
import { RelinkReviewDto } from './dto/relink-review.dto.js';
import { OrphanedReviewsService } from './orphaned-reviews.service.js';

// Event-admin only, like Import and Curators - reassigning a review's submissionId is a
// data-repair action, not something reviewers should ever reach.
@Controller('events/:slug/orphaned-reviews')
@UseGuards(JwtAuthGuard, EventAdminGuard)
export class OrphanedReviewsController {
  constructor(private readonly orphanedReviews: OrphanedReviewsService) {}

  @Get()
  list(@Req() req: Request & { event: Event }) {
    return this.orphanedReviews.listForEvent(req.event.id);
  }

  @Get('search-submissions')
  search(@Req() req: Request & { event: Event }, @Query('q') q = '') {
    return this.orphanedReviews.searchCandidates(req.event.id, q);
  }

  @Post(':reviewId/relink')
  relink(
    @Req() req: Request & { event: Event; user: User },
    @Param('reviewId') reviewId: string,
    @Body() dto: RelinkReviewDto,
  ) {
    return this.orphanedReviews.relinkReview(req.event.id, reviewId, dto.targetFileId, req.user.id);
  }
}
