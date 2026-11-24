import { useId, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { Loading } from '@/components/loading';
import { makeStackTotalLabel } from '@/components/overview/stack-total-label';
import {
  FOCUS_BUCKETS,
  focusBucketOf,
  TABLE_BUCKET_ORDER,
  type FocusBucketKey,
} from '@/components/selections/focus-buckets';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Playstyle } from '@/hooks/use-overview';
import { useSelectionsSummary, type SelectionSummaryRow } from '@/hooks/use-selections-summary';

const PLAYSTYLE_OPTIONS: { value: Playstyle; label: string }[] = [
  { value: 'SINGLE', label: 'Single' },
  { value: 'DOUBLE', label: 'Double' },
];

const BUCKET_KEYS = FOCUS_BUCKETS.map((bucket) => bucket.key);
const BUCKET_BY_KEY = new Map(FOCUS_BUCKETS.map((bucket) => [bucket.key, bucket]));

type MeterRow = { meter: number; total: number } & Record<FocusBucketKey, number>;

function emptyMeterRow(meter: number): MeterRow {
  const row = { meter, total: 0 } as MeterRow;
  for (const key of BUCKET_KEYS) row[key] = 0;
  return row;
}

// One row per meter from the lowest to the highest selected meter. Gaps are filled with zero rows
// so the chart's x-axis and the table read as a continuous difficulty range, like the reference
// spreadsheet.
function buildMeterRows(rows: SelectionSummaryRow[], playstyle: Playstyle): MeterRow[] {
  const scoped = rows.filter((row) => row.playstyle === playstyle);
  if (scoped.length === 0) return [];
  const meters = scoped.map((row) => row.meter);
  const min = Math.min(...meters);
  const max = Math.max(...meters);
  const byMeter = new Map<number, MeterRow>();
  for (let meter = min; meter <= max; meter++) byMeter.set(meter, emptyMeterRow(meter));
  for (const row of scoped) {
    const entry = byMeter.get(row.meter)!;
    entry[focusBucketOf(row.derivedFocus)] += row.count;
    entry.total += row.count;
  }
  return [...byMeter.values()];
}

// Listed top to bottom in the same order the segments stack visually (Other on top), so the
// legend reads like the column it describes. Hand-built for the same reason as
// category-breakdown-chart.tsx's Legend: Recharts' own legend can't be given a fixed order.
function Legend() {
  return (
    <div className="flex flex-row flex-wrap gap-x-4 gap-y-1.5 text-xs lg:flex-col">
      {[...FOCUS_BUCKETS].reverse().map((bucket) => (
        <div key={bucket.key} className="flex items-center gap-1.5">
          <div
            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: bucket.colorVar }}
          />
          <span className="text-muted-foreground">{bucket.label}</span>
        </div>
      ))}
    </div>
  );
}

const CHART_CONFIG: ChartConfig = Object.fromEntries(
  FOCUS_BUCKETS.map((bucket) => [bucket.key, { label: bucket.label, color: bucket.colorVar }]),
);

function DistributionChart({ data }: { data: MeterRow[] }) {
  const topKey = BUCKET_KEYS[BUCKET_KEYS.length - 1];
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
      <ChartContainer config={CHART_CONFIG} className="aspect-auto h-80 w-full min-w-0 flex-1">
        <BarChart data={data} margin={{ top: 16 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="meter"
            tickLine={false}
            axisLine={false}
            label={{ value: 'Meter', position: 'insideBottom', offset: -4 }}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                className="min-w-56"
                labelFormatter={(_, payload) => `Meter ${payload?.[0]?.payload?.meter ?? ''}`}
              />
            }
            // Tooltip lists buckets top-of-stack first, matching the legend.
            itemSorter={(item) => -BUCKET_KEYS.indexOf(item.dataKey as FocusBucketKey)}
          />
          {FOCUS_BUCKETS.map((bucket) => (
            <Bar key={bucket.key} dataKey={bucket.key} stackId="a" fill={bucket.colorVar}>
              {bucket.key === topKey && (
                <LabelList
                  dataKey={bucket.key}
                  content={makeStackTotalLabel(data, [...BUCKET_KEYS])}
                />
              )}
            </Bar>
          ))}
        </BarChart>
      </ChartContainer>
      <Legend />
    </div>
  );
}

