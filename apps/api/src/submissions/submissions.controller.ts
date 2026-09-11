import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { EventsService } from '../events/events.service.js';
import { SubmissionsService } from './submissions.service.js';

// Unlike Import, this is open to anyone with access to the event (reviewers included), not
// just event admins - so the accessibility check is inline (mirroring
// EventsController.getBySlug) rather than behind EventAdminGuard.
@Controller('events/:slug/submissions')
@UseGuards(JwtAuthGuard)
export class SubmissionsController {
  constructor(
    private readonly submissions: SubmissionsService,
    private readonly events: EventsService,
  ) {}

  @Get()
  async list(@Param('slug') slug: string, @CurrentUser() user: User) {
    const event = await this.events.findAccessibleBySlug(user, slug);
    if (!event) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    return this.submissions.listForEvent(event.id);
  }
}
