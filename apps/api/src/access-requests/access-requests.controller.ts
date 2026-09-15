import { Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Event, User } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { EventAdminGuard } from '../events/event-admin.guard.js';
import { AccessRequestsService } from './access-requests.service.js';

@Controller('events/:slug/access-requests')
@UseGuards(JwtAuthGuard)
export class AccessRequestsController {
  constructor(private readonly accessRequests: AccessRequestsService) {}

  @Post()
  create(@Param('slug') slug: string, @CurrentUser() user: User) {
    return this.accessRequests.createRequest(slug, user.id);
  }

  @Delete()
  revokeOwn(@Param('slug') slug: string, @CurrentUser() user: User) {
    return this.accessRequests.revokeOwnRequest(slug, user.id);
  }

  @Get()
  @UseGuards(EventAdminGuard)
  listPending(@Req() req: Request & { event: Event }) {
    return this.accessRequests.listPending(req.event.id);
  }

  @Post(':userId/approve')
  @UseGuards(EventAdminGuard)
  approve(@Req() req: Request & { event: Event }, @Param('userId') userId: string) {
    return this.accessRequests.approve(req.event.id, userId);
  }

  @Delete(':userId')
  @UseGuards(EventAdminGuard)
  deny(@Req() req: Request & { event: Event }, @Param('userId') userId: string) {
    return this.accessRequests.deleteRequest(req.event.id, userId);
  }
}
