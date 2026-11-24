import { Injectable, NotFoundException } from '@nestjs/common';
import type { Playstyle, SelectionAction, User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

// Correlated EXISTS used anywhere a query needs "is this submission selected" against an outer
// `submissions s` alias - a PK lookup on submission_selections. Shared with ReviewsService's
// selectedOnly filter and isSelected column so every caller agrees on the definition.
export const IS_SELECTED_FRAGMENT = Prisma.sql`EXISTS (
  SELECT 1 FROM submission_selections ss WHERE ss."submissionId" = s."fileId"
)`;

export type SelectionUser = {
  id: string;
  displayName: string;
  discordId: string;
  discordAvatarHash: string | null;
};

export function mapSelectionUser(user: User): SelectionUser {
  return {
    id: user.id,
    displayName: user.displayName ?? user.discordUsername,
    discordId: user.discordId,
    discordAvatarHash: user.discordAvatarHash,
  };
}

export type SelectionState = {
  selected: boolean;
  selectedAt: Date | null;
  selectedBy: SelectionUser | null;
};

export type SelectionLogEntry = {
  id: string;
  action: SelectionAction;
  user: SelectionUser;
  timestamp: Date;
};

export type SelectionSummaryRow = {
  playstyle: Playstyle;
  meter: number;
  derivedFocus: string;
  count: number;
};

export type SelectionSummaryResponse = {
  rows: SelectionSummaryRow[];
  // Selected submissions left out of `rows` because they're ignored or have no parsed chart (no
  // meter/playstyle to bucket them by) - surfaced so the tab can warn rather than silently
  // under-count.
  excludedCount: number;
};

export type RawSelectionSummaryRow = {
  playstyle: Playstyle;
  meter: number;
  derivedFocus: string;
  count: bigint;
};

// Same population as the Reviews table (charts JOIN, not ignored), restricted to selected
// submissions. Uses the parsed chart's playstyle/meter (not the submitter-claimed ones), matching
// what the Reviews table filters and displays.
export function buildSelectionSummaryQuery(eventId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT c.playstyle, c.meter, s."derivedFocus" AS "derivedFocus", COUNT(*) AS count
    FROM submissions s
    JOIN submission_selections ss ON ss."submissionId" = s."fileId"
    JOIN charts c ON c."submissionId" = s."fileId"
    WHERE s."eventId" = ${eventId} AND NOT s."isIgnored"
    GROUP BY c.playstyle, c.meter, s."derivedFocus"
    ORDER BY c.playstyle, c.meter, s."derivedFocus"
  `;
}

export function buildSelectionExcludedCountQuery(eventId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT COUNT(*) AS count
    FROM submissions s
    JOIN submission_selections ss ON ss."submissionId" = s."fileId"
    LEFT JOIN charts c ON c."submissionId" = s."fileId"
    WHERE s."eventId" = ${eventId} AND (s."isIgnored" OR c.id IS NULL)
  `;
}

export function mapSelectionSummaryRow(row: RawSelectionSummaryRow): SelectionSummaryRow {
  return {
    playstyle: row.playstyle,
    meter: row.meter,
    derivedFocus: row.derivedFocus,
    count: Number(row.count),
  };
}

@Injectable()
export class SelectionsService {
  constructor(private readonly prisma: PrismaService) {}

  // Idempotent: requesting the state a submission is already in changes nothing and writes no
  // audit-log row, so a double-click or a stale tab can't spam the log.
  async setSelected(
    eventId: string,
    fileId: string,
    userId: string,
    selected: boolean,
  ): Promise<SelectionState> {
    const submission = await this.prisma.submission.findUnique({
      where: { fileId },
      select: { eventId: true },
    });
    if (!submission || submission.eventId !== eventId) {
      throw new NotFoundException(`No submission with id "${fileId}"`);
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.submissionSelection.findUnique({
        where: { submissionId: fileId },
        include: { selectedBy: true },
      });

      if (selected && !existing) {
        const created = await tx.submissionSelection.create({
          data: { submissionId: fileId, selectedById: userId },
          include: { selectedBy: true },
        });
        await tx.submissionSelectionLog.create({
          data: { submissionId: fileId, userId, action: 'SELECTED' },
        });
        return {
          selected: true,
          selectedAt: created.selectedAt,
          selectedBy: mapSelectionUser(created.selectedBy),
        };
      }

      if (!selected && existing) {
        await tx.submissionSelection.delete({ where: { submissionId: fileId } });
        await tx.submissionSelectionLog.create({
          data: { submissionId: fileId, userId, action: 'UNSELECTED' },
        });
        return { selected: false, selectedAt: null, selectedBy: null };
      }

      return existing
        ? {
            selected: true,
            selectedAt: existing.selectedAt,
            selectedBy: mapSelectionUser(existing.selectedBy),
          }
        : { selected: false, selectedAt: null, selectedBy: null };
    });
  }

  async getSummary(eventId: string): Promise<SelectionSummaryResponse> {
    const [rows, excluded] = await Promise.all([
      this.prisma.$queryRaw<RawSelectionSummaryRow[]>(buildSelectionSummaryQuery(eventId)),
      this.prisma.$queryRaw<{ count: bigint }[]>(buildSelectionExcludedCountQuery(eventId)),
    ]);
    return {
      rows: rows.map(mapSelectionSummaryRow),
      excludedCount: Number(excluded[0]?.count ?? 0),
    };
  }
}
