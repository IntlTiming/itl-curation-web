import { Body, Controller, Get, NotFoundException, Param, Put, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { EventsService } from '../events/events.service.js';
import { SetSelectionDto } from './dto/set-selection.dto.js';
import { SelectionsService } from './selections.service.js';

// Open to anyone with access to the event, not just event admins - any member can select or
// unselect a chart. Accountability comes from SubmissionSelectionLog rather than a role check.
@Controller('events/:slug/selections')
@UseGuards(JwtAuthGuard)
export class SelectionsController {
  constructor(
    private readonly selections: SelectionsService,
    private readonly events: EventsService,
  ) {}

  @Get('summary')
  async summary(@Param('slug') slug: string, @CurrentUser() user: User) {
    const event = await this.events.findAccessibleBySlug(user, slug);
    if (!event) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    return this.selections.getSummary(event.id);
  }

  @Put(':fileId')
  async set(
    @Param('slug') slug: string,
    @Param('fileId') fileId: string,
    @Body() dto: SetSelectionDto,
    @CurrentUser() user: User,
  ) {
    const event = await this.events.findAccessibleBySlug(user, slug);
    if (!event) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    return this.selections.setSelected(event.id, fileId, user.id, dto.selected);
  }
}
