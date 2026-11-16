// Generic persisted-column-settings helpers, shared by every table with an "Edit columns"
// dialog (Reviews, Suggestions, ...).

// Reconciles a persisted column order against the current canonical key set: drops unknown/
// duplicate keys (e.g. a column renamed or removed in a later release) and inserts any keys
// missing from the stored value (a column added since the user last saved an order) at their
// canonical position, relative to whichever neighboring canonical columns the user already
// has - not always appended at the end. Without this, a stale localStorage value could silently
// hide a newly added column from the table entirely (rendering iterates the stored order, not
// the canonical one).
export function sanitizeOrder<K extends string>(order: K[], canonical: readonly K[]): K[] {
  const known = new Set<K>(canonical);
  const result = order.filter((key, index) => known.has(key) && order.indexOf(key) === index);

  for (const [canonicalIndex, key] of canonical.entries()) {
    if (result.includes(key)) continue;
    const precedingCanonical = canonical.slice(0, canonicalIndex).reverse();
    const anchor = precedingCanonical.find((candidate) => result.includes(candidate));
    const insertAt = anchor ? result.indexOf(anchor) + 1 : 0;
    result.splice(insertAt, 0, key);
  }

  return result;
}

// useLocalStorageState fully replaces the stored value rather than merging it with the default,
// so an object saved before a new key existed would have that key absent (reading as falsy /
// undefined). Merging the default in first - with the stored value's own keys still winning -
// keeps newly added keys at their intended default for existing users.
export function withDefaults<T extends object>(stored: T, defaults: T): T {
  return { ...defaults, ...stored };
}
