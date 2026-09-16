import { useId, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis, type LabelProps } from 'recharts';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Label } from '@/components/ui/label';
import type { CategoryCountRow } from '@/hooks/use-overview';
import { buildCategorySlots, type CategorySlot } from './category-colors';
import type { PlaystyleFilter } from './playstyle-filter';

// See coverage-bar-chart.tsx's own Legend for why this is hand-built rather than Recharts'
// <Legend> - Recharts computes its payload order internally and its type doesn't accept an
// order-overriding payload prop, so a legend driven by our own slot order is the only way to
// guarantee it matches the stacked bars' bottom-to-top order.
function Legend({ slots }: { slots: CategorySlot[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pt-3 text-xs">
      {slots.map((slot) => (
        <div key={slot.key} className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: slot.colorVar }}
          />
          <span className="text-muted-foreground">{slot.category}</span>
        </div>
      ))}
    </div>
  );
}

function scopeToFilter(rows: CategoryCountRow[], playstyleFilter: PlaystyleFilter) {
  return playstyleFilter === 'BOTH' ? rows : rows.filter((r) => r.playstyle === playstyleFilter);
}

// One uniform color, no legend - the category name is already the axis label here, so a rainbow
// of bar colors would just re-encode identity the axis already shows (see the dataviz skill's
// "never color nominal bars by their value" rule).
function RolledUpChart({ rows }: { rows: CategoryCountRow[] }) {
  const data = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of rows) totals.set(row.category, (totals.get(row.category) ?? 0) + row.count);
    return [...totals.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  const yAxisWidth = useMemo(
    () => Math.min(220, Math.max(80, Math.max(...data.map((d) => d.category.length), 0) * 6.5)),
    [data],
  );

  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">No data yet.</p>;
  }

  return (
    <ChartContainer
      config={{ count: { label: 'Submissions', color: 'var(--chart-1)' } }}
      className="aspect-auto w-full"
      style={{ height: Math.max(160, data.length * 32) }}
    >
      <BarChart data={data} layout="vertical" margin={{ right: 32 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} hide />
        <YAxis
          type="category"
          dataKey="category"
          tickLine={false}
          axisLine={false}
          width={yAxisWidth}
        />
        <ChartTooltip content={<ChartTooltipContent hideLabel className="min-w-56" />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={2}>
          <LabelList dataKey="count" position="right" className="fill-foreground" fontSize={11} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// Renders the total across every category at a given meter, above the topmost stacked segment -
// per-segment labels would be too dense with up to 8 categories, but a bare stack of color with
// no numbers at all would fail "labels so it's not purely visual comparison".
function makeStackTotalLabel(data: Record<string, number | string>[], keys: string[]) {
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

function PerMeterChart({ rows }: { rows: CategoryCountRow[] }) {
  const { slots, slotOf } = useMemo(() => buildCategorySlots(rows), [rows]);

  const data = useMemo(() => {
    const byMeter = new Map<number, Record<string, number> & { meter: number }>();
    for (const row of rows) {
      const entry = byMeter.get(row.meter) ?? { meter: row.meter };
      const slot = slotOf.get(row.category);
      if (slot) entry[slot.key] = (entry[slot.key] ?? 0) + row.count;
      byMeter.set(row.meter, entry);
    }
    return [...byMeter.values()].sort((a, b) => a.meter - b.meter);
  }, [rows, slotOf]);

  const config = useMemo(() => {
    const cfg: ChartConfig = {};
    for (const slot of slots) cfg[slot.key] = { label: slot.category, color: slot.colorVar };
    return cfg;
  }, [slots]);

  if (data.length === 0) {
    return <p className="text-muted-foreground text-sm">No data yet.</p>;
  }

  const topKey = slots[slots.length - 1]?.key;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">Submissions by meter</span>
      <ChartContainer config={config} className="aspect-auto h-80 w-full">
        <BarChart data={data} margin={{ top: 16 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="meter"
            tickLine={false}
            axisLine={false}
            label={{ value: 'Meter', position: 'insideBottom', offset: -4 }}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
          <ChartTooltip content={<ChartTooltipContent className="min-w-56" />} />
          {slots.map((slot) => (
            <Bar key={slot.key} dataKey={slot.key} stackId="a" fill={slot.colorVar}>
              {slot.key === topKey && (
                <LabelList
                  dataKey={slot.key}
                  content={makeStackTotalLabel(
                    data,
                    slots.map((s) => s.key),
                  )}
                />
              )}
            </Bar>
          ))}
        </BarChart>
      </ChartContainer>
      <Legend slots={slots} />
    </div>
  );
}

export function CategoryBreakdownChart({
  title,
  rows,
  playstyleFilter,
}: {
  title: string;
  rows: CategoryCountRow[];
  playstyleFilter: PlaystyleFilter;
}) {
  const [perMeter, setPerMeter] = useState(false);
  const checkboxId = useId();

  // Per-meter mode merges Single+Double onto one meter axis when "Both" is selected (summing
  // categories at each meter, same convention CoverageBarChart's own "Both" merge uses) rather
  // than scoping by playstyle first - so it only filters when a single playstyle is picked.
  const scoped =
    perMeter && playstyleFilter === 'BOTH' ? rows : scopeToFilter(rows, playstyleFilter);

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        <div className="flex items-center gap-2">
          <Checkbox
            id={checkboxId}
            checked={perMeter}
            onCheckedChange={(c) => setPerMeter(c === true)}
          />
          <Label htmlFor={checkboxId} className="text-sm font-normal">
            View per meter
          </Label>
        </div>
      </div>
      {perMeter ? <PerMeterChart rows={scoped} /> : <RolledUpChart rows={scoped} />}
    </div>
  );
}
