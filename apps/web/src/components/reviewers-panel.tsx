import { cn } from 'cn';
import { ChevronDown, ChevronUp } from 'lucide-react';
// Sort state is plain component state, deliberately not URL-persisted (unlike Reviews' sort/
// filter state - see use-reviews-sort.ts's SORT_PARAM_KEYS comment for why stripping that kind
// of state on tab-switch must happen atomically at the navigation call site, never via a mount-
// effect unmount cleanup). Keeping this tab's sort local sidesteps needing to touch that
// stripping list at all. Follow the same atomic-strip pattern if URL persistence is added later.
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Loading } from '@/components/loading';
import { RatingCell, StdevCell } from '@/components/reviews-table';
import { formatTimestamp } from '@/components/submission-row';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useReviewers, type Reviewer } from '@/hooks/use-reviewers';
import { discordAvatarUrl } from '@/lib/discord-avatar';

type SortColumn =
  'reviewer' | 'reviewCount' | 'commentCount' | 'avgRating' | 'stdevRating' | 'lastActivity';
type Sort = { column: SortColumn; direction: 'asc' | 'desc' };
type SortState = Sort | null;

const DEFAULT_SORT: Sort = { column: 'reviewCount', direction: 'desc' };

function displayNameOf(reviewer: Reviewer): string {
  return reviewer.displayName ?? reviewer.discordUsername;
}

function compareByColumn(a: Reviewer, b: Reviewer, column: SortColumn): number {
  switch (column) {
    case 'reviewer':
      return displayNameOf(a).localeCompare(displayNameOf(b));
    case 'reviewCount':
      return a.reviewCount - b.reviewCount;
    case 'commentCount':
      return a.commentCount - b.commentCount;
    case 'avgRating':
      return (a.avgRating ?? -1) - (b.avgRating ?? -1);
    case 'stdevRating':
      return (a.stdevRating ?? -1) - (b.stdevRating ?? -1);
    case 'lastActivity':
      return (
        (a.lastActivity ? Date.parse(a.lastActivity) : 0) -
        (b.lastActivity ? Date.parse(b.lastActivity) : 0)
      );
  }
}

function applySort(rows: Reviewer[], sort: SortState): Reviewer[] {
  if (!sort) return rows;
  const direction = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => direction * compareByColumn(a, b, sort.column));
}

function SortableHeader({
  label,
  column,
  sort,
  onToggle,
  className,
}: {
  label: string;
  column: SortColumn;
  sort: SortState;
  onToggle: (column: SortColumn) => void;
  className?: string;
}) {
  const active = sort?.column === column;
  return (
    <button
      type="button"
      className={cn('inline-flex items-center gap-1 font-medium', className)}
      onClick={() => onToggle(column)}
    >
      {label}
      {active &&
        (sort!.direction === 'asc' ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        ))}
    </button>
  );
}

export function ReviewersPanel({ eventSlug }: { eventSlug: string }) {
  const result = useReviewers(eventSlug);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);

  const sortedReviewers = useMemo(
    () => (result.status === 'loaded' ? applySort(result.reviewers, sort) : []),
    [result, sort],
  );

  function toggleSort(column: SortColumn) {
    if (!sort || sort.column !== column) {
      setSort({ column, direction: 'asc' });
    } else if (sort.direction === 'asc') {
      setSort({ column, direction: 'desc' });
    } else {
      setSort(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {result.status === 'loading' && <Loading message="Loading reviewers…" />}
      {result.status === 'error' && (
        <p className="text-destructive text-sm">Couldn't load reviewers. Try refreshing.</p>
      )}
      {result.status === 'loaded' && result.reviewers.length === 0 && (
        <p className="text-muted-foreground text-sm">No reviewers yet.</p>
      )}
      {result.status === 'loaded' && result.reviewers.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortableHeader
                  label="Reviewer"
                  column="reviewer"
                  sort={sort}
                  onToggle={toggleSort}
                />
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader
                  label="Reviews"
                  column="reviewCount"
                  sort={sort}
                  onToggle={toggleSort}
                  className="justify-end"
                />
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader
                  label="Comments"
                  column="commentCount"
                  sort={sort}
                  onToggle={toggleSort}
                  className="justify-end"
                />
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader
                  label="Avg"
                  column="avgRating"
                  sort={sort}
                  onToggle={toggleSort}
                  className="justify-end"
                />
              </TableHead>
              <TableHead className="text-right">
                <SortableHeader
                  label="Stdev"
                  column="stdevRating"
                  sort={sort}
                  onToggle={toggleSort}
                  className="justify-end"
                />
              </TableHead>
              <TableHead>
                <SortableHeader
                  label="Last activity"
                  column="lastActivity"
                  sort={sort}
                  onToggle={toggleSort}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedReviewers.map((reviewer) => (
              <TableRow key={reviewer.userId}>
                <TableCell>
                  <Link
                    to={`/events/${encodeURIComponent(eventSlug)}/user/${encodeURIComponent(reviewer.userId)}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Avatar className="size-6">
                      <AvatarImage src={discordAvatarUrl(reviewer)} alt={displayNameOf(reviewer)} />
                      <AvatarFallback className="text-[10px]">
                        {displayNameOf(reviewer).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{displayNameOf(reviewer)}</span>
                    {!reviewer.isCurrentMember && <Badge variant="outline">Former member</Badge>}
                  </Link>
                </TableCell>
                <TableCell className="text-right">{reviewer.reviewCount}</TableCell>
                <TableCell className="text-right">{reviewer.commentCount}</TableCell>
                <TableCell className="text-right">
                  <RatingCell value={reviewer.avgRating} />
                </TableCell>
                <TableCell className="text-right">
                  <StdevCell value={reviewer.stdevRating} />
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {reviewer.lastActivity ? formatTimestamp(reviewer.lastActivity) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
