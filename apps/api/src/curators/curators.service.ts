import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventRoleType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export type Curator = {
  userId: string;
  discordId: string;
  discordUsername: string;
  displayName: string | null;
  discordAvatarHash: string | null;
  isAdmin: boolean;
  grantedAt: Date;
};

const SEARCH_RESULT_LIMIT = 10;

@Injectable()
export class CuratorsService {
  constructor(private readonly prisma: PrismaService) {}

  // Groups EventRole rows by user - a member can hold both REVIEWER and ADMIN rows, and
  // grantedAt reflects the REVIEWER row (baseline membership) when one exists, falling back
  // to the ADMIN row's own timestamp for the (UI-unreachable, DB-only) admin-without-reviewer
  // case.
  async listForEvent(eventId: string): Promise<Curator[]> {
    const roles = await this.prisma.eventRole.findMany({
      where: { eventId },
      include: { user: true },
      orderBy: { grantedAt: 'asc' },
    });
    const byUser = new Map<string, Curator>();
    for (const r of roles) {
      const entry = byUser.get(r.userId) ?? {
        userId: r.userId,
        discordId: r.user.discordId,
        discordUsername: r.user.discordUsername,
        displayName: r.user.displayName,
        discordAvatarHash: r.user.discordAvatarHash,
        isAdmin: false,
        grantedAt: r.grantedAt,
      };
      if (r.role === EventRoleType.ADMIN) entry.isAdmin = true;
      if (r.role === EventRoleType.REVIEWER) entry.grantedAt = r.grantedAt;
      byUser.set(r.userId, entry);
    }
    return [...byUser.values()];
  }

  searchUsers(eventId: string, query: string) {
    const q = query.trim();
    if (!q) return Promise.resolve([]);
    return this.prisma.user.findMany({
      where: {
        eventRoles: { none: { eventId } },
        OR: [
          { discordUsername: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        discordId: true,
        discordUsername: true,
        displayName: true,
        discordAvatarHash: true,
      },
      take: SEARCH_RESULT_LIMIT,
    });
  }

  async addCurator(eventId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('No such user');

    const existing = await this.prisma.eventRole.findUnique({
      where: { eventId_userId_role: { eventId, userId, role: EventRoleType.REVIEWER } },
    });
    if (existing) throw new ConflictException('User is already a member of this event');

    // A manual add fulfills any pending access request the user might have had - clear it in
    // the same transaction so they don't linger in the Access requests list once they're
    // already a member (deleteMany rather than delete: there may be no request at all).
    await this.prisma.$transaction([
      this.prisma.eventRole.create({ data: { eventId, userId, role: EventRoleType.REVIEWER } }),
      this.prisma.eventAccessRequest.deleteMany({ where: { eventId, userId } }),
    ]);
  }

  async setAdmin(eventId: string, userId: string, isAdmin: boolean): Promise<void> {
    if (isAdmin) {
      await this.prisma.eventRole.upsert({
        where: { eventId_userId_role: { eventId, userId, role: EventRoleType.ADMIN } },
        update: {},
        create: { eventId, userId, role: EventRoleType.ADMIN },
      });
    } else {
      await this.prisma.eventRole.deleteMany({
        where: { eventId, userId, role: EventRoleType.ADMIN },
      });
    }
  }

  async removeCurator(eventId: string, userId: string): Promise<void> {
    await this.prisma.eventRole.deleteMany({ where: { eventId, userId } });
  }
}
