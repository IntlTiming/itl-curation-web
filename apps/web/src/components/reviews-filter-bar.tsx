import { cn } from 'cn';
import { ChevronRight, RotateCcw } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReviewsFilters } from '@/hooks/use-reviews-filters';
import type { ReviewsMeterBounds } from '@/hooks/use-reviews';
import type { SortState } from '@/components/reviews-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@/components/ui/number-field';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { TECH_TAGS, type TechCategory } from '@/lib/tech-tags';

const TECH_TAG_CATEGORIES: TechCategory[] = ['BXF', 'TECH', 'NOTECH'];

// Display order for the Focus popover's checkbox list - tech tiers ascending, then the
// remaining non-tech categories. Submission.focus's option list changes between seasons (see
// its schema comment), so this is a known-value lookup, not the source of truth for which
// values exist: sortFocusOptions falls back to alphabetical for anything not listed here,
// rather than dropping it, so a season's new/renamed focus value still shows up (just at the
// end) until this list is updated to include it.
const FOCUS_ORDER = [
  'Tech/Timing - no tech',
  'Tech/Timing - single tech',
  'Tech/Timing - multiple tech',
  'Stamina',
  'Footspeed',
  'Mods',
];

function sortFocusOptions(options: string[]): string[] {
  return [...options].sort((a, b) => {
    const rankA = FOCUS_ORDER.indexOf(a);
    const rankB = FOCUS_ORDER.indexOf(b);
    if (rankA !== -1 && rankB !== -1) return rankA - rankB;
    if (rankA !== -1) return -1;
    if (rankB !== -1) return 1;
    return a.localeCompare(b);
  });
}

const SEARCH_DEBOUNCE_MS = 350;
const METER_COMMIT_DEBOUNCE_MS = 350;

