import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { EventsService } from '../events/events.service.js';
import { OverviewService } from './overview.service.js';

// Same accessibility model as UsersController/SubmittersController/ReviewsController - open to
// anyone with access to the event, not just event admins.
@Controller('events/:slug')
@UseGuards(JwtAuthGuard)
export class OverviewController {
  constructor(
    private readonly overview: OverviewService,
    private readonly events: EventsService,
  ) {}

  @Get('overview')
  async get(@Param('slug') slug: string, @CurrentUser() user: User) {
    const event = await this.events.findAccessibleBySlug(user, slug);
    if (!event) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    return this.overview.getForEvent(event.id);
  }
}
