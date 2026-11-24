// The 8 fixed derived-focus buckets shown on the Selections tab, in stacking order from the
// BOTTOM of a column up (so "Other" sits on top) - also the left-to-right column order of the
// summary table, which mirrors the curators' "target tech distribution" spreadsheet.
export const FOCUS_BUCKETS = [
  { key: 'noTech', label: 'No Tech', colorVar: 'var(--focus-nt)' },
  { key: 'noTechOther', label: 'No Tech - Other', colorVar: 'var(--focus-nt-other)' },
  { key: 'singleTechXo', label: 'Single Tech - XO', colorVar: 'var(--focus-st-xo)' },
  { key: 'singleTechFs', label: 'Single Tech - FS', colorVar: 'var(--focus-st-fs)' },
  { key: 'singleTechBr', label: 'Single Tech - BR', colorVar: 'var(--focus-st-br)' },
  { key: 'singleTechOther', label: 'Single Tech - Other', colorVar: 'var(--focus-st-other)' },
  { key: 'multiTech', label: 'Multi Tech', colorVar: 'var(--focus-multi)' },
  { key: 'other', label: 'Other', colorVar: 'var(--focus-other)' },
] as const;

export type FocusBucketKey = (typeof FOCUS_BUCKETS)[number]['key'];

// Table column order, matching the reference spreadsheet: BR before XO before FS.
export const TABLE_BUCKET_ORDER: FocusBucketKey[] = [
  'noTech',
  'noTechOther',
  'singleTechBr',
  'singleTechXo',
  'singleTechFs',
  'singleTechOther',
  'multiTech',
  'other',
];

// Maps a raw Submission.derivedFocus value onto its bucket. The stored values are the long-form
// tech labels (e.g. "Single Tech - Brackets (includes Bracket Taps)"), so single-tech buckets
// match by prefix to tolerate wording tweaks between seasons. Anything unrecognized lands in
// "Other" rather than being dropped, so the totals always add up.
export function focusBucketOf(derivedFocus: string): FocusBucketKey {
  const value = derivedFocus.trim().toLowerCase();
  if (value === 'no tech') return 'noTech';
  if (value === 'no tech - other') return 'noTechOther';
  if (value === 'multi tech') return 'multiTech';
  if (value.startsWith('single tech - ')) {
    const tech = value.slice('single tech - '.length);
    if (tech.startsWith('bracket')) return 'singleTechBr';
    if (tech.startsWith('footswitch')) return 'singleTechFs';
    if (tech.startsWith('crossover')) return 'singleTechXo';
    return 'singleTechOther';
  }
  return 'other';
}