export function ReviewsFilterBar({
  filters,
  onFiltersChange,
  onReset,
  meterBounds,
  sort,
  onSortChange,
  focusOptions,
}: {
  filters: ReviewsFilters;
  onFiltersChange: (update: Partial<ReviewsFilters>) => void;
  onReset: () => void;
  meterBounds: ReviewsMeterBounds;
  // Only consulted by the Tech Tags popover's "Sort" button below - lets it tell whether a
  // column sort is currently overriding the server's best-match tech tag ordering, and clear
  // it back to null (not the table's own toggleSort cycle) when clicked.
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  // Distinct Submission.focus values available under every other active filter - populates the
  // Focus popover's checkbox list. Unlike Tech Tags, there's no fixed client-side enum since the
  // option list changes between seasons (see Submission.focus's schema comment).
  focusOptions: string[];
}) {
  const [searchInput, setSearchInput] = useState(filters.search);
  // Starts open if a filter living inside it is already active on mount (e.g. loaded from the
  // URL or localStorage), so an active-but-collapsed filter is never silently hidden from view.
  // Deliberately a one-time lazy init, not a synced effect - it won't re-open on its own if the
  // user manually collapses it after turning the filter on.
  const [additionalFiltersOpen, setAdditionalFiltersOpen] = useState(
    () => filters.publiclyReviewableOnly,
  );
  const searchId = useId();
  const singleId = useId();
  const doubleId = useId();
  const unreviewedId = useId();
  const publiclyReviewableId = useId();

  useEffect(() => {
    if (searchInput === filters.search) return;
    const timeout = setTimeout(() => onFiltersChange({ search: searchInput }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // Only re-run when the local draft changes - re-running on filters.search would fight
    // the debounce timer whenever the parent applies our own update back down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const boundsMin = meterBounds?.min ?? 0;
  const boundsMax = meterBounds?.max ?? 0;
  const sliderRange: [number, number] = [
    filters.minMeter ?? boundsMin,
    filters.maxMeter ?? boundsMax,
  ];
  const [localRange, setLocalRange] = useState(sliderRange);

  useEffect(() => {
    // Clamped to the current bounds: an explicit minMeter/maxMeter set under one set of
    // filters (e.g. Playstyle=DOUBLE) can fall outside the bounds of another (e.g. switching
    // to SINGLE, which may have a smaller max meter) - feeding the Slider/NumberField a value
    // beyond their own min/max would be an invalid controlled-component state. The underlying
    // filter value itself is left untouched (not clamped away), since it's a legitimate saved
    // preference that becomes usable again once the bounds widen back out.
    const [rawMin, rawMax] = sliderRange;
    setLocalRange([
      Math.min(Math.max(rawMin, boundsMin), boundsMax),
      Math.min(Math.max(rawMax, boundsMin), boundsMax),
    ]);
    // Deliberately keyed only on the values, not the array reference, and on the bounds -
    // resyncs local drag state whenever the committed filters or available range change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.minMeter, filters.maxMeter, boundsMin, boundsMax]);

  function commitMeterRange([nextMin, nextMax]: [number, number]) {
    onFiltersChange({
      minMeter: nextMin === boundsMin ? null : nextMin,
      maxMeter: nextMax === boundsMax ? null : nextMax,
    });
  }

  // The NumberFields commit on every keyboard arrow-key step and every mouse-wheel tick (per
  // Base UI's own docs: those two interactions fire onValueCommitted synchronously alongside
  // onValueChange, unlike a button press or a drag, which only commit once on release) - so
  // holding an arrow key or spinning the wheel would otherwise fire a request per tick. Debounced
  // the same way the search box is. The Slider's onValueCommit already only fires once per drag
  // gesture, so it stays undebounced.
  const meterCommitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (meterCommitTimeoutRef.current) clearTimeout(meterCommitTimeoutRef.current);
    };
  }, []);
  function debouncedCommitMeterRange(range: [number, number]) {
    if (meterCommitTimeoutRef.current) clearTimeout(meterCommitTimeoutRef.current);
    meterCommitTimeoutRef.current = setTimeout(
      () => commitMeterRange(range),
      METER_COMMIT_DEBOUNCE_MS,
    );
  }

  function handleReset() {
    // The search box's draft text is local component state, not itself a filter value, so a
    // reset needs to clear it explicitly - it wouldn't otherwise notice filters.search
    // changing out from under it.
    setSearchInput('');
    onReset();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-6">
        <div className="grid gap-2">
          <Label htmlFor={searchId}>Search</Label>
          <Input
            id={searchId}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Title, artist, stepartist, pack…"
            className="w-64"
          />
        </div>

        <div className="grid gap-2">
          <Label>Playstyle</Label>
          <RadioGroup
            value={filters.playstyle}
            onValueChange={(value) => onFiltersChange({ playstyle: value as 'SINGLE' | 'DOUBLE' })}
            className="flex h-8 flex-row items-center gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="SINGLE" id={singleId} />
              <Label htmlFor={singleId}>Single</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="DOUBLE" id={doubleId} />
              <Label htmlFor={doubleId}>Double</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="grid gap-2">
          <Label>Meter</Label>
          <div className="flex items-center gap-3">
            <NumberField
              value={localRange[0]}
              min={boundsMin}
              max={localRange[1]}
              disabled={!meterBounds || boundsMin === boundsMax}
              onValueChange={(value) => setLocalRange([value ?? boundsMin, localRange[1]])}
              onValueCommitted={(value) =>
                debouncedCommitMeterRange([value ?? boundsMin, localRange[1]])
              }
              className="w-28"
            >
              <NumberFieldGroup>
                <NumberFieldDecrement className={cn(localRange[0] <= boundsMin && 'invisible')} />
                <NumberFieldInput />
                <NumberFieldIncrement
                  className={cn(localRange[0] >= localRange[1] && 'invisible')}
                />
              </NumberFieldGroup>
            </NumberField>
            <Slider
              min={boundsMin}
              max={boundsMax}
              step={1}
              value={localRange}
              disabled={!meterBounds || boundsMin === boundsMax}
              onValueChange={(value) => setLocalRange(value as [number, number])}
              onValueCommit={(value) => commitMeterRange(value as [number, number])}
              className="w-40"
            />
            <NumberField
              value={localRange[1]}
              min={localRange[0]}
              max={boundsMax}
              disabled={!meterBounds || boundsMin === boundsMax}
              onValueChange={(value) => setLocalRange([localRange[0], value ?? boundsMax])}
              onValueCommitted={(value) =>
                debouncedCommitMeterRange([localRange[0], value ?? boundsMax])
              }
              className="w-28"
            >
              <NumberFieldGroup>
                <NumberFieldDecrement
                  className={cn(localRange[1] <= localRange[0] && 'invisible')}
                />
                <NumberFieldInput />
                <NumberFieldIncrement className={cn(localRange[1] >= boundsMax && 'invisible')} />
              </NumberFieldGroup>
            </NumberField>
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Tech Tags</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-8 justify-start">
                Tech Tags
                {filters.techTags.length > 0 && (
                  <Badge variant="secondary">{filters.techTags.length}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <div className="flex items-center justify-between gap-2 border-b px-2.5 py-1.5">
                <span className="text-muted-foreground text-xs font-medium uppercase">
                  Tech Tags
                </span>
                <div className="flex items-center gap-1">
                  {/* Clears any active column sort (rather than cycling it, like clicking a
                    column header does) so the server's default order - which ranks exact/close
                    tech-tag matches first once tags are selected - can show through. Disabled
                    when there's nothing to clear (sort is already null) or nothing to rank by
                    (no tags selected). */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs"
                    disabled={sort === null || filters.techTags.length === 0}
                    onClick={() => onSortChange(null)}
                  >
                    Sort
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs"
                    disabled={filters.techTags.length === 0}
                    onClick={() => onFiltersChange({ techTags: [] })}
                  >
                    Unselect all
                  </Button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto p-2.5">
                {TECH_TAG_CATEGORIES.map((category) => (
                  <div key={category} className="mb-3 last:mb-0">
                    <div className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                      {category}
                    </div>
                    {TECH_TAGS.filter((tag) => tag.category === category).map((tag) => {
                      const id = `tech-tag-${tag.code}`;
                      const checked = filters.techTags.includes(tag.code);
                      return (
                        <div key={tag.code} className="flex items-center gap-2 py-1">
                          <Checkbox
                            id={id}
                            checked={checked}
                            onCheckedChange={(next) =>
                              onFiltersChange({
                                techTags:
                                  next === true
                                    ? [...filters.techTags, tag.code]
                                    : filters.techTags.filter((code) => code !== tag.code),
                              })
                            }
                          />
                          <Label htmlFor={id} className="text-sm font-normal">
                            {tag.label}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid gap-2">
          <Label>Focus</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-8 justify-start">
                Focus
                {filters.focus.length > 0 && (
                  <Badge variant="secondary">{filters.focus.length}</Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <div className="flex items-center justify-between gap-2 border-b px-2.5 py-1.5">
                <span className="text-muted-foreground text-xs font-medium uppercase">Focus</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs"
                  disabled={filters.focus.length === 0}
                  onClick={() => onFiltersChange({ focus: [] })}
                >
                  Unselect all
                </Button>
              </div>
              <div className="max-h-80 overflow-y-auto p-2.5">
                {focusOptions.length === 0 && (
                  <p className="text-muted-foreground px-1 py-1 text-sm">No options available</p>
                )}
                {sortFocusOptions(focusOptions).map((option) => {
                  const id = `focus-${option}`;
                  const checked = filters.focus.includes(option);
                  return (
                    <div key={option} className="flex items-center gap-2 py-1">
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={(next) =>
                          onFiltersChange({
                            focus:
                              next === true
                                ? [...filters.focus, option]
                                : filters.focus.filter((value) => value !== option),
                          })
                        }
                      />
                      <Label htmlFor={id} className="text-sm font-normal">
                        {option}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Unreviewed and Reset filters have no label of their own, but still get an invisible
          one matching the others' - every column here is (label row + gap-2 + h-8 control row),
          so items-end lines up the actual controls, not just each column's outer box. */}
        <div className="grid gap-2">
          <Label aria-hidden className="invisible">
            Unreviewed
          </Label>
          <div className="flex h-8 items-center gap-2">
            <Checkbox
              id={unreviewedId}
              checked={filters.unreviewedOnly}
              onCheckedChange={(checked) => onFiltersChange({ unreviewedOnly: checked === true })}
            />
            <Label htmlFor={unreviewedId}>Unreviewed</Label>
          </div>
        </div>

        <div className="grid gap-2">
          <Label aria-hidden className="invisible">
            Reset
          </Label>
          <Button variant="ghost" onClick={handleReset}>
            <RotateCcw />
            Reset filters
          </Button>
        </div>
      </div>

      <Collapsible open={additionalFiltersOpen} onOpenChange={setAdditionalFiltersOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-fit">
            <ChevronRight
              className={cn('transition-transform', additionalFiltersOpen && 'rotate-90')}
            />
            Additional filters
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex items-center gap-2 pt-3">
          <Checkbox
            id={publiclyReviewableId}
            checked={filters.publiclyReviewableOnly}
            onCheckedChange={(checked) =>
              onFiltersChange({ publiclyReviewableOnly: checked === true })
            }
          />
          <Label htmlFor={publiclyReviewableId}>Show only publicly reviewable submissions</Label>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
