import { ConflictException, Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateEventDto } from './dto/create-event.dto.js';

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

  async isSlugAvailable(slug: string): Promise<boolean> {
    const existing = await this.prisma.event.findUnique({ where: { slug } });
    return existing === null;
  }

  async create(dto: CreateEventDto) {
    try {
      return await this.prisma.event.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          date: dto.date ? new Date(dto.date) : undefined,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`An event with slug "${dto.slug}" already exists`);
      }
      throw err;
    }
  }
}
