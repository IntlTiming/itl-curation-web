import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Event, User } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CheckSlugQueryDto } from './dto/check-slug-query.dto.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { SetEventVisibilityDto } from './dto/set-event-visibility.dto.js';
import { EventAdminGuard } from './event-admin.guard.js';
import { EventsService } from './events.service.js';
import { GlobalAdminGuard } from './global-admin.guard.js';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.events.findVisible(user);
  }

  @Get('check-slug')
  @UseGuards(GlobalAdminGuard)
  async checkSlug(@Query() query: CheckSlugQueryDto) {
    const available = await this.events.isSlugAvailable(query.slug);
    return { slug: query.slug, available };
  }

  @Post()
  @UseGuards(GlobalAdminGuard)
  create(@Body() dto: CreateEventDto) {
    return this.events.create(dto);
  }

  // Registered after the static 'check-slug' route so it doesn't swallow it.
  @Get(':slug')
  async getBySlug(@Param('slug') slug: string, @CurrentUser() user: User) {
    const visible = await this.events.findVisibleBySlug(user, slug);
    if (!visible) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    const { event, isMember } = visible;
    if (!isMember) {
      const hasPendingRequest = await this.events.hasPendingAccessRequest(event.id, user.id);
      return {
        id: event.id,
        slug: event.slug,
        name: event.name,
        date: event.date,
        visibility: event.visibility,
        isEventAdmin: false,
        isMember: false,
        hasPendingRequest,
      };
    }
    const isEventAdmin = await this.events.isEventAdmin(user, event.id);
    return { ...event, isEventAdmin, isMember: true };
  }

  @Patch(':slug/visibility')
  @UseGuards(EventAdminGuard)
  setVisibility(@Req() req: Request & { event: Event }, @Body() dto: SetEventVisibilityDto) {
    return this.events.setVisibility(req.event.id, dto.visibility);
  }
}
