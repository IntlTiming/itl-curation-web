import type { CmodPreference, ConsentToPublicReview, Difficulty, Playstyle } from '@prisma/client';
import type {
  SubmissionImportChartDto,
  SubmissionImportEntryDto,
} from './dto/submission-import-entry.dto.js';
import type { NormalizedChart, NormalizedSubmissionInput } from './import.types.js';

const PLAYSTYLE_MAP: Record<string, Playstyle> = { single: 'SINGLE', double: 'DOUBLE' };

const DIFFICULTY_MAP: Record<string, Difficulty> = {
  Beginner: 'BEGINNER',
  Easy: 'EASY',
  Medium: 'MEDIUM',
  Hard: 'HARD',
  Challenge: 'CHALLENGE',
};

const CMOD_MAP: Record<string, CmodPreference> = {
  'CMOD OKAY': 'CMOD_OKAY',
  'NO CMOD': 'NO_CMOD',
  'I am not the stepartist for this chart': 'NOT_STEPARTIST',
};

// "" means the form question was left unanswered - the schema comment on
// Submission.consentToPublicReview documents null as exactly that meaning.
const CONSENT_MAP: Record<string, ConsentToPublicReview | null> = {
  '': null,
  'Yes, I consent to my chart being reviewed in public': 'CONSENTS',
  'No, I do NOT consent to my chart being reviewed in public': 'DOES_NOT_CONSENT',
  'I am not the stepartist for this chart': 'NOT_STEPARTIST',
};

function mapEnum<T>(
  value: string,
  map: Record<string, T>,
  fieldLabel: string,
  key: string,
  errors: string[],
): T | undefined {
  if (!(value in map)) {
    errors.push(`fileId ${key}: unrecognized ${fieldLabel} value ${JSON.stringify(value)}`);
    return undefined;
  }
  return map[value];
}

function mapChart(
  key: string,
  chart: SubmissionImportChartDto,
  errors: string[],
): NormalizedChart | undefined {
  const playstyle = mapEnum(chart.playstyle, PLAYSTYLE_MAP, 'chart.playstyle', key, errors);
  const difficulty = mapEnum(chart.difficulty, DIFFICULTY_MAP, 'chart.difficulty', key, errors);
  if (playstyle === undefined || difficulty === undefined) return undefined;

  return {
    hash: chart.hash,
    title: chart.title,
    titleRomaji: chart.title_romaji,
    subtitle: chart.subtitle,
    subtitleRomaji: chart.subtitle_romaji,
    artist: chart.artist,
    artistRomaji: chart.artist_romaji,
    playstyle,
    difficulty,
    meter: chart.meter,
    minBpm: chart.min_bpm,
    maxBpm: chart.max_bpm,
    totalSteps: chart.total_steps,
    totalRolls: chart.total_rolls,
    totalHolds: chart.total_holds,
    totalMines: chart.total_mines,
    totalJumps: chart.total_jumps,
    lengthSeconds: chart.length_seconds,
    totalMeasures: chart.total_measures,
    totalBreakMeasures: chart.total_break_measures,
    totalStreamMeasures: chart.total_stream_measures,
    totalTrueStreamMeasures: chart.total_true_stream_measures,
    weightedNps: Math.round(chart.weighted_nps * 1000),
    hasSignificantTimingChanges: chart.disqualified,
    bracketCount: chart.bracket_count,
    halfCrossoverCount: chart.half_crossover_count,
    fullCrossoverCount: chart.full_crossover_count,
    crossoverCount: chart.crossover_count,
    downFootswitchCount: chart.down_footswitch_count,
    upFootswitchCount: chart.up_footswitch_count,
    footswitchCount: chart.footswitch_count,
    doublestepCount: chart.doublestep_count,
    jackCount: chart.jack_count,
    sideswitchCount: chart.sideswitch_count,
  };
}

export function mapSubmissionEntry(
  key: string,
  entry: SubmissionImportEntryDto,
  techTagsByLabel: ReadonlyMap<string, string>,
): { ok: true; value: NormalizedSubmissionInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (entry.file_id !== key) {
    errors.push(`fileId ${key}: entry's file_id "${entry.file_id}" does not match its own key`);
  }

  const playstyle = mapEnum(entry.playstyle, PLAYSTYLE_MAP, 'playstyle', key, errors);
  const difficulty = mapEnum(entry.difficulty, DIFFICULTY_MAP, 'difficulty', key, errors);
  const cmodPreference = mapEnum(entry.no_cmod, CMOD_MAP, 'no_cmod', key, errors);

  let consentToPublicReview: ConsentToPublicReview | null | undefined;
  if (entry.consents_to_public_review in CONSENT_MAP) {
    consentToPublicReview = CONSENT_MAP[entry.consents_to_public_review];
  } else {
    errors.push(
      `fileId ${key}: unrecognized consents_to_public_review value ${JSON.stringify(entry.consents_to_public_review)}`,
    );
  }

  const techTagIds: string[] = [];
  for (const label of entry.tech_represented) {
    const id = techTagsByLabel.get(label);
    if (id === undefined) {
      errors.push(`fileId ${key}: unknown tech_represented label ${JSON.stringify(label)}`);
    } else {
      techTagIds.push(id);
    }
  }

  let singleTechTagId: string | null | undefined;
  if (entry.tech_represented_single === '') {
    singleTechTagId = null;
  } else {
    const id = techTagsByLabel.get(entry.tech_represented_single);
    if (id === undefined) {
      errors.push(
        `fileId ${key}: unknown tech_represented_single label ${JSON.stringify(entry.tech_represented_single)}`,
      );
    } else {
      singleTechTagId = id;
    }
  }

  const chart = entry.chart === null ? null : mapChart(key, entry.chart, errors);

  const submittedAt = new Date(entry.timestamp_utc);
  if (Number.isNaN(submittedAt.getTime())) {
    errors.push(`fileId ${key}: invalid timestamp_utc ${JSON.stringify(entry.timestamp_utc)}`);
  }

  if (
    playstyle === undefined ||
    difficulty === undefined ||
    cmodPreference === undefined ||
    consentToPublicReview === undefined ||
    singleTechTagId === undefined ||
    chart === undefined ||
    errors.length > 0
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      fileId: entry.file_id,
      submitter: entry.submitter,
      stepartist: entry.stepartist,
      pack: entry.pack,
      playstyle,
      difficulty,
      focus: entry.focus,
      derivedFocus: entry.new_focus,
      cmodPreference,
      releaseYear: entry.year,
      theme: entry.theme,
      additionalNotes: entry.additional_notes,
      consentToPublicReview,
      fileUrl: entry.file_url,
      driveMd5: entry.file_md5,
      processingError: entry.status === 'Success' ? null : entry.status,
      songDir: entry.song_dir,
      bannerSlug: entry.banner_slug,
      isInternal: entry.is_internal,
      submittedAt,
      isIgnored: entry.is_ignored,
      techTagIds,
      singleTechTagId,
      chart,
    },
  };
}
