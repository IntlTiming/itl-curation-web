// Shared column metadata for the Reviews table and its column-visibility settings dialog -
// kept separate from both so neither has to import the other.

import { sanitizeOrder, withDefaults } from '@/lib/column-settings';

export type ReviewsColumnKey =
  | 'rowNumber'
  | 'addEdit'
  | 'meter'
  | 'title'
  | 'pack'
  | 'stepartist'
  | 'submitter'
  | 'techTags'
  | 'reviewCount'
  | 'avgRating'
  | 'minRating'
  | 'maxRating'
  | 'stdevRating'
  | 'commentCount'
  | 'lastActivity';

export type ReviewsColumnVisibility = Record<ReviewsColumnKey, boolean>;

// The canonical key set and its default order - also the value new users (or a fresh browser
// profile) start with before ever reordering columns via the settings dialog.
export const REVIEWS_COLUMN_ORDER: ReviewsColumnKey[] = [
  'rowNumber',
  'addEdit',
  'meter',
  'title',
  'pack',
  'stepartist',
  'submitter',
  'techTags',
  'reviewCount',
  'avgRating',
  'minRating',
  'maxRating',
  'stdevRating',
  'commentCount',
  'lastActivity',
];

// See lib/column-settings.ts for why both of these exist.
export function sanitizeColumnOrder(order: ReviewsColumnKey[]): ReviewsColumnKey[] {
  return sanitizeOrder(order, REVIEWS_COLUMN_ORDER);
}

export function sanitizeColumnVisibility(
  visibility: ReviewsColumnVisibility,
): ReviewsColumnVisibility {
  return withDefaults(visibility, DEFAULT_REVIEWS_COLUMN_VISIBILITY);
}

export const REVIEWS_COLUMN_LABELS: Record<ReviewsColumnKey, string> = {
  rowNumber: '#',
  addEdit: 'Add/Edit',
  meter: 'Meter',
  title: 'Title',
  pack: 'Pack',
  stepartist: 'Stepartist',
  submitter: 'Submitter',
  techTags: 'Tech Tags',
  reviewCount: '# reviews',
  avgRating: 'Avg. rating',
  minRating: 'Min. rating',
  maxRating: 'Max rating',
  stdevRating: 'Stdev rating',
  commentCount: '# comments',
  lastActivity: 'Last activity',
};

// Meter and Title are the table's forced-visible identity columns - a curator can't hide
// them, unlike every other column here.
export const FORCED_VISIBLE_REVIEWS_COLUMNS: ReviewsColumnKey[] = ['meter', 'title'];

export const DEFAULT_REVIEWS_COLUMN_VISIBILITY: ReviewsColumnVisibility = {
  rowNumber: true,
  addEdit: true,
  meter: true,
  title: true,
  pack: true,
  stepartist: true,
  submitter: true,
  techTags: false,
  reviewCount: true,
  avgRating: true,
  minRating: false,
  maxRating: false,
  stdevRating: false,
  commentCount: false,
  lastActivity: true,
};

export const REVIEWS_COLUMN_STORAGE_KEY = 'itl-reviews-columns';
export const REVIEWS_COLUMN_ORDER_STORAGE_KEY = 'itl-reviews-column-order';
