import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForEvent(eventId: string) {
    const rows = await this.prisma.submission.findMany({
      where: { eventId },
      include: { chart: true, techTags: { include: { techTag: true } }, singleTechTag: true },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => ({
      fileId: row.fileId,
      stepartist: row.stepartist,
      submitter: row.submitter,
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
      songDir: row.songDir,
      bannerSlug: row.bannerSlug,
      isInternal: row.isInternal,
      isIgnored: row.isIgnored,
      submittedAt: row.submittedAt,
      processingError: row.processingError,
      techTags: row.techTags.map((t) => t.techTag.label),
      singleTechTag: row.singleTechTag?.label ?? null,
      chart: row.chart && {
        hash: row.chart.hash,
        title: row.chart.title,
        titleRomaji: row.chart.titleRomaji,
        subtitle: row.chart.subtitle,
        subtitleRomaji: row.chart.subtitleRomaji,
        artist: row.chart.artist,
        artistRomaji: row.chart.artistRomaji,
        playstyle: row.chart.playstyle,
        difficulty: row.chart.difficulty,
        meter: row.chart.meter,
        minBpm: row.chart.minBpm,
        maxBpm: row.chart.maxBpm,
        totalSteps: row.chart.totalSteps,
        totalRolls: row.chart.totalRolls,
        totalHolds: row.chart.totalHolds,
        totalMines: row.chart.totalMines,
        totalJumps: row.chart.totalJumps,
        lengthSeconds: row.chart.lengthSeconds,
        totalMeasures: row.chart.totalMeasures,
        totalBreakMeasures: row.chart.totalBreakMeasures,
        totalStreamMeasures: row.chart.totalStreamMeasures,
        totalTrueStreamMeasures: row.chart.totalTrueStreamMeasures,
        weightedNps: row.chart.weightedNps / 1000,
        hasSignificantTimingChanges: row.chart.hasSignificantTimingChanges,
        bracketCount: row.chart.bracketCount,
        halfCrossoverCount: row.chart.halfCrossoverCount,
        fullCrossoverCount: row.chart.fullCrossoverCount,
        crossoverCount: row.chart.crossoverCount,
        downFootswitchCount: row.chart.downFootswitchCount,
        upFootswitchCount: row.chart.upFootswitchCount,
        footswitchCount: row.chart.footswitchCount,
        doublestepCount: row.chart.doublestepCount,
        jackCount: row.chart.jackCount,
        sideswitchCount: row.chart.sideswitchCount,
      },
    }));
  }
}
