import { useId, useState } from 'react';
import { Loading } from '@/components/loading';
import { CategoryBreakdownChart } from '@/components/overview/category-breakdown-chart';
import { CoverageBarChart } from '@/components/overview/coverage-bar-chart';
import type { PlaystyleFilter } from '@/components/overview/playstyle-filter';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useOverview } from '@/hooks/use-overview';

const PLAYSTYLE_OPTIONS: { value: PlaystyleFilter; label: string }[] = [
  { value: 'BOTH', label: 'Both' },
  { value: 'SINGLE', label: 'Singles' },
  { value: 'DOUBLE', label: 'Doubles' },
];

export function OverviewPanel({ eventSlug }: { eventSlug: string }) {
  const result = useOverview(eventSlug);
  const [playstyleFilter, setPlaystyleFilter] = useState<PlaystyleFilter>('BOTH');
  const groupId = useId();

  if (result.status === 'loading') {
    return <Loading message="Loading overview…" />;
  }

  if (result.status === 'error') {
    return <p className="text-destructive text-sm">Couldn't load the overview. Try refreshing.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium">Playstyle</span>
        <RadioGroup
          value={playstyleFilter}
          onValueChange={(value) => setPlaystyleFilter(value as PlaystyleFilter)}
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

      <CoverageBarChart rows={result.coverageByMeter} playstyleFilter={playstyleFilter} />

      <CategoryBreakdownChart
        title="Focus"
        rows={result.focusBreakdown}
        playstyleFilter={playstyleFilter}
      />
      <CategoryBreakdownChart
        title="Derived focus"
        rows={result.derivedFocusBreakdown}
        playstyleFilter={playstyleFilter}
      />
    </div>
  );
}
