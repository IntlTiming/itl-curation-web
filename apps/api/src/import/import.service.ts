import { Injectable } from '@nestjs/common';
import type { Event, Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { SubmissionImportEntryDto } from './dto/submission-import-entry.dto.js';
import { computeDiff } from './import-diff.js';
import type {
  ExistingSubmissionSnapshot,
  ImportApplyResponse,
  ImportDiff,
  ImportPreviewResponse,
  ImportValidationErrorResponse,
  NormalizedChart,
  NormalizedSubmissionInput,
  SubmissionDetailFields,
} from './import.types.js';
import { mapSubmissionEntry } from './submissions-import.mapper.js';

type ParsedFile =
  | { ok: true; entries: NormalizedSubmissionInput[]; techTagsById: ReadonlyMap<string, string> }
  | { ok: false; errors: string[] };

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(
    event: Event,
    buffer: Buffer,
  ): Promise<ImportPreviewResponse | ImportValidationErrorResponse> {
    const parsed = await this.parseAndValidate(event, buffer);
    if (!parsed.ok) return parsed;

    const existing = await this.loadExisting(event.id);
    const diff = computeDiff(existing, parsed.entries);
    return this.toPreviewResponse(diff, parsed.techTagsById);
  }

  async apply(
    event: Event,
    buffer: Buffer,
  ): Promise<ImportApplyResponse | ImportValidationErrorResponse> {
    const parsed = await this.parseAndValidate(event, buffer);
    if (!parsed.ok) return parsed;

    const existing = await this.loadExisting(event.id);
    const diff = computeDiff(existing, parsed.entries);

    await this.prisma.$transaction(
      (tx) => this.writeDiff(tx, event.id, diff),
      { timeout: 30_000 }, // untested at ~321 rows - the default 5s may not be enough
    );

    return {
      ok: true,
      result: {
        inserted: diff.summary.toInsert,
        updated: diff.summary.toUpdate,
        newlyIgnored: diff.summary.toIgnore,
        unchanged: diff.summary.unchanged,
        alreadyIgnored: diff.summary.alreadyIgnored,
        chartsCleared:
          diff.newlyIgnored.filter((r) => r.chartCleared).length + diff.chartCleanup.length,
      },
    };
  }

  private async parseAndValidate(event: Event, buffer: Buffer): Promise<ParsedFile> {
    let raw: unknown;
    try {
      raw = JSON.parse(buffer.toString('utf-8'));
    } catch {
      return { ok: false, errors: ['File is not valid JSON'] };
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return { ok: false, errors: ['Expected a JSON object keyed by fileId, not an array'] };
    }

    const techTags = await this.prisma.techTag.findMany();
    const techTagsByLabel = new Map(techTags.map((tag) => [tag.label, tag.id]));
    const techTagsById = new Map(techTags.map((tag) => [tag.id, tag.label]));

    const errors: string[] = [];
    const entries: NormalizedSubmissionInput[] = [];

    for (const [key, rawEntry] of Object.entries(raw as Record<string, unknown>)) {
      const instance = plainToInstance(SubmissionImportEntryDto, rawEntry);
      const validationErrors = await validate(instance, { whitelist: true });
      if (validationErrors.length > 0) {
        errors.push(
          `fileId ${key}: ${validationErrors.map((e) => Object.values(e.constraints ?? {}).join('; ')).join('; ')}`,
        );
        continue;
      }
      const mapped = mapSubmissionEntry(key, instance, techTagsByLabel);
      if (!mapped.ok) {
        errors.push(...mapped.errors);
      } else {
        entries.push(mapped.value);
      }
    }

    if (errors.length > 0) return { ok: false, errors };

    // fileId is a bare @id, not scoped by eventId - guard against a fileId that already
    // belongs to a different event rather than silently reassigning/overwriting it.
    const collisions = await this.prisma.submission.findMany({
      where: { fileId: { in: entries.map((e) => e.fileId) }, eventId: { not: event.id } },
      select: { fileId: true, eventId: true },
    });
    if (collisions.length > 0) {
      return {
        ok: false,
        errors: collisions.map(
          (c) => `fileId ${c.fileId}: already belongs to a different event (${c.eventId})`,
        ),
      };
    }

    return { ok: true, entries, techTagsById };
  }

  private async loadExisting(eventId: string): Promise<ExistingSubmissionSnapshot[]> {
    const rows = await this.prisma.submission.findMany({
      where: { eventId },
      include: { chart: true, techTags: true },
    });

    return rows.map((row) => ({
      fileId: row.fileId,
      submitter: row.submitter,
      stepartist: row.stepartist,
      pack: row.pack,
      playstyle: row.playstyle,
      difficulty: row.difficulty,
      focus: row.focus,
      derivedFocus: row.derivedFocus,
      cmodPreference: row.cmodPreference,
      releaseYear: row.releaseYear,
      theme: row.theme,
      additionalNotes: row.additionalNotes,
      consentToPublicReview: row.consentToPublicReview,
      fileUrl: row.fileUrl,
      driveMd5: row.driveMd5,
      processingError: row.processingError,
      songDir: row.songDir,
      bannerSlug: row.bannerSlug,
      isInternal: row.isInternal,
      submittedAt: row.submittedAt,
      isIgnored: row.isIgnored,
      techTagIds: row.techTags.map((t) => t.techTagId),
      singleTechTagId: row.singleTechTagId,
      chart: row.chart ? chartToNormalized(row.chart) : null,
    }));
  }

  private toPreviewResponse(
    diff: ImportDiff,
    techTagsById: ReadonlyMap<string, string>,
  ): ImportPreviewResponse {
    return {
      ok: true,
      summary: diff.summary,
      inserts: diff.inserts.map((i) => ({
        ...i.row,
        chart: toWireChart(i.input.chart),
        submission: toSubmissionDetailFields(i.input, techTagsById),
      })),
      updates: diff.updates.map((u) => ({
        ...u.row,
        changedFields: u.changedFields,
        chart: toWireChart(u.input.chart),
        previousChart: toWireChart(u.previousChart),
        submission: toSubmissionDetailFields(u.input, techTagsById),
        previousSubmission: toSubmissionDetailFields(u.previousInput, techTagsById),
      })),
      newlyIgnored: diff.newlyIgnored,
      chartCleanup: diff.chartCleanup,
    };
  }

  private async writeDiff(
    tx: Prisma.TransactionClient,
    eventId: string,
    diff: ImportDiff,
  ): Promise<void> {
    for (const { input } of diff.inserts) {
      await tx.submission.create({
        data: {
          fileId: input.fileId,
          eventId,
          submitter: input.submitter,
          stepartist: input.stepartist,
          pack: input.pack,
          playstyle: input.playstyle,
          difficulty: input.difficulty,
          focus: input.focus,
          derivedFocus: input.derivedFocus,
          cmodPreference: input.cmodPreference,
          releaseYear: input.releaseYear,
          theme: input.theme,
          additionalNotes: input.additionalNotes,
          consentToPublicReview: input.consentToPublicReview,
          fileUrl: input.fileUrl,
          driveMd5: input.driveMd5,
          processingError: input.processingError,
          songDir: input.songDir,
          bannerSlug: input.bannerSlug,
          isInternal: input.isInternal,
          submittedAt: input.submittedAt,
          isIgnored: input.isIgnored,
          singleTechTagId: input.singleTechTagId,
          techTags: input.techTagIds.length
            ? { create: input.techTagIds.map((techTagId) => ({ techTagId })) }
            : undefined,
          chart: input.chart ? { create: { ...input.chart } } : undefined,
        },
      });
    }

    for (const u of diff.updates) {
      const data: Prisma.SubmissionUncheckedUpdateInput = {
        submitter: u.input.submitter,
        stepartist: u.input.stepartist,
        pack: u.input.pack,
        playstyle: u.input.playstyle,
        difficulty: u.input.difficulty,
        focus: u.input.focus,
        derivedFocus: u.input.derivedFocus,
        cmodPreference: u.input.cmodPreference,
        releaseYear: u.input.releaseYear,
        theme: u.input.theme,
        additionalNotes: u.input.additionalNotes,
        consentToPublicReview: u.input.consentToPublicReview,
        fileUrl: u.input.fileUrl,
        driveMd5: u.input.driveMd5,
        processingError: u.input.processingError,
        songDir: u.input.songDir,
        bannerSlug: u.input.bannerSlug,
        isInternal: u.input.isInternal,
        submittedAt: u.input.submittedAt,
        isIgnored: u.input.isIgnored,
        singleTechTagId: u.input.singleTechTagId,
      };
      if (u.techTagsChanged) {
        data.techTags = {
          deleteMany: {},
          create: u.input.techTagIds.map((techTagId) => ({ techTagId })),
        };
      }
      if (u.chartOp === 'create') data.chart = { create: { ...u.input.chart! } };
      else if (u.chartOp === 'update') data.chart = { update: { ...u.input.chart! } };
      else if (u.chartOp === 'delete') data.chart = { delete: true };

      await tx.submission.update({ where: { fileId: u.input.fileId }, data });
    }

    for (const row of diff.newlyIgnored) {
      await tx.submission.update({
        where: { fileId: row.fileId },
        data: { isIgnored: true, ...(row.chartCleared ? { chart: { delete: true } } : {}) },
      });
    }

    for (const row of diff.chartCleanup) {
      await tx.submission.update({
        where: { fileId: row.fileId },
        data: { chart: { delete: true } },
      });
    }
  }
}

