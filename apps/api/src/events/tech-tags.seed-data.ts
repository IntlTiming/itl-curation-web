import type { TechCategory } from '@prisma/client';

// Labels + categories: itl-online-2027-pack/scripts/models.py (bxf_list / tech_list /
// notech_list, ~lines 15-25) - the pipeline's own "tech represented" checkbox vocabulary.
// Codes: this repo's REQUIREMENTS.md section 6, which reconciles a short code for all 20
// labels (including 2 new in the 2027 pack with no prior code anywhere else). There's no
// shared package or live channel between the two repos - re-sync by hand if models.py's
// lists ever change.
export const TECH_TAG_SEED_DATA: { label: string; category: TechCategory; code: string }[] = [
  { label: 'Brackets (includes Bracket Taps)', category: 'BXF', code: 'BR' },
  { label: 'Crossovers', category: 'BXF', code: 'XO' },
  { label: 'Footswitches', category: 'BXF', code: 'FS' },
  { label: 'Jacks', category: 'TECH', code: 'JA' },
  { label: 'Sideswitches', category: 'TECH', code: 'SS' },
  { label: 'Doublesteps w/ Mines', category: 'TECH', code: 'Mine-DS' },
  {
    label: 'Holds/Rolls (Wadatsumis; Footswitching holds; Holdstream)',
    category: 'TECH',
    code: 'Holds-Rolls',
  },
  { label: 'Center-tech', category: 'TECH', code: 'CT' },
  { label: 'Mine dodge', category: 'TECH', code: 'MD' },
  { label: 'Kickswitches', category: 'TECH', code: 'KS' },
  { label: 'Bursts (includes Drills)', category: 'NOTECH', code: 'BU' },
  { label: 'Rhythms (Swing)', category: 'NOTECH', code: 'RH-SW' },
  { label: 'Rhythms (Skittles)', category: 'NOTECH', code: 'RH-SK' },
  { label: 'Stepjumps', category: 'NOTECH', code: 'SJ' },
  { label: 'Flams', category: 'NOTECH', code: 'FL' },
  { label: 'Doublesteps w/ Holds', category: 'NOTECH', code: 'Hold-DS' },
  { label: '(Doubles) Stretch', category: 'NOTECH', code: 'ST' },
  { label: '(Doubles) Movement', category: 'NOTECH', code: 'MV' },
  { label: '(Doubles) Center/Transitions', category: 'NOTECH', code: 'DUB-CT' },
  { label: '(Doubles) Half-Doubles', category: 'NOTECH', code: 'DUB-HD' },
];
