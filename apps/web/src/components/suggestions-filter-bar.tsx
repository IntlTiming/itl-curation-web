import { ChevronRight, RotateCcw, Search } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from 'cn';
import { ReviewCountRange } from '@/components/reviews-filter-bar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type SuggestionsFilters,
  type SuggestionsFlagFilter,
  type SuggestionsLinkFilter,
} from '@/lib/suggestions-filters';

export function SuggestionsFilterBar({
  filters,
  onFiltersChange,
  onReset,
}: {
  filters: SuggestionsFilters;
  onFiltersChange: (patch: Partial<SuggestionsFilters>) => void;
  onReset: () => void;
}) {
  const searchId = useId();
  const unreviewedByMeId = useId();
  const publiclyReviewableId = useId();
  const [additionalFiltersOpen, setAdditionalFiltersOpen] = useState(
    filters.unreviewedByMeOnly || filters.publiclyReviewableOnly,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-6">
        <div className="grid gap-2">
          <Label htmlFor={searchId}>Search</Label>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              id={searchId}
              placeholder="Chart, submitter, reason…"
              value={filters.search}
              onChange={(e) => onFiltersChange({ search: e.target.value })}
              className="h-8 w-64 pl-8"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Linked</Label>
          <Select
            value={filters.linkStatus}
            onValueChange={(value) =>
              onFiltersChange({ linkStatus: value as SuggestionsLinkFilter })
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unlinked">Not linked</SelectItem>
              <SelectItem value="linked">Linked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Basic checks</Label>
          <Select
            value={filters.flags}
            onValueChange={(value) => onFiltersChange({ flags: value as SuggestionsFlagFilter })}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="none">No flags</SelectItem>
              <SelectItem value="warning">Has a warning</SelectItem>
              <SelectItem value="disqualified">Has a DQ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label># reviews</Label>
          <ReviewCountRange
            min={filters.minReviewCount}
            max={filters.maxReviewCount}
            onCommit={onFiltersChange}
          />
        </div>

        {/* Invisible label keeps the button aligned with the other controls - same trick as
            ReviewsFilterBar's Reset. */}
        <div className="grid gap-2">
          <Label aria-hidden className="invisible">
            Reset
          </Label>
          <Button variant="ghost" onClick={onReset}>
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
        <CollapsibleContent className="flex flex-col gap-2 pt-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id={publiclyReviewableId}
              checked={filters.publiclyReviewableOnly}
              onCheckedChange={(checked) =>
                onFiltersChange({ publiclyReviewableOnly: checked === true })
              }
            />
            <Label htmlFor={publiclyReviewableId}>Show only publicly reviewable suggestions</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={unreviewedByMeId}
              checked={filters.unreviewedByMeOnly}
              onCheckedChange={(checked) =>
                onFiltersChange({ unreviewedByMeOnly: checked === true })
              }
            />
            <Label htmlFor={unreviewedByMeId}>Only unreviewed by me</Label>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