function DistributionTable({ data }: { data: MeterRow[] }) {
  const columnTotals = useMemo(() => {
    const totals = emptyMeterRow(0);
    for (const row of data) {
      for (const key of BUCKET_KEYS) totals[key] += row[key];
      totals.total += row.total;
    }
    return totals;
  }, [data]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="border-r">Meter</TableHead>
          {TABLE_BUCKET_ORDER.map((key) => (
            <TableHead key={key} className="text-right">
              {BUCKET_BY_KEY.get(key)!.label}
            </TableHead>
          ))}
          <TableHead className="border-l text-right">Totals</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.meter}>
            <TableCell className="border-r font-medium">{row.meter}</TableCell>
            {TABLE_BUCKET_ORDER.map((key) => (
              <TableCell
                key={key}
                className={row[key] === 0 ? 'text-muted-foreground text-right' : 'text-right'}
              >
                {row[key]}
              </TableCell>
            ))}
            <TableCell className="border-l text-right font-medium">{row.total}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="border-r">Totals</TableCell>
          {TABLE_BUCKET_ORDER.map((key) => (
            <TableCell key={key} className="text-right">
              {columnTotals[key]}
            </TableCell>
          ))}
          <TableCell className="border-l text-right">{columnTotals.total}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

export function SelectionsPanel({ eventSlug }: { eventSlug: string }) {
  const result = useSelectionsSummary(eventSlug);
  const [playstyle, setPlaystyle] = useState<Playstyle>('SINGLE');
  const groupId = useId();

  const data = useMemo(
    () => (result.status === 'loaded' ? buildMeterRows(result.rows, playstyle) : []),
    [result, playstyle],
  );
  const total = data.reduce((sum, row) => sum + row.total, 0);

  if (result.status === 'loading') {
    return <Loading message="Loading selections…" />;
  }

  if (result.status === 'error') {
    return (
      <p className="text-destructive text-sm">Couldn't load the selections. Try refreshing.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium">Playstyle</span>
        <RadioGroup
          value={playstyle}
          onValueChange={(value) => setPlaystyle(value as Playstyle)}
          className="flex h-8 flex-row items-center gap-4"
        >
          {PLAYSTYLE_OPTIONS.map(({ value, label }) => {
            const id = `${groupId}-${value}`;
            return (
              <div key={value} className="flex items-center gap-2">
                <RadioGroupItem value={value} id={id} />
                <Label htmlFor={id}>{label}</Label>
              </div>
            );
          })}
        </RadioGroup>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">{total}</span>
          <span className="text-muted-foreground text-sm">
            {playstyle === 'SINGLE' ? 'Single' : 'Double'} charts selected
          </span>
        </div>
        {result.excludedCount > 0 && (
          <p className="text-muted-foreground text-xs">
            {result.excludedCount} selected{' '}
            {result.excludedCount === 1 ? 'submission is' : 'submissions are'} ignored or failed to
            parse, and {result.excludedCount === 1 ? "isn't" : "aren't"} counted here.
          </p>
        )}
      </div>

      {data.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No {playstyle === 'SINGLE' ? 'Single' : 'Double'} charts selected yet. Tick the Selected
          checkbox on the Reviews tab to add some.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-md border p-3">
            <span className="text-sm font-medium">Target tech distribution per meter</span>
            <DistributionChart data={data} />
          </div>
          <div className="rounded-md border">
            <DistributionTable data={data} />
          </div>
        </>
      )}
    </div>
  );
}
