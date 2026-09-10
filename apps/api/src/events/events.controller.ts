import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CheckSlugQueryDto } from './dto/check-slug-query.dto.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { EventsService } from './events.service.js';
import { GlobalAdminGuard } from './global-admin.guard.js';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.events.findAccessible(user);
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
    const event = await this.events.findAccessibleBySlug(user, slug);
    if (!event) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    return event;
  }
}
