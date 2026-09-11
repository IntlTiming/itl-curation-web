import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Event, User } from '@prisma/client';
import type { Request } from 'express';
import { EventsService } from './events.service.js';

// Unlike GlobalAdminGuard (which only inspects request.user), this reads the route's
// :slug param too, so it belongs on any route shaped @Controller('events/:slug/...').
// Resolves the event once and attaches it to the request so handlers don't refetch it.
@Injectable()
export class EventAdminGuard implements CanActivate {
  constructor(private readonly events: EventsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: User; event?: Event; params: Record<string, string> }>();

    const slug = request.params.slug;
    const event = slug ? await this.events.findAccessibleBySlug(request.user, slug) : null;
    if (!event) {
      throw new NotFoundException(`No event with slug "${slug}"`);
    }
    if (!(await this.events.isEventAdmin(request.user, event.id))) {
      throw new ForbiddenException('Event admin access required');
    }

    request.event = event;
    return true;
  }
}
