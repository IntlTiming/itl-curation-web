import { format } from 'date-fns';
import { Link2, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { chartBadgeLabel, DifficultyBadge } from '@/components/chart-detail';
import { GradientBadge } from '@/components/gradient-badge';
import { Loading } from '@/components/loading';
import { RatingCell } from '@/components/reviews-table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  useOrphanedReviews,
  type OrphanedReviewCandidate,
  type OrphanedReviewGroup,
} from '@/hooks/use-orphaned-reviews';
import { discordAvatarUrl } from '@/lib/discord-avatar';
import { PASSING_GRADIENT, SCORING_GRADIENT } from '@/lib/gradient-color';

const SEARCH_DEBOUNCE_MS = 300;

function CandidateRow({
  candidate,
  onSelect,
  disabled,
}: {
  candidate: OrphanedReviewCandidate;
  onSelect: () => void;
  disabled: boolean;
}) {
  const title = candidate.chart.titleRomaji || candidate.chart.title;
  const badgeLabel = chartBadgeLabel(candidate.chart);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="hover:bg-accent flex w-full flex-col gap-1 rounded-md p-2 text-left text-sm disabled:opacity-50"
    >
      <div className="flex items-center gap-1.5">
        <DifficultyBadge label={badgeLabel} difficulty={candidate.chart.difficulty} size="small" />
        <span className="min-w-0 truncate font-medium">{title}</span>
        {candidate.sameSubmitter && (
          <Badge variant="secondary" className="shrink-0">
            Same submitter
          </Badge>
        )}
      </div>
      <span className="text-muted-foreground truncate text-xs">
        {candidate.stepartist} • {candidate.pack} • {candidate.fileId}
      </span>
    </button>
  );
}

