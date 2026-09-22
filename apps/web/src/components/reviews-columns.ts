// Shared column metadata for the Reviews table and its column-visibility settings dialog -
// kept separate from both so neither has to import the other.

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

// Reconciles a persisted column order against the current canonical key set: drops unknown/
// duplicate keys (e.g. a column renamed or removed in a later release) and inserts any keys
// missing from the stored value (a column added since the user last saved an order) at their
// canonical position, relative to whichever neighboring canonical columns the user already
// has - not always appended at the end - so e.g. `#` (canonically first) lands at the front
// for an existing user's saved order, not after their last column. Without this, a stale
// localStorage value could silently hide a newly added column from the table entirely
// (nothing would ever render it, since rendering iterates the stored order, not the canonical
// one).
export function sanitizeColumnOrder(order: ReviewsColumnKey[]): ReviewsColumnKey[] {
  const known = new Set<ReviewsColumnKey>(REVIEWS_COLUMN_ORDER);
  const result = order.filter((key, index) => known.has(key) && order.indexOf(key) === index);

  for (const [canonicalIndex, key] of REVIEWS_COLUMN_ORDER.entries()) {
    if (result.includes(key)) continue;
    const precedingCanonical = REVIEWS_COLUMN_ORDER.slice(0, canonicalIndex).reverse();
    const anchor = precedingCanonical.find((candidate) => result.includes(candidate));
    const insertAt = anchor ? result.indexOf(anchor) + 1 : 0;
    result.splice(insertAt, 0, key);
  }

  return result;
}

// Same idea as sanitizeColumnOrder, but for visibility: useLocalStorageState fully replaces
// the stored value rather than merging it with the default, so a visibility object saved
// before a new column existed would have that key simply absent - which reads as falsy
// (hidden) when the table looks it up, regardless of the column's own intended default.
// Merging the default in first (so the stored value's own keys still win) keeps a newly
// added column's default visibility intact for existing users.
export function sanitizeColumnVisibility(
  visibility: ReviewsColumnVisibility,
): ReviewsColumnVisibility {
  return { ...DEFAULT_REVIEWS_COLUMN_VISIBILITY, ...visibility };
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
