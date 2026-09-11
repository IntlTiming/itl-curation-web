import { describe, expect, it } from 'vitest';
import type {
  SubmissionImportChartDto,
  SubmissionImportEntryDto,
} from './dto/submission-import-entry.dto.js';
import { mapSubmissionEntry } from './submissions-import.mapper.js';

const TECH_TAGS = new Map<string, string>([
  ['Crossovers', 'tag-xo'],
  ['Doublesteps w/ Mines', 'tag-mine-ds'],
  ['Rhythms (Swing)', 'tag-rh-sw'],
  ['(Doubles) Stretch', 'tag-st'],
]);

const BASE_CHART: SubmissionImportChartDto = {
  hash: '6af4c7461e31e600',
  title: 'MIRROR',
  title_romaji: '',
  subtitle: '',
  subtitle_romaji: '',
  artist: 'Ado',
  artist_romaji: '',
  playstyle: 'double',
  difficulty: 'Challenge',
  meter: 10,
  min_bpm: 114,
  max_bpm: 114,
  total_steps: 551,
  total_rolls: 1,
  total_holds: 76,
  total_mines: 24,
  total_jumps: 11,
  length_seconds: 132,
  total_measures: 64,
  total_break_measures: 63,
  total_stream_measures: 1,
  total_true_stream_measures: 0,
  weighted_nps: 0.0,
  disqualified: true,
  bracket_count: 2,
  half_crossover_count: 3,
  full_crossover_count: 13,
  crossover_count: 16,
  down_footswitch_count: 0,
  up_footswitch_count: 0,
  footswitch_count: 0,
  doublestep_count: 21,
  jack_count: 3,
  sideswitch_count: 1,
};

const BASE_ENTRY: SubmissionImportEntryDto = {
  file_id: '10VmBna3qgXuy49ETGNoosi_m4VAqAmyw',
  status: 'Success',
  song_dir: 'Single/MIRROR [10VmBna3qgXuy49ETGNoosi_m4VAqAmyw]',
  stepartist: 'Lilly',
  submitter: 'lemone',
  pack: 'Single',
  playstyle: 'double',
  difficulty: 'Challenge',
  no_cmod: 'NO CMOD',
  focus: 'Tech/Timing - single tech',
  tech_represented: ['Crossovers', 'Doublesteps w/ Mines', 'Rhythms (Swing)', '(Doubles) Stretch'],
  tech_represented_single: 'Doublesteps w/ Mines',
  new_focus: 'Multi Tech',
  additional_notes: 'I think the DS gimmick is nice :)',
  consents_to_public_review: 'No, I do NOT consent to my chart being reviewed in public',
  year: '',
  theme: 'Summer of Doubles 2026',
  file_url: 'https://drive.google.com/open?id=10VmBna3qgXuy49ETGNoosi_m4VAqAmyw',
  file_md5: '027a095eedf17659d92d6060029a3d19',
  banner_slug: 'ea2453ad5b8cb2122640669d44858cc3',
  is_internal: false,
  timestamp_utc: '2026-09-07T16:35:06Z',
  is_ignored: false,
  chart: BASE_CHART,
};

describe('mapSubmissionEntry', () => {
  it('maps the real sample entry end to end', () => {
    const result = mapSubmissionEntry(BASE_ENTRY.file_id, BASE_ENTRY, TECH_TAGS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toMatchObject({
      fileId: '10VmBna3qgXuy49ETGNoosi_m4VAqAmyw',
      playstyle: 'DOUBLE',
      difficulty: 'CHALLENGE',
      cmodPreference: 'NO_CMOD',
      consentToPublicReview: 'DOES_NOT_CONSENT',
      processingError: null,
      singleTechTagId: 'tag-mine-ds',
      derivedFocus: 'Multi Tech',
      isIgnored: false,
    });
    expect(result.value.submittedAt).toEqual(new Date('2026-09-07T16:35:06Z'));
    expect(result.value.techTagIds.sort()).toEqual(
      ['tag-xo', 'tag-mine-ds', 'tag-rh-sw', 'tag-st'].sort(),
    );
    expect(result.value.chart).toMatchObject({
      hash: '6af4c7461e31e600',
      playstyle: 'DOUBLE',
      difficulty: 'CHALLENGE',
      hasSignificantTimingChanges: true,
      weightedNps: 0,
    });
  });

  it('maps a non-"Success" status to processingError, not null', () => {
    const entry = {
      ...BASE_ENTRY,
      status: 'Error: Could not find single Easy chart.',
      chart: null,
    };
    const result = mapSubmissionEntry(entry.file_id, entry, TECH_TAGS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.processingError).toBe('Error: Could not find single Easy chart.');
    expect(result.value.chart).toBeNull();
  });

  it('maps "" tech_represented_single to null', () => {
    const entry = { ...BASE_ENTRY, tech_represented_single: '' };
    const result = mapSubmissionEntry(entry.file_id, entry, TECH_TAGS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.singleTechTagId).toBeNull();
  });

  it('maps "" consents_to_public_review to null (left unanswered)', () => {
    const entry = { ...BASE_ENTRY, consents_to_public_review: '' };
    const result = mapSubmissionEntry(entry.file_id, entry, TECH_TAGS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.consentToPublicReview).toBeNull();
  });

  it('scales weighted_nps to a thousandths Int with correct rounding', () => {
    const entry = { ...BASE_ENTRY, chart: { ...BASE_CHART, weighted_nps: 8.6666 } };
    const result = mapSubmissionEntry(entry.file_id, entry, TECH_TAGS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.chart?.weightedNps).toBe(8667);
  });

  it('maps is_ignored straight through', () => {
    const entry = { ...BASE_ENTRY, is_ignored: true };
    const result = mapSubmissionEntry(entry.file_id, entry, TECH_TAGS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isIgnored).toBe(true);
  });

  it('rejects an entry with an unparseable timestamp_utc', () => {
    const entry = { ...BASE_ENTRY, timestamp_utc: 'not-a-date' };
    const result = mapSubmissionEntry(entry.file_id, entry, TECH_TAGS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('timestamp_utc'))).toBe(true);
  });

  it('rejects an entry whose file_id does not match its own key', () => {
    const result = mapSubmissionEntry('some-other-key', BASE_ENTRY, TECH_TAGS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/does not match its own key/);
  });

  it('collects an error for an unresolved tech_represented_single label', () => {
    const entry = { ...BASE_ENTRY, tech_represented_single: 'Not A Real Tag' };
    const result = mapSubmissionEntry(entry.file_id, entry, TECH_TAGS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('Not A Real Tag'))).toBe(true);
  });

  it('collects multiple simultaneous errors on one entry rather than stopping at the first', () => {
    const entry = {
      ...BASE_ENTRY,
      playstyle: 'triples',
      difficulty: 'Impossible',
      tech_represented: ['Not A Real Tag'],
    };
    const result = mapSubmissionEntry(entry.file_id, entry, TECH_TAGS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
