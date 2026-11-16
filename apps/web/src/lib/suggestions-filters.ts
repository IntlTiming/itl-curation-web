import type { SuggestionRow } from '@/hooks/use-suggestions';

export type SuggestionsLinkFilter = 'all' | 'unlinked' | 'linked';
export type SuggestionsFlagFilter = 'all' | 'none' | 'warning' | 'disqualified';

export type SuggestionsFilters = {
  search: string;
  linkStatus: SuggestionsLinkFilter;
  flags: SuggestionsFlagFilter;
  minReviewCount: number | null;
  maxReviewCount: number | null;
  unreviewedByMeOnly: boolean;
  publiclyReviewableOnly: boolean;
};

export const DEFAULT_SUGGESTIONS_FILTERS: SuggestionsFilters = {
  search: '',
  linkStatus: 'all',
  flags: 'all',
  minReviewCount: null,
  maxReviewCount: null,
  unreviewedByMeOnly: false,
  publiclyReviewableOnly: false,
};

export function isDefaultSuggestionsFilters(filters: SuggestionsFilters): boolean {
  return (Object.keys(DEFAULT_SUGGESTIONS_FILTERS) as (keyof SuggestionsFilters)[]).every(
    (key) => filters[key] === DEFAULT_SUGGESTIONS_FILTERS[key],
  );
}

// Everything is filtered client-side - the whole list (~100 rows) is already loaded.
export function matchesSuggestionsFilters(row: SuggestionRow, filters: SuggestionsFilters) {
  const term = filters.search.trim().toLowerCase();
  if (term && ![row.chart, row.submitter, row.reason].some((f) => f.toLowerCase().includes(term))) {
    return false;
  }
  if (filters.linkStatus === 'linked' && !row.linkedSubmission) return false;
  if (filters.linkStatus === 'unlinked' && row.linkedSubmission) return false;
  if (filters.flags === 'none' && row.basicChecks.length > 0) return false;
  if (filters.flags === 'warning' && !row.hasWarning) return false;
  if (filters.flags === 'disqualified' && !row.hasDisqualification) return false;
  if (filters.minReviewCount !== null && row.reviewCount < filters.minReviewCount) return false;
  if (filters.maxReviewCount !== null && row.reviewCount > filters.maxReviewCount) return false;
  if (filters.unreviewedByMeOnly && row.hasOwnReview) return false;
  if (filters.publiclyReviewableOnly && row.consentToPublicReview !== 'CONSENTS') return false;
  return true;
}
