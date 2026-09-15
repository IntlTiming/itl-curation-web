import { ConflictException, Injectable } from '@nestjs/common';
import type { Event, User } from '@prisma/client';
import { EventVisibility, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { BASIC_CHECK_REASON_SEED_DATA } from './basic-check-reasons.seed-data.js';
import type { CreateEventDto } from './dto/create-event.dto.js';
import { TECH_TAG_SEED_DATA } from './tech-tags.seed-data.js';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  // Events `user` can access: global admins see all non-archived events;
  // everyone else sees only events they hold an EventRole on. This is the
  // single `isGlobalAdmin OR exists(EventRole ...)` helper REQUIREMENTS.md
  // calls for - don't re-derive this check at other call sites.
  private accessibleWhere(user: User) {
    return {
      archivedAt: null,
      ...(user.isGlobalAdmin ? {} : { roles: { some: { userId: user.id } } }),
    };
  }

  findAccessible(user: User) {
    return this.prisma.event.findMany({
      where: this.accessibleWhere(user),
      orderBy: { date: 'desc' },
    });
  }

  findAccessibleBySlug(user: User, slug: string) {
    return this.prisma.event.findFirst({
      where: { slug, ...this.accessibleWhere(user) },
    });
  }

  // Everything `user` can even see: accessible events (as above) plus any PUBLIC event they
  // aren't a member of. Deliberately separate from accessibleWhere - visibility only affects
  // discoverability (the events list, and a limited detail view offering a Request-access
  // action), never read/write access to event content, which still requires a real EventRole.
  async findVisible(user: User) {
    const events = await this.prisma.event.findMany({
      where: {
        archivedAt: null,
        ...(user.isGlobalAdmin
          ? {}
          : {
              OR: [
                { visibility: EventVisibility.PUBLIC },
                { roles: { some: { userId: user.id } } },
              ],
            }),
      },
      include: { roles: { where: { userId: user.id }, select: { id: true } } },
      orderBy: { date: 'desc' },
    });
    return events.map(({ roles, ...event }) => ({
      ...event,
      isMember: user.isGlobalAdmin || roles.length > 0,
    }));
  }

  // Same idea as findVisible, for a single event by slug. Returns null when the event
  // doesn't exist, is archived, or is private and user isn't a member - all indistinguishable
  // 404s to the caller, same as findAccessibleBySlug today.
  async findVisibleBySlug(
    user: User,
    slug: string,
  ): Promise<{ event: Event; isMember: boolean } | null> {
    const accessible = await this.findAccessibleBySlug(user, slug);
    if (accessible) return { event: accessible, isMember: true };

    const publicEvent = await this.prisma.event.findFirst({
      where: { slug, archivedAt: null, visibility: EventVisibility.PUBLIC },
    });
    return publicEvent ? { event: publicEvent, isMember: false } : null;
  }

  setVisibility(eventId: string, visibility: EventVisibility) {
    return this.prisma.event.update({ where: { id: eventId }, data: { visibility } });
  }

  // Lives here (rather than on AccessRequestsService) so EventsController's getBySlug can use
  // it without EventsModule depending back on AccessRequestsModule.
  async hasPendingAccessRequest(eventId: string, userId: string): Promise<boolean> {
    const request = await this.prisma.eventAccessRequest.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    return request !== null;
  }

  async isEventAdmin(user: User, eventId: string): Promise<boolean> {
    if (user.isGlobalAdmin) return true;
    const role = await this.prisma.eventRole.findFirst({
      where: { eventId, userId: user.id, role: 'ADMIN' },
    });
    return role !== null;
  }

  async isSlugAvailable(slug: string): Promise<boolean> {
    const existing = await this.prisma.event.findUnique({ where: { slug } });
    return existing === null;
  }

  // TechTag is a global table (no eventId), so this seeds it once, the first time any
  // event is ever created - upsert-by-label makes every later call a no-op, which is why
  // it's safe to run unconditionally on every event creation rather than checking first.
  async create(dto: CreateEventDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const event = await tx.event.create({
          data: {
            name: dto.name,
            slug: dto.slug,
            date: dto.date ? new Date(dto.date) : undefined,
          },
        });
        for (const tag of TECH_TAG_SEED_DATA) {
          await tx.techTag.upsert({ where: { label: tag.label }, update: {}, create: tag });
        }
        // BasicCheckReason is event-scoped (unlike the global TechTag above), so every new
        // event gets its own fresh copy of the starter set rather than an upsert.
        await tx.basicCheckReason.createMany({
          data: BASIC_CHECK_REASON_SEED_DATA.map((reason) => ({ ...reason, eventId: event.id })),
        });
        return event;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`An event with slug "${dto.slug}" already exists`);
      }
      throw err;
    }
  }
}
