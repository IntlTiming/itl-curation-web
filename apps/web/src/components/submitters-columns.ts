// Shared column metadata for the Submitters table and its column-visibility settings dialog -
// same split as reviews-columns.ts, kept separate from both so neither has to import the other.

export type SubmittersColumnKey =
  'submitter' | 'lowers' | 'uppers' | 'doubles' | 'ignored' | 'errored';

export type SubmittersColumnVisibility = Record<SubmittersColumnKey, boolean>;

// The canonical key set and its default order - also the value new users (or a fresh browser
// profile) start with before ever reordering columns via the settings dialog.
export const SUBMITTERS_COLUMN_ORDER: SubmittersColumnKey[] = [
  'submitter',
  'lowers',
  'uppers',
  'doubles',
  'ignored',
  'errored',
];

// Same reconciliation as reviews-columns.ts's sanitizeColumnOrder - see its comment for why.
export function sanitizeSubmittersColumnOrder(order: SubmittersColumnKey[]): SubmittersColumnKey[] {
  const known = new Set<SubmittersColumnKey>(SUBMITTERS_COLUMN_ORDER);
  const deduped = order.filter((key, index) => known.has(key) && order.indexOf(key) === index);
  const missing = SUBMITTERS_COLUMN_ORDER.filter((key) => !deduped.includes(key));
  return [...deduped, ...missing];
}

// Same reconciliation as reviews-columns.ts's sanitizeColumnVisibility - see its comment for why.
export function sanitizeSubmittersColumnVisibility(
  visibility: SubmittersColumnVisibility,
): SubmittersColumnVisibility {
  return { ...DEFAULT_SUBMITTERS_COLUMN_VISIBILITY, ...visibility };
}

export const SUBMITTERS_COLUMN_LABELS: Record<SubmittersColumnKey, string> = {
  submitter: 'Submitter',
  lowers: '# Lowers',
  uppers: '# Uppers',
  doubles: '# Double',
  ignored: '# Ignored',
  errored: '# Errored',
};

// Submitter is the table's forced-visible identity column - a curator can't hide it, unlike
// every other column here.
export const FORCED_VISIBLE_SUBMITTERS_COLUMNS: SubmittersColumnKey[] = ['submitter'];

export const DEFAULT_SUBMITTERS_COLUMN_VISIBILITY: SubmittersColumnVisibility = {
  submitter: true,
  lowers: true,
  uppers: true,
  doubles: true,
  ignored: true,
  errored: true,
};

export const SUBMITTERS_COLUMN_STORAGE_KEY = 'itl-submitters-columns';
export const SUBMITTERS_COLUMN_ORDER_STORAGE_KEY = 'itl-submitters-column-order';
export const SUBMITTERS_SORT_STORAGE_KEY = 'itl-submitters-sort';
