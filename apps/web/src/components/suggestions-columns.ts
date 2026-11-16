// Column metadata for the Suggestions table and its column settings dialog - same split as
// reviews-columns.ts.

import { sanitizeOrder, withDefaults } from '@/lib/column-settings';

export type SuggestionsColumnKey =
  | 'position'
  | 'addEdit'
  | 'chart'
  | 'reason'
  | 'link'
  | 'submitter'
  | 'submittedAt'
  | 'linked'
  | 'reviewCount'
  | 'avgRating'
  | 'minRating'
  | 'maxRating'
  | 'stdevRating'
  | 'commentCount'
  | 'lastActivity';

export type SuggestionsColumnVisibility = Record<SuggestionsColumnKey, boolean>;

export const SUGGESTIONS_COLUMN_ORDER: SuggestionsColumnKey[] = [
  'position',
  'addEdit',
  'chart',
  'reason',
  'submitter',
  'link',
  'submittedAt',
  'linked',
  'reviewCount',
  'avgRating',
  'minRating',
  'maxRating',
  'stdevRating',
  'commentCount',
  'lastActivity',
];

export const SUGGESTIONS_COLUMN_LABELS: Record<SuggestionsColumnKey, string> = {
  position: '#',
  addEdit: 'Add/Edit',
  chart: 'Chart',
  reason: 'Reason',
  link: 'Link',
  submitter: 'Submitter',
  submittedAt: 'Submitted',
  linked: 'Linked submission',
  reviewCount: '# reviews',
  avgRating: 'Avg. rating',
  minRating: 'Min. rating',
  maxRating: 'Max rating',
  stdevRating: 'Stdev rating',
  commentCount: '# comments',
  lastActivity: 'Last activity',
};

// Chart is the row's identity - the only column a curator can't hide.
export const FORCED_VISIBLE_SUGGESTIONS_COLUMNS: SuggestionsColumnKey[] = ['chart'];

export const DEFAULT_SUGGESTIONS_COLUMN_VISIBILITY: SuggestionsColumnVisibility = {
  position: true,
  addEdit: true,
  chart: true,
  reason: true,
  link: true,
  submitter: true,
  submittedAt: true,
  linked: true,
  reviewCount: true,
  avgRating: true,
  minRating: false,
  maxRating: false,
  stdevRating: false,
  commentCount: true,
  lastActivity: true,
};

export function sanitizeSuggestionsColumnOrder(
  order: SuggestionsColumnKey[],
): SuggestionsColumnKey[] {
  return sanitizeOrder(order, SUGGESTIONS_COLUMN_ORDER);
}

export function sanitizeSuggestionsColumnVisibility(
  visibility: SuggestionsColumnVisibility,
): SuggestionsColumnVisibility {
  return withDefaults(visibility, DEFAULT_SUGGESTIONS_COLUMN_VISIBILITY);
}

export const SUGGESTIONS_COLUMN_STORAGE_KEY = 'itl-suggestions-columns';
export const SUGGESTIONS_COLUMN_ORDER_STORAGE_KEY = 'itl-suggestions-column-order';
