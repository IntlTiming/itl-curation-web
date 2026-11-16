import type { ConsentToPublicReview } from '@prisma/client';
import type { FieldChange } from './import.types.js';

// The mapper's normalized shape for one suggestions.json entry. `position` is the entry's
// 1-indexed position in the file's array - the suggestion's identity.
export type NormalizedSuggestionInput = {
  position: number;
  submittedAt: Date;
  submitter: string;
  chart: string;
  reason: string;
  link: string;
  consentToPublicReview: ConsentToPublicReview | null;
};

export type SuggestionUpdate = {
  input: NormalizedSuggestionInput;
  previous: NormalizedSuggestionInput;
  changedFields: FieldChange[];
};

export type SuggestionImportDiff = {
  summary: {
    totalInFile: number;
    totalExistingInDb: number;
    toInsert: number;
    toUpdate: number;
    unchanged: number;
  };
  inserts: NormalizedSuggestionInput[];
  updates: SuggestionUpdate[];
};

export type SuggestionImportPreviewResponse = {
  ok: true;
  summary: SuggestionImportDiff['summary'];
  inserts: NormalizedSuggestionInput[];
  updates: (NormalizedSuggestionInput & {
    previous: NormalizedSuggestionInput;
    changedFields: FieldChange[];
  })[];
};

export type SuggestionImportApplyResponse = {
  ok: true;
  result: {
    inserted: number;
    updated: number;
    unchanged: number;
  };
};
