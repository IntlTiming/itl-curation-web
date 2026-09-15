import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Event, User } from '@prisma/client';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { EventAdminGuard } from '../events/event-admin.guard.js';
import { CuratorsService } from './curators.service.js';
import { AddCuratorDto } from './dto/add-curator.dto.js';
import { SetCuratorAdminDto } from './dto/set-curator-admin.dto.js';

@Controller('events/:slug/curators')
@UseGuards(JwtAuthGuard, EventAdminGuard)
export class CuratorsController {
  constructor(private readonly curators: CuratorsService) {}

  @Get()
  list(@Req() req: Request & { event: Event }) {
    return this.curators.listForEvent(req.event.id);
  }

  @Get('search-users')
  searchUsers(@Req() req: Request & { event: Event }, @Query('q') q = '') {
    return this.curators.searchUsers(req.event.id, q);
  }

  @Post()
  add(@Req() req: Request & { event: Event }, @Body() dto: AddCuratorDto) {
    return this.curators.addCurator(req.event.id, dto.userId);
  }

  @Patch(':userId')
  setAdmin(
    @Req() req: Request & { event: Event; user: User },
    @Param('userId') userId: string,
    @Body() dto: SetCuratorAdminDto,
  ) {
    // The self-lockout guard only protects against losing access: a global admin's
    // isEventAdmin/accessibleWhere checks bypass EventRole entirely (see EventsService), so
    // demoting or removing themselves here can never lock them out - let them manage their own
    // row like any other member's.
    if (userId === req.user.id && !dto.isAdmin && !req.user.isGlobalAdmin) {
      throw new BadRequestException('You cannot remove your own admin access');
    }
    return this.curators.setAdmin(req.event.id, userId, dto.isAdmin);
  }

  @Delete(':userId')
  remove(@Req() req: Request & { event: Event; user: User }, @Param('userId') userId: string) {
    if (userId === req.user.id && !req.user.isGlobalAdmin) {
      throw new BadRequestException('You cannot remove your own access');
    }
    return this.curators.removeCurator(req.event.id, userId);
  }
}
