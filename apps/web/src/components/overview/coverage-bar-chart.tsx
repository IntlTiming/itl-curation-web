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
import type { MeterCoverageRow } from '@/hooks/use-overview';
import type { PlaystyleFilter } from './playstyle-filter';

// Four fixed series (not two) so a submission's color never repaints when the playstyle radio
// changes - "Single Reviewable" keeps slot 1 whether it's shown alongside Double's bars (Both) or
// alone (Singles). Reviewable/Reviewed pairs share adjacent slots (1-2, 3-4) so the two bars that
// belong to the same playstyle read as a visual pair.
const COVERAGE_CHART_CONFIG: ChartConfig = {
  singleReviewable: { label: 'Single - Reviewable', color: 'var(--chart-1)' },
  singleReviewed: { label: 'Single - Reviewed', color: 'var(--chart-2)' },
  doubleReviewable: { label: 'Double - Reviewable', color: 'var(--chart-3)' },
  doubleReviewed: { label: 'Double - Reviewed', color: 'var(--chart-4)' },
};

type CoverageDatum = {
  meter: number;
  singleReviewable?: number;
  singleReviewed?: number;
  doubleReviewable?: number;
  doubleReviewed?: number;
};

const SERIES_BY_FILTER: Record<PlaystyleFilter, (keyof CoverageDatum)[]> = {
  BOTH: ['singleReviewed', 'singleReviewable', 'doubleReviewed', 'doubleReviewable'],
  SINGLE: ['singleReviewed', 'singleReviewable'],
  DOUBLE: ['doubleReviewed', 'doubleReviewable'],
};

// "Reviewed" bars additionally carry what share of that meter's reviewable pool they represent -
// "Reviewable" doesn't get one, since a bar's percentage of itself is always 100% and adds no
// information. Pairs each Reviewed key with its own playstyle's Reviewable key so the percentage
// is computed against the right denominator regardless of which playstyle(s) are showing.
const REVIEWABLE_KEY_OF = {
  singleReviewed: 'singleReviewable',
  doubleReviewed: 'doubleReviewable',
} as const;

function isReviewedKey(key: keyof CoverageDatum): key is keyof typeof REVIEWABLE_KEY_OF {
  return key in REVIEWABLE_KEY_OF;
}

// Recharts' own <Legend> computes its payload order internally from its graphical items rather
// than trusting the <Bar> declaration order, and doesn't accept an order-overriding payload prop
// (its type explicitly omits `payload`) - so the legend is built by hand here, driven directly by
// seriesKeys, to guarantee it matches the bars' left-to-right order exactly.
function Legend({ seriesKeys }: { seriesKeys: (keyof CoverageDatum)[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 pt-3 text-xs">
      {seriesKeys.map((key) => (
        <div key={key} className="flex items-center gap-1.5">
          <div
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: COVERAGE_CHART_CONFIG[key].color }}
          />
          <span className="text-muted-foreground">{COVERAGE_CHART_CONFIG[key].label}</span>
        </div>
      ))}
    </div>
  );
}

function makeReviewedLabel(data: CoverageDatum[], key: keyof typeof REVIEWABLE_KEY_OF) {
  const reviewableKey = REVIEWABLE_KEY_OF[key];
  return function ReviewedLabel(props: LabelProps) {
    const { x, y, width, index } = props;
    if (
      typeof index !== 'number' ||
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof width !== 'number'
    ) {
      return null;
    }
    // Recharts can still invoke this mid-transition with an index from the outgoing bar set - e.g.
    // toggling "View per meter" off shrinks `data` from one row per meter to a single aggregate
    // row, and an exiting bar's animation frame can briefly carry a now-out-of-range index.
    const row = data[index];
    if (!row) return null;
    const reviewed = row[key];
    const reviewable = row[reviewableKey];
    if (reviewed === undefined) return null;
    const pct = reviewable ? Math.round((reviewed / reviewable) * 100) : null;
    return (
      <text
        x={x + width / 2}
        y={y - 6}
        textAnchor="middle"
        fontSize={11}
        className="fill-foreground"
      >
        {reviewed}
        {pct !== null ? ` (${pct}%)` : ''}
      </text>
    );
  };
}

// A single row summing every meter - same CoverageDatum shape as a per-meter row so it can reuse
// the exact same Bar/LabelList/color wiring, just collapsed onto one x-axis tick instead of one
// tick per meter.
function aggregateAcrossMeters(allData: CoverageDatum[]): CoverageDatum {
  const totals: CoverageDatum = { meter: 0 };
  for (const row of allData) {
    for (const key of Object.keys(COVERAGE_CHART_CONFIG) as (keyof CoverageDatum)[]) {
      const value = row[key];
      if (value !== undefined) totals[key] = (totals[key] ?? 0) + value;
    }
  }
  return totals;
}

export function CoverageBarChart({
  rows,
  playstyleFilter,
}: {
  rows: MeterCoverageRow[];
  playstyleFilter: PlaystyleFilter;
}) {
  const [perMeter, setPerMeter] = useState(true);
  const checkboxId = useId();

  const allData = useMemo(() => {
    const byMeter = new Map<number, CoverageDatum>();
    for (const row of rows) {
      const entry = byMeter.get(row.meter) ?? { meter: row.meter };
      const prefix = row.playstyle === 'SINGLE' ? 'single' : 'double';
      entry[`${prefix}Reviewable`] = row.reviewableCount;
      entry[`${prefix}Reviewed`] = row.reviewedCount;
      byMeter.set(row.meter, entry);
    }
    return [...byMeter.values()].sort((a, b) => a.meter - b.meter);
  }, [rows]);

  const seriesKeys = SERIES_BY_FILTER[playstyleFilter];
  const perMeterData = useMemo(
    () => allData.filter((d) => seriesKeys.some((key) => d[key] !== undefined)),
    [allData, seriesKeys],
  );
  const aggregateData = useMemo(() => [aggregateAcrossMeters(allData)], [allData]);

  const data = perMeter ? perMeterData : aggregateData;
  const hasData = perMeter
    ? perMeterData.length > 0
    : seriesKeys.some((key) => aggregateData[0][key] !== undefined);

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Coverage</span>
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

      {!hasData ? (
        <p className="text-muted-foreground text-sm">No reviewable submissions yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            {perMeter
              ? 'Submissions reviewable/reviewed, by meter'
              : 'Submissions reviewable/reviewed, overall'}
          </span>
          <ChartContainer
            config={COVERAGE_CHART_CONFIG}
            className={perMeter ? 'aspect-auto h-72 w-full' : 'aspect-auto h-48 w-full'}
          >
            <BarChart data={data} margin={{ top: 16 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="meter"
                tickLine={false}
                axisLine={false}
                hide={!perMeter}
                label={
                  perMeter ? { value: 'Meter', position: 'insideBottom', offset: -4 } : undefined
                }
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent hideLabel className="min-w-56" />} />
              {seriesKeys.map((key) => (
                <Bar key={key} dataKey={key} fill={`var(--color-${key})`} radius={2}>
                  {isReviewedKey(key) ? (
                    <LabelList dataKey={key} content={makeReviewedLabel(data, key)} />
                  ) : (
                    <LabelList
                      dataKey={key}
                      position="top"
                      className="fill-foreground"
                      fontSize={11}
                    />
                  )}
                </Bar>
              ))}
            </BarChart>
          </ChartContainer>
          <Legend seriesKeys={seriesKeys} />
        </div>
      )}
    </div>
  );
}
