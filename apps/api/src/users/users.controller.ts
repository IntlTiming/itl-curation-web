import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { EventsService } from '../events/events.service.js';
import { UsersService } from './users.service.js';

// Same accessibility model as SubmissionsController/ReviewsController/SubmittersController -
// open to anyone with access to the event, not just event admins.
//
// The detail route lives at events/:slug/user/:userId rather than nested under .../reviewers/ -
// mirroring the frontend's own routing split, where the Reviewers tab is a ?tab= param on the
// event page but the drill-down page is its own top-level /events/:slug/user/:userId route (the
// entity being viewed is a user, not "a reviewers").
@Controller('events/:slug')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly events: EventsService,
  ) {}

  @Get('reviewers')
  async list(@Param('slug') slug: string, @CurrentUser() user: User) {
    const event = await this.events.findAccessibleBySlug(user, slug);
    if (!event) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    return this.users.listForEvent(event.id);
  }

  @Get('user/:userId')
  async detail(
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @CurrentUser() user: User,
  ) {
    const event = await this.events.findAccessibleBySlug(user, slug);
    if (!event) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    return this.users.getDetail(event.id, userId);
  }
}
