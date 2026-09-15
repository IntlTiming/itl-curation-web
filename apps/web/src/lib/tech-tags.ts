// Mirrors apps/api/src/events/tech-tags.seed-data.ts's TECH_TAG_SEED_DATA (label/category/code) -
// no shared package between frontend/backend in this repo, so this is a hand-synced copy; keep
// in sync with that file (and ultimately itl-online-2027-pack/scripts/models.py) if the tag
// vocabulary ever changes. Order preserved exactly as the backend seed list (BXF, then TECH,
// then NOTECH groups, in the pipeline's own checkbox order) - the Reviews page's Tech Tags
// filter groups by category but iterates each category's tags in this same order for a stable,
// predictable list instead of re-sorting alphabetically.
export type TechCategory = 'BXF' | 'TECH' | 'NOTECH';

export type TechTagDef = { code: string; label: string; category: TechCategory };

export const TECH_TAGS: TechTagDef[] = [
  { code: 'BR', label: 'Brackets (includes Bracket Taps)', category: 'BXF' },
  { code: 'XO', label: 'Crossovers', category: 'BXF' },
  { code: 'FS', label: 'Footswitches', category: 'BXF' },
  { code: 'JA', label: 'Jacks', category: 'TECH' },
  { code: 'SS', label: 'Sideswitches', category: 'TECH' },
  { code: 'Mine-DS', label: 'Doublesteps w/ Mines', category: 'TECH' },
  {
    code: 'Holds-Rolls',
    label: 'Holds/Rolls (Wadatsumis; Footswitching holds; Holdstream)',
    category: 'TECH',
  },
  { code: 'CT', label: 'Center-tech', category: 'TECH' },
  { code: 'MD', label: 'Mine dodge', category: 'TECH' },
  { code: 'KS', label: 'Kickswitches', category: 'TECH' },
  { code: 'BU', label: 'Bursts (includes Drills)', category: 'NOTECH' },
  { code: 'RH-SW', label: 'Rhythms (Swing)', category: 'NOTECH' },
  { code: 'RH-SK', label: 'Rhythms (Skittles)', category: 'NOTECH' },
  { code: 'SJ', label: 'Stepjumps', category: 'NOTECH' },
  { code: 'FL', label: 'Flams', category: 'NOTECH' },
  { code: 'Hold-DS', label: 'Doublesteps w/ Holds', category: 'NOTECH' },
  { code: 'ST', label: '(Doubles) Stretch', category: 'NOTECH' },
  { code: 'MV', label: '(Doubles) Movement', category: 'NOTECH' },
  { code: 'DUB-CT', label: '(Doubles) Center/Transitions', category: 'NOTECH' },
  { code: 'DUB-HD', label: '(Doubles) Half-Doubles', category: 'NOTECH' },
];

const TECH_TAG_CODE_BY_LABEL: Record<string, string> = Object.fromEntries(
  TECH_TAGS.map((t) => [t.label, t.code]),
);

export function shortenTechTag(label: string): string {
  return TECH_TAG_CODE_BY_LABEL[label] ?? label;
}

const TECH_TAG_INDEX_BY_LABEL: Record<string, number> = Object.fromEntries(
  TECH_TAGS.map((t, index) => [t.label, index]),
);

// Sorts a list of claimed tech tag labels into the same category-then-seed-list order as the
// filter popover (see TECH_TAGS's own comment) - the API returns them alphabetical-by-label
// instead (a stable order for its own purposes), so display call sites that want to match the
// popover re-sort with this rather than trusting the API's order. Unrecognized labels sort last,
// after every known tag.
export function sortTechTags(labels: string[]): string[] {
  return [...labels].sort(
    (a, b) =>
      (TECH_TAG_INDEX_BY_LABEL[a] ?? Number.MAX_SAFE_INTEGER) -
      (TECH_TAG_INDEX_BY_LABEL[b] ?? Number.MAX_SAFE_INTEGER),
  );
}
