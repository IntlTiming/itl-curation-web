import type { SuggestionImportEntryDto } from './dto/suggestion-import-entry.dto.js';
import { CONSENT_MAP } from './submissions-import.mapper.js';
import type { NormalizedSuggestionInput } from './suggestions-import.types.js';

export type SuggestionMapResult =
  { ok: true; value: NormalizedSuggestionInput } | { ok: false; errors: string[] };

// `position` is the entry's 1-indexed position in the file's array - its identity.
export function mapSuggestionEntry(
  position: number,
  entry: SuggestionImportEntryDto,
): SuggestionMapResult {
  if (!(entry.consent in CONSENT_MAP)) {
    return {
      ok: false,
      errors: [`entry #${position}: unrecognized consent value ${JSON.stringify(entry.consent)}`],
    };
  }

  return {
    ok: true,
    value: {
      position,
      submittedAt: new Date(entry.timestamp_utc),
      submitter: entry.submitter,
      chart: entry.chart,
      reason: entry.reason,
      link: entry.link,
      consentToPublicReview: CONSENT_MAP[entry.consent],
    },
  };
}
