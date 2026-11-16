import { Injectable } from '@nestjs/common';
import type { Event, Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { SuggestionImportEntryDto } from './dto/suggestion-import-entry.dto.js';
import type { ImportValidationErrorResponse } from './import.types.js';
import { computeSuggestionDiff } from './suggestions-import-diff.js';
import { mapSuggestionEntry } from './suggestions-import.mapper.js';
import type {
  NormalizedSuggestionInput,
  SuggestionImportApplyResponse,
  SuggestionImportDiff,
  SuggestionImportPreviewResponse,
} from './suggestions-import.types.js';

type ParsedFile =
  { ok: true; entries: NormalizedSuggestionInput[] } | { ok: false; errors: string[] };

@Injectable()
export class SuggestionsImportService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(
    event: Event,
    buffer: Buffer,
  ): Promise<SuggestionImportPreviewResponse | ImportValidationErrorResponse> {
    const parsed = await this.parseAndValidate(buffer);
    if (!parsed.ok) return parsed;

    const diff = computeSuggestionDiff(await this.loadExisting(event.id), parsed.entries);
    return {
      ok: true,
      summary: diff.summary,
      inserts: diff.inserts,
      updates: diff.updates.map((u) => ({
        ...u.input,
        previous: u.previous,
        changedFields: u.changedFields,
      })),
    };
  }

  async apply(
    event: Event,
    buffer: Buffer,
  ): Promise<SuggestionImportApplyResponse | ImportValidationErrorResponse> {
    const parsed = await this.parseAndValidate(buffer);
    if (!parsed.ok) return parsed;

    const diff = computeSuggestionDiff(await this.loadExisting(event.id), parsed.entries);
    await this.prisma.$transaction((tx) => this.writeDiff(tx, event.id, diff), {
      timeout: 30_000,
    });

    return {
      ok: true,
      result: {
        inserted: diff.summary.toInsert,
        updated: diff.summary.toUpdate,
        unchanged: diff.summary.unchanged,
      },
    };
  }

  private async parseAndValidate(buffer: Buffer): Promise<ParsedFile> {
    let raw: unknown;
    try {
      raw = JSON.parse(buffer.toString('utf-8'));
    } catch {
      return { ok: false, errors: ['File is not valid JSON'] };
    }
    if (!Array.isArray(raw)) {
      return { ok: false, errors: ['Expected a JSON array of suggestions'] };
    }

    const errors: string[] = [];
    const entries: NormalizedSuggestionInput[] = [];

    for (const [index, rawEntry] of raw.entries()) {
      const position = index + 1;
      if (typeof rawEntry !== 'object' || rawEntry === null || Array.isArray(rawEntry)) {
        errors.push(`entry #${position}: expected an object`);
        continue;
      }
      const instance = plainToInstance(SuggestionImportEntryDto, rawEntry);
      const validationErrors = await validate(instance, { whitelist: true });
      if (validationErrors.length > 0) {
        errors.push(
          `entry #${position}: ${validationErrors.map((e) => Object.values(e.constraints ?? {}).join('; ')).join('; ')}`,
        );
        continue;
      }
      const mapped = mapSuggestionEntry(position, instance);
      if (mapped.ok) entries.push(mapped.value);
      else errors.push(...mapped.errors);
    }

    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, entries };
  }

  private async loadExisting(eventId: string): Promise<NormalizedSuggestionInput[]> {
    return this.prisma.suggestion.findMany({
      where: { eventId },
      select: {
        position: true,
        submittedAt: true,
        submitter: true,
        chart: true,
        reason: true,
        link: true,
        consentToPublicReview: true,
      },
    });
  }

  private async writeDiff(
    tx: Prisma.TransactionClient,
    eventId: string,
    diff: SuggestionImportDiff,
  ): Promise<void> {
    if (diff.inserts.length > 0) {
      await tx.suggestion.createMany({
        data: diff.inserts.map((input) => ({ eventId, ...input })),
      });
    }

    for (const { input } of diff.updates) {
      const { position, ...fields } = input;
      await tx.suggestion.update({
        where: { eventId_position: { eventId, position } },
        data: fields,
      });
    }
  }
}
