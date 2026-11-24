import type { LabelProps } from 'recharts';

// Renders the total across every category at a given meter, above the topmost stacked segment -
// per-segment labels would be too dense with up to 8 categories, but a bare stack of color with
// no numbers at all would fail "labels so it's not purely visual comparison".
export function makeStackTotalLabel(data: Record<string, number | string>[], keys: string[]) {
  return function StackTotalLabel(props: LabelProps) {
    const { x, y, width, index } = props;
    if (typeof index !== 'number' || typeof x !== 'number' || typeof width !== 'number') {
      return null;
    }
    // See coverage-bar-chart.tsx's makeReviewedLabel for why this guard is needed - Recharts can
    // invoke a label's content callback mid-transition with an index from the outgoing bar set.
    const row = data[index];
    if (!row) return null;
    const total = keys.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
    return (
      <text
        x={x + width / 2}
        y={Number(y) - 6}
        textAnchor="middle"
        fontSize={11}
        className="fill-foreground"
      >
        {total}
      </text>
    );
  };
}
