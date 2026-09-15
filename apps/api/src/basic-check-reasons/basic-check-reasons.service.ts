import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BasicCheckReasonsService {
  constructor(private readonly prisma: PrismaService) {}

  listForEvent(eventId: string) {
    return this.prisma.basicCheckReason.findMany({
      where: { eventId, isActive: true },
      orderBy: [{ level: 'desc' }, { code: 'asc' }],
      select: { id: true, code: true, label: true, description: true, level: true },
    });
  }
}
