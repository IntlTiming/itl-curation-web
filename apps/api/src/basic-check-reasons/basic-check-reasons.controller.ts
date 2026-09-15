import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { EventsService } from '../events/events.service.js';
import { BasicCheckReasonsService } from './basic-check-reasons.service.js';

// Same accessibility model as SubmissionsController/ReviewsController - open to anyone with
// access to the event (reviewers included), not just event admins.
@Controller('events/:slug/basic-check-reasons')
@UseGuards(JwtAuthGuard)
export class BasicCheckReasonsController {
  constructor(
    private readonly basicCheckReasons: BasicCheckReasonsService,
    private readonly events: EventsService,
  ) {}

  @Get()
  async list(@Param('slug') slug: string, @CurrentUser() user: User) {
    const event = await this.events.findAccessibleBySlug(user, slug);
    if (!event) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    return this.basicCheckReasons.listForEvent(event.id);
  }
}
