import { describe, expect, it } from 'vitest';
import type { SuggestionImportEntryDto } from './dto/suggestion-import-entry.dto.js';
import { mapSuggestionEntry } from './suggestions-import.mapper.js';

// Shape copied from a real suggestions.json entry.
const ENTRY: SuggestionImportEntryDto = {
  timestamp_utc: '2026-09-07T17:57:32Z',
  submitter: 'zeskky',
  chart: "Odoru Ponpokorin SM7 (Ritz's Polaris) by Ritz",
  reason: 'Solid entry level 7 + catchy Ado song',
  link: '',
  consent: '',
};

describe('mapSuggestionEntry', () => {
  it('maps a raw entry, keeping position as its identity', () => {
    const result = mapSuggestionEntry(4, ENTRY);
    expect(result).toEqual({
      ok: true,
      value: {
        position: 4,
        submittedAt: new Date('2026-09-07T17:57:32Z'),
        submitter: 'zeskky',
        chart: "Odoru Ponpokorin SM7 (Ritz's Polaris) by Ritz",
        reason: 'Solid entry level 7 + catchy Ado song',
        link: '',
        consentToPublicReview: null,
      },
    });
  });

  it.each([
    ['', null],
    ['Yes, I consent to my chart being reviewed in public', 'CONSENTS'],
    ['No, I do NOT consent to my chart being reviewed in public', 'DOES_NOT_CONSENT'],
    ['I am not the stepartist for this chart', 'NOT_STEPARTIST'],
  ])('maps consent %j to %s', (consent, expected) => {
    const result = mapSuggestionEntry(1, { ...ENTRY, consent });
    expect(result.ok && result.value.consentToPublicReview).toBe(expected);
  });

  it('rejects an unrecognized consent value with the entry number', () => {
    const result = mapSuggestionEntry(7, { ...ENTRY, consent: 'maybe' });
    expect(result).toEqual({
      ok: false,
      errors: ['entry #7: unrecognized consent value "maybe"'],
    });
  });
});