// Shared by both the per-review "Relink" trigger and the group-level "Relink all" shortcut -
// ranked suggestions first, then a debounced manual search as a fallback for when none of them
// are the right one (mirrors AddCuratorDialog's search-then-pick shape).
function RelinkPicker({
  eventSlug,
  candidates,
  searchCandidates,
  onSelect,
  pending,
}: {
  eventSlug: string;
  candidates: OrphanedReviewCandidate[];
  searchCandidates: (query: string) => Promise<OrphanedReviewCandidate[]>;
  onSelect: (candidate: OrphanedReviewCandidate) => void;
  pending: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OrphanedReviewCandidate[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const timeout = setTimeout(() => {
      searchCandidates(trimmed)
        .then((found) => {
          if (!cancelled) setResults(found);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="flex flex-col gap-2 p-2">
      {candidates.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground px-2 text-xs font-medium uppercase">
            Suggested
          </span>
          {candidates.map((candidate) => (
            <CandidateRow
              key={candidate.fileId}
              candidate={candidate}
              disabled={pending}
              onSelect={() => onSelect(candidate)}
            />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-1 border-t pt-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search all submissions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 pl-7 text-sm"
          />
        </div>
        {searching && <p className="text-muted-foreground px-2 text-xs">Searching…</p>}
        {!searching && query.trim() !== '' && results.length === 0 && (
          <p className="text-muted-foreground px-2 text-xs">No matching submissions.</p>
        )}
        {results.map((candidate) => (
          <CandidateRow
            key={candidate.fileId}
            candidate={candidate}
            disabled={pending}
            onSelect={() => onSelect(candidate)}
          />
        ))}
      </div>
      <p className="text-muted-foreground px-2 text-xs">
        Also viewable on the{' '}
        <Link
          to={`/events/${encodeURIComponent(eventSlug)}?tab=submissions`}
          className="text-primary hover:underline"
        >
          Submissions tab
        </Link>
        .
      </p>
    </div>
  );
}

function OrphanedReviewGroupCard({
  eventSlug,
  group,
  onRelink,
  searchCandidates,
}: {
  eventSlug: string;
  group: OrphanedReviewGroup;
  onRelink: (reviewId: string, targetFileId: string) => Promise<void>;
  searchCandidates: (query: string) => Promise<OrphanedReviewCandidate[]>;
}) {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  // Relinking reassigns a review's submissionId, so every pick - single or "Relink all" - is
  // staged here and only applied from the confirm dialog, never directly from the click.
  const [pendingConfirm, setPendingConfirm] = useState<
    | {
        kind: 'one';
        review: OrphanedReviewGroup['reviews'][number];
        target: OrphanedReviewCandidate;
      }
    | { kind: 'all'; target: OrphanedReviewCandidate }
    | null
  >(null);
  // Separate from pendingConfirm so the dialog's text stays intact through its close animation.
  const [confirmOpen, setConfirmOpen] = useState(false);

  function stageConfirm(next: NonNullable<typeof pendingConfirm>) {
    setPendingConfirm(next);
    setConfirmOpen(true);
  }

  function handleConfirm() {
    if (!pendingConfirm) return;
    if (pendingConfirm.kind === 'one') {
      void handleRelinkOne(pendingConfirm.review.id, pendingConfirm.target.fileId);
    } else {
      void handleRelinkAll(pendingConfirm.target.fileId);
    }
    setConfirmOpen(false);
  }

  async function handleRelinkOne(reviewId: string, targetFileId: string) {
    setPendingKey(reviewId);
    setRowError((prev) => ({ ...prev, [reviewId]: '' }));
    try {
      await onRelink(reviewId, targetFileId);
      setOpenPopover(null);
    } catch (err) {
      setRowError((prev) => ({
        ...prev,
        [reviewId]: err instanceof Error ? err.message : 'Failed to relink',
      }));
    } finally {
      setPendingKey(null);
    }
  }

  async function handleRelinkAll(targetFileId: string) {
    setPendingKey('__all__');
    setBulkError(null);
    const results = await Promise.allSettled(
      group.reviews.map((review) => onRelink(review.id, targetFileId)),
    );
    const failures = results.filter((r) => r.status === 'rejected').length;
    if (failures > 0) {
      setBulkError(
        `${failures} of ${group.reviews.length} review(s) couldn't be relinked (likely already reviewed by the same person on that submission) - relink those individually below.`,
      );
    }
    setOpenPopover(null);
    setPendingKey(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {group.submission.stepartist}
          <span className="text-muted-foreground font-normal">
            {group.reviews.length} orphaned review{group.reviews.length === 1 ? '' : 's'}
          </span>
        </CardTitle>
        <CardDescription>
          {group.submission.pack} • submitted by {group.submission.submitter} on{' '}
          {format(new Date(group.submission.submittedAt), 'PP')} • ignored submission{' '}
          <Link
            to={`/events/${encodeURIComponent(eventSlug)}/submissions/${encodeURIComponent(group.submission.fileId)}`}
            className="text-primary hover:underline"
          >
            {group.submission.fileId}
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {group.candidates.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-xs">Relink all to:</span>
            {group.candidates.slice(0, 3).map((candidate) => (
              <Button
                key={candidate.fileId}
                size="sm"
                variant="outline"
                disabled={pendingKey !== null}
                onClick={() => stageConfirm({ kind: 'all', target: candidate })}
              >
                <Link2 />
                {candidate.chart.titleRomaji || candidate.chart.title}
                {candidate.sameSubmitter && <Badge variant="secondary">Same submitter</Badge>}
              </Button>
            ))}
          </div>
        )}
        {bulkError && <p className="text-destructive text-sm">{bulkError}</p>}

        <div className="flex flex-col gap-2">
          {group.reviews.map((review) => (
            <div
              key={review.id}
              className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Avatar className="size-6">
                    <AvatarImage
                      src={discordAvatarUrl(review.reviewer)}
                      alt={review.reviewer.displayName}
                    />
                    <AvatarFallback className="text-[10px]">
                      {review.reviewer.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{review.reviewer.displayName}</span>
                  <DifficultyBadge
                    label={chartBadgeLabel(review.chart)}
                    difficulty={review.chart.difficulty}
                    size="small"
                  />
                  <span className="text-muted-foreground truncate text-xs">
                    {review.chart.titleRomaji || review.chart.title}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 pl-8 text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-muted-foreground">Rating:</span>
                    <RatingCell value={review.rating} />
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-muted-foreground">Passing:</span>
                    {review.passing == null ? (
                      '—'
                    ) : (
                      <GradientBadge value={review.passing} {...PASSING_GRADIENT}>
                        {review.passing}
                      </GradientBadge>
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-muted-foreground">Scoring:</span>
                    {review.scoring == null ? (
                      '—'
                    ) : (
                      <GradientBadge value={review.scoring} {...SCORING_GRADIENT}>
                        {review.scoring}
                      </GradientBadge>
                    )}
                  </span>
                  <span className="text-muted-foreground">chartHash: {review.chartHash}</span>
                </div>
                {rowError[review.id] && (
                  <p className="text-destructive pl-8 text-xs">{rowError[review.id]}</p>
                )}
              </div>
              <Popover
                open={openPopover === review.id}
                onOpenChange={(open) => setOpenPopover(open ? review.id : null)}
              >
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" disabled={pendingKey === review.id}>
                    <Link2 />
                    {pendingKey === review.id ? 'Relinking…' : 'Relink…'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0">
                  <RelinkPicker
                    eventSlug={eventSlug}
                    candidates={group.candidates}
                    searchCandidates={searchCandidates}
                    pending={pendingKey === review.id}
                    onSelect={(target) => {
                      setOpenPopover(null);
                      stageConfirm({ kind: 'one', review, target });
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          ))}
        </div>
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingConfirm?.kind === 'all'
                ? `Relink all ${group.reviews.length} review${group.reviews.length === 1 ? '' : 's'}?`
                : 'Relink this review?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingConfirm?.kind === 'one'
                ? `${pendingConfirm.review.reviewer.displayName}'s review`
                : `Every orphaned review on ${group.submission.fileId}`}{' '}
              will be moved to{' '}
              <span className="text-foreground font-medium">
                {pendingConfirm &&
                  (pendingConfirm.target.chart.titleRomaji || pendingConfirm.target.chart.title)}
              </span>{' '}
              by {pendingConfirm?.target.stepartist} ({pendingConfirm?.target.fileId}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Relink</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function OrphanedReviewsPanel({ eventSlug }: { eventSlug: string }) {
  const orphaned = useOrphanedReviews(eventSlug);
  const { relink, searchCandidates } = orphaned;

  if (orphaned.status === 'loading') {
    return <Loading message="Loading orphaned reviews…" />;
  }

  if (orphaned.status === 'error') {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Couldn't load orphaned reviews</CardTitle>
          <CardDescription>Try refreshing.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { groups } = orphaned;
  if (groups.length === 0) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>No orphaned reviews</CardTitle>
          <CardDescription>
            Every review is attached to a live submission - nothing to reconcile right now.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        These reviews belong to submissions that were later ignored - usually because the submitter
        sent a resubmission that superseded them. Relink each one to the chart's live submission so
        it counts toward that chart's reviews again.
      </p>
      {groups.map((group) => (
        <OrphanedReviewGroupCard
          key={group.submission.fileId}
          eventSlug={eventSlug}
          group={group}
          onRelink={relink}
          searchCandidates={searchCandidates}
        />
      ))}
    </div>
  );
}
