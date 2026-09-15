import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventRoleType, EventVisibility, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export type PendingAccessRequest = {
  userId: string;
  discordId: string;
  discordUsername: string;
  displayName: string | null;
  discordAvatarHash: string | null;
  requestedAt: Date;
};

@Injectable()
export class AccessRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(slug: string, userId: string): Promise<void> {
    const event = await this.prisma.event.findFirst({
      where: { slug, archivedAt: null, visibility: EventVisibility.PUBLIC },
    });
    if (!event) throw new NotFoundException(`No event with slug "${slug}"`);

    const existingRole = await this.prisma.eventRole.findFirst({
      where: { eventId: event.id, userId },
    });
    if (existingRole) throw new ConflictException('Already a member of this event');

    try {
      await this.prisma.eventAccessRequest.create({ data: { eventId: event.id, userId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Access already requested');
      }
      throw err;
    }
  }

  async revokeOwnRequest(slug: string, userId: string): Promise<void> {
    const event = await this.prisma.event.findUnique({ where: { slug } });
    if (!event) throw new NotFoundException(`No event with slug "${slug}"`);
    await this.deleteRequest(event.id, userId);
  }

  async listPending(eventId: string): Promise<PendingAccessRequest[]> {
    const requests = await this.prisma.eventAccessRequest.findMany({
      where: { eventId },
      include: { user: true },
      orderBy: { requestedAt: 'asc' },
    });
    return requests.map((r) => ({
      userId: r.userId,
      discordId: r.user.discordId,
      discordUsername: r.user.discordUsername,
      displayName: r.user.displayName,
      discordAvatarHash: r.user.discordAvatarHash,
      requestedAt: r.requestedAt,
    }));
  }

  // Approve: atomically consume the pending request and grant baseline REVIEWER access.
  async approve(eventId: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.eventAccessRequest.deleteMany({ where: { eventId, userId } });
      if (deleted.count === 0) throw new NotFoundException('No pending request for this user');
      await tx.eventRole.upsert({
        where: { eventId_userId_role: { eventId, userId, role: EventRoleType.REVIEWER } },
        update: {},
        create: { eventId, userId, role: EventRoleType.REVIEWER },
      });
    });
  }

  // Shared by the requester's own revoke and an admin's deny - same operation either way,
  // just called from a different route/permission level. Deliberately idempotent (no error
  // when there's nothing to delete): the caller's desired end state - "not pending" - already
  // holds, e.g. if it raced with an approve/deny/revoke from elsewhere. Unlike approve, this
  // never grants anything, so silently no-op'ing here can't have a surprising side effect.
  async deleteRequest(eventId: string, userId: string): Promise<void> {
    await this.prisma.eventAccessRequest.deleteMany({ where: { eventId, userId } });
  }
}