function chartToNormalized(chart: {
  hash: string;
  title: string;
  titleRomaji: string;
  subtitle: string;
  subtitleRomaji: string;
  artist: string;
  artistRomaji: string;
  playstyle: NormalizedChart['playstyle'];
  difficulty: NormalizedChart['difficulty'];
  meter: number;
  minBpm: number;
  maxBpm: number;
  totalSteps: number;
  totalRolls: number;
  totalHolds: number;
  totalMines: number;
  totalJumps: number;
  lengthSeconds: number;
  totalMeasures: number;
  totalBreakMeasures: number;
  totalStreamMeasures: number;
  totalTrueStreamMeasures: number;
  weightedNps: number;
  hasSignificantTimingChanges: boolean;
  bracketCount: number | null;
  halfCrossoverCount: number | null;
  fullCrossoverCount: number | null;
  crossoverCount: number | null;
  downFootswitchCount: number | null;
  upFootswitchCount: number | null;
  footswitchCount: number | null;
  doublestepCount: number | null;
  jackCount: number | null;
  sideswitchCount: number | null;
}): NormalizedChart {
  return { ...chart };
}

// The mapper/diff work with weightedNps as its raw thousandths-scaled Int (matches storage);
// anything sent to a client should be the true decimal, mirroring submissions.service.ts.
function toWireChart(chart: NormalizedChart | null): NormalizedChart | null {
  return chart ? { ...chart, weightedNps: chart.weightedNps / 1000 } : null;
}

function toSubmissionDetailFields(
  input: NormalizedSubmissionInput,
  techTagsById: ReadonlyMap<string, string>,
): SubmissionDetailFields {
  const {
    submitter,
    stepartist,
    pack,
    playstyle,
    difficulty,
    focus,
    derivedFocus,
    cmodPreference,
    releaseYear,
    theme,
    additionalNotes,
    consentToPublicReview,
    fileUrl,
    driveMd5,
    processingError,
    songDir,
    bannerSlug,
    isInternal,
    submittedAt,
    isIgnored,
  } = input;
  return {
    submitter,
    stepartist,
    pack,
    playstyle,
    difficulty,
    focus,
    derivedFocus,
    cmodPreference,
    releaseYear,
    theme,
    additionalNotes,
    consentToPublicReview,
    fileUrl,
    driveMd5,
    processingError,
    songDir,
    bannerSlug,
    isInternal,
    submittedAt,
    isIgnored,
    techTags: input.techTagIds.map((id) => techTagsById.get(id) ?? id).sort(),
    singleTechTag: input.singleTechTagId
      ? (techTagsById.get(input.singleTechTagId) ?? input.singleTechTagId)
      : null,
  };
}
