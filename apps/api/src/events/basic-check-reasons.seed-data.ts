import type { BasicCheckLevel } from '@prisma/client';

// Starter set of event-scoped basic check reasons, seeded fresh onto every new event (unlike
// TECH_TAG_SEED_DATA, which is global and upserted once). Reviewers invent new failure classes
// mid-season, so these are just a starting point - admins can add/deactivate rows per event
// afterward (no management UI yet; use Prisma Studio).
export const BASIC_CHECK_REASON_SEED_DATA: {
  code: string;
  label: string;
  description: string;
  level: BasicCheckLevel;
}[] = [
  {
    code: 'UNAUTHORIZED',
    label: 'Unauthorized',
    level: 'DISQUALIFIED',
    description:
      'Song is not cleared to be charted in other games (including but not limited to Arcaea, NOISZ)',
  },
  {
    code: 'SONG_USED_BEFORE',
    label: 'Song used before',
    level: 'DISQUALIFIED',
    description: 'Song has been used in the last 3 years',
  },
  {
    code: 'CHART_USED_BEFORE',
    label: 'Chart used before',
    level: 'DISQUALIFIED',
    description: 'Chart has been used in the last 5 years',
  },
  {
    code: 'AMBIGUITY',
    label: 'Ambiguity',
    level: 'DISQUALIFIED',
    description:
      'Chart has an ambiguous start (unresolved up/down, forced bracket), or an unintended doublestep that does not reasonably resolve.',
  },
  {
    code: 'BEAT_0',
    label: 'Beat 0',
    level: 'WARNING',
    description: 'Chart starts before tempo is discernable from the audio.',
  },
  {
    code: 'PROFANITY',
    label: 'Profanity',
    level: 'WARNING',
    description: 'Song contains language that may be considered explicit.',
  },
];
