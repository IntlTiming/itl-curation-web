// Fixed-order 8-slot categorical palette, matching the 8 --chart-N CSS variables in index.css.
// Never assign more than 8 real slots and never reorder them per-chart - order is the
// colorblind-safety mechanism (see the dataviz skill's palette reference), so a category that
// gets slot 3 keeps slot 3 everywhere it appears, and a filter that changes which categories are
// visible must not repaint the survivors.
const MAX_SLOTS = 8;
export const OTHER_CATEGORY = 'Other';

export type CategorySlot = { category: string; key: string; colorVar: string };

// Deterministic, filter-independent key so recharts' dataKey/ChartConfig never see raw category
// strings (which can contain spaces, dashes, etc.) - stable across renders since it's derived
// from the slot index, not from any Math.random()/useId() call.
function slotKey(index: number): string {
  return `cat${index}`;
}

// Ranks every category by its total count across ALL rows (every playstyle, every meter) -
// deliberately NOT scoped to the currently-selected playstyle filter, so a category's color slot
// stays fixed no matter what the viewer has filtered to. Categories beyond the top 7 fold into a
// single "Other" slot (the 8th) rather than a 9th+ generated hue.
export function buildCategorySlots(rows: { category: string; count: number }[]): {
  slots: CategorySlot[];
  slotOf: Map<string, CategorySlot>;
} {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.category, (totals.get(row.category) ?? 0) + row.count);
  }

  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const kept = ranked.length > MAX_SLOTS ? ranked.slice(0, MAX_SLOTS - 1) : ranked;
  const overflowed = ranked.length > MAX_SLOTS ? ranked.slice(MAX_SLOTS - 1) : [];

  const categoryNames = kept.map(([category]) => category);
  if (overflowed.length > 0) categoryNames.push(OTHER_CATEGORY);

  // References the global --chart-N token directly (not the shadcn chart wrapper's scoped
  // --color-KEY indirection) so the same color value works both for the bar fill inside the
  // chart and for the custom legend rendered outside it - see coverage-bar-chart.tsx's own
  // legend for why the scoped indirection isn't usable there.
  const slots = categoryNames.map((category, i) => ({
    category,
    key: slotKey(i),
    colorVar: `var(--chart-${i + 1})`,
  }));

  const slotOf = new Map<string, CategorySlot>();
  for (const [i, [category]] of kept.entries()) slotOf.set(category, slots[i]);
  const otherSlot = slots[slots.length - 1];
  for (const [category] of overflowed) slotOf.set(category, otherSlot);

  return { slots, slotOf };
}
