import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { EventsService } from '../events/events.service.js';
import { SubmittersService } from './submitters.service.js';

// Same accessibility model as SubmissionsController/ReviewsController - open to anyone with
// access to the event, not just event admins.
@Controller('events/:slug/submitters')
@UseGuards(JwtAuthGuard)
export class SubmittersController {
  constructor(
    private readonly submitters: SubmittersService,
    private readonly events: EventsService,
  ) {}

  @Get()
  async list(@Param('slug') slug: string, @CurrentUser() user: User) {
    const event = await this.events.findAccessibleBySlug(user, slug);
    if (!event) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    return this.submitters.listForEvent(event.id);
  }
}
