import type { FieldChange } from './import.types.js';
import type {
  NormalizedSuggestionInput,
  SuggestionImportDiff,
} from './suggestions-import.types.js';

// submittedAt is compared by value separately below - !== on two Date objects is always true.
const SIMPLE_FIELDS = [
  'submitter',
  'chart',
  'reason',
  'link',
  'consentToPublicReview',
] as const satisfies readonly (keyof NormalizedSuggestionInput)[];

// suggestions.json is append-only - entries are never removed or reordered - so every
// position is either new (insert) or the same suggestion it was before (update/unchanged).
export function computeSuggestionDiff(
  existing: NormalizedSuggestionInput[],
  incoming: NormalizedSuggestionInput[],
): SuggestionImportDiff {
  const existingByPosition = new Map(existing.map((row) => [row.position, row]));

  const diff: SuggestionImportDiff = {
    summary: {
      totalInFile: incoming.length,
      totalExistingInDb: existing.length,
      toInsert: 0,
      toUpdate: 0,
      unchanged: 0,
    },
    inserts: [],
    updates: [],
  };

  for (const input of incoming) {
    const prior = existingByPosition.get(input.position);
    if (!prior) {
      diff.inserts.push(input);
      diff.summary.toInsert += 1;
      continue;
    }

    const changedFields: FieldChange[] = [];
    for (const field of SIMPLE_FIELDS) {
      if (prior[field] !== input[field]) {
        changedFields.push({ field, from: prior[field], to: input[field] });
      }
    }
    if (prior.submittedAt.getTime() !== input.submittedAt.getTime()) {
      changedFields.push({
        field: 'submittedAt',
        from: prior.submittedAt.toISOString(),
        to: input.submittedAt.toISOString(),
      });
    }

    if (changedFields.length === 0) {
      diff.summary.unchanged += 1;
      continue;
    }
    diff.updates.push({ input, previous: prior, changedFields });
    diff.summary.toUpdate += 1;
  }

  return diff;
}
