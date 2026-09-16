import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { chartBadgeLabel, DifficultyBadge } from '@/components/chart-detail';
import { GradientBadge } from '@/components/gradient-badge';
import { Loading } from '@/components/loading';
import { MarkdownContent } from '@/components/markdown-content';
import { RatingCell, StdevCell } from '@/components/reviews-table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePageBreadcrumb } from '@/hooks/use-breadcrumb';
import { useEvent } from '@/hooks/use-event';
import { usePageTitle } from '@/hooks/use-page-title';
import {
  useReviewerDetail,
  type PlaystyleCoverage,
  type RatingMeterTable,
  type ReviewerRecentComment,
  type ReviewerRecentReview,
} from '@/hooks/use-reviewer-detail';
import { discordAvatarUrl } from '@/lib/discord-avatar';
import { PASSING_GRADIENT, SCORING_GRADIENT } from '@/lib/gradient-color';

function displayNameOf(reviewer: { displayName: string | null; discordUsername: string }): string {
  return reviewer.displayName ?? reviewer.discordUsername;
}

function formatCoverage({ reviewedCount, reviewableCount }: PlaystyleCoverage): string {
  if (reviewableCount === 0) return '—';
  return `${reviewedCount}/${reviewableCount} (${Math.round((reviewedCount / reviewableCount) * 100)}%)`;
}

// Modeled on SubmissionDetailPage's ReviewCard, but also shows the chart/submission identity
// (not just the reviewer) since this card can appear detached from any particular chart context.
// The "Other submission" badge that component has is dropped entirely, since every review in
// this list is inherently this reviewer's own review of that exact submission.
function ReviewerReviewCard({
  review,
  reviewer,
  eventSlug,
}: {
  review: ReviewerRecentReview;
  reviewer: {
    displayName: string | null;
    discordUsername: string;
    discordId: string;
    discordAvatarHash: string | null;
  };
  eventSlug: string;
}) {
  const badgeLabel = chartBadgeLabel({
    playstyle: review.chartPlaystyle,
    difficulty: review.chartDifficulty,
    meter: review.chartMeter,
  });
  const title = review.chartTitleRomaji || review.chartTitle;
  const reviewerName = displayNameOf(reviewer);

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar className="size-5">
            <AvatarImage src={discordAvatarUrl(reviewer)} alt={reviewerName} />
            <AvatarFallback className="text-[10px]">
              {reviewerName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{reviewerName}</span>
        </div>
        <div className="flex items-center gap-2">
          {review.isStale && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive">Outdated hash</Badge>
              </TooltipTrigger>
              <TooltipContent>
                This review's recorded chart hash no longer matches the chart's current hash - the
                chart has changed since this review was written.
              </TooltipContent>
            </Tooltip>
          )}
          <span className="text-muted-foreground text-xs">
            {format(new Date(review.updatedAt), 'PP p')}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <DifficultyBadge label={badgeLabel} difficulty={review.chartDifficulty} size="small" />
        <Link
          to={`/events/${encodeURIComponent(eventSlug)}/submissions/${encodeURIComponent(review.submissionId)}`}
          className="flex flex-wrap items-center gap-2 hover:underline"
        >
          <span className="font-medium">{title}</span>
          {review.chartArtistRomaji || review.chartArtist ? (
            <span className="text-muted-foreground">
              by {review.chartArtistRomaji || review.chartArtist}
            </span>
          ) : null}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs">
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
      </div>

      {review.basicChecks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {review.basicChecks.map((check) => (
            <Tooltip key={check.id}>
              <TooltipTrigger asChild>
                <Badge variant={check.level === 'DISQUALIFIED' ? 'destructive' : 'outline'}>
                  {check.label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{check.note || 'No additional detail provided.'}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      <MarkdownContent markdown={review.notes} />
    </div>
  );
}

// Comments-tab equivalent of ReviewerReviewCard. Unlike a review, a comment has no chart-identity
// snapshot of its own (see prisma/schema.prisma's Comment model comment), so `chart` comes from
// the submission's CURRENT chart and can be null if it was never parsed or has since been
// deleted - the card falls back to just the submission id in that case.
function ReviewerCommentCard({
  comment,
  reviewer,
  eventSlug,
}: {
  comment: ReviewerRecentComment;
  reviewer: {
    displayName: string | null;
    discordUsername: string;
    discordId: string;
    discordAvatarHash: string | null;
  };
  eventSlug: string;
}) {
  const chart = comment.chart;
  const badgeLabel = chart
    ? chartBadgeLabel({
        playstyle: chart.playstyle,
        difficulty: chart.difficulty,
        meter: chart.meter,
      })
    : null;
  const title = chart ? chart.titleRomaji || chart.title : comment.submissionId;
  const reviewerName = displayNameOf(reviewer);

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Avatar className="size-5">
            <AvatarImage src={discordAvatarUrl(reviewer)} alt={reviewerName} />
            <AvatarFallback className="text-[10px]">
              {reviewerName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{reviewerName}</span>
        </div>
        <div className="flex items-center gap-2">
          {comment.isStale && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-amber-700 dark:text-amber-400">
                  Stale
                </Badge>
              </TooltipTrigger>
              <TooltipContent>The chart has changed since this comment was written.</TooltipContent>
            </Tooltip>
          )}
          <span className="text-muted-foreground text-xs">
            {format(new Date(comment.updatedAt), 'PP p')}
            {comment.isEdited && ' (edited)'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {chart && badgeLabel && (
          <DifficultyBadge label={badgeLabel} difficulty={chart.difficulty} size="small" />
        )}
        <Link
          to={`/events/${encodeURIComponent(eventSlug)}/submissions/${encodeURIComponent(comment.submissionId)}`}
          className="flex flex-wrap items-center gap-2 hover:underline"
        >
          <span className="font-medium">{title}</span>
          {chart?.artistRomaji || chart?.artist ? (
            <span className="text-muted-foreground">by {chart.artistRomaji || chart.artist}</span>
          ) : null}
        </Link>
      </div>

      <MarkdownContent markdown={comment.body} />
    </div>
  );
}

// More useful than the avg/stdev summary above for seeing this reviewer's actual tendencies at a
// glance - e.g. a reviewer who never gives anything above 1.5 looks identical to one who's
// evenly spread when you only see the average, and a per-meter breakdown surfaces things like
// "only gives 3s to lower meters" that a single rating-only distribution can't. The null row
// ("No rating") is a distinct bucket from every numeric option - it's a review where the
// reviewer left the rating blank, not a 0. SINGLE/DOUBLE is a toggle rather than side-by-side
// tables since the meter columns rarely overlap between playstyles.
function RatingCountsTable({
  breakdown,
}: {
  breakdown: { SINGLE: RatingMeterTable; DOUBLE: RatingMeterTable };
}) {
  // Defaults to whichever playstyle this reviewer has actually reviewed more of, rather than
  // always Single - a Doubles-focused reviewer would otherwise land on an empty table. Only
  // computed once per mount (the call site keys this component by userId so it remounts, and
  // re-initializes this default, when navigating to a different reviewer).
  const [playstyle, setPlaystyle] = useState<'SINGLE' | 'DOUBLE'>(() =>
    breakdown.DOUBLE.grandTotal > breakdown.SINGLE.grandTotal ? 'DOUBLE' : 'SINGLE',
  );
  const singleId = useId();
  const doubleId = useId();
  const table = breakdown[playstyle];

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">Ratings given</span>
        <RadioGroup
          value={playstyle}
          onValueChange={(value) => setPlaystyle(value as 'SINGLE' | 'DOUBLE')}
          className="flex h-8 flex-row items-center gap-4"
        >
          {breakdown.SINGLE.grandTotal > 0 && (
            <div className="flex items-center gap-2">
              <RadioGroupItem value="SINGLE" id={singleId} />
              <Label htmlFor={singleId}>Single</Label>
            </div>
          )}
          {breakdown.DOUBLE.grandTotal > 0 && (
            <div className="flex items-center gap-2">
              <RadioGroupItem value="DOUBLE" id={doubleId} />
              <Label htmlFor={doubleId}>Double</Label>
            </div>
          )}
        </RadioGroup>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Rating</TableHead>
              {table.meters.map((meter) => (
                <TableHead key={meter} className="text-right">
                  {meter}
                </TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.map(({ rating, counts, total }) => (
              <TableRow key={rating ?? 'none'}>
                <TableCell>
                  {rating == null ? 'No rating' : <RatingCell value={rating} />}
                </TableCell>
                {counts.map((count, i) => (
                  <TableCell key={table.meters[i]} className="text-right">
                    {count}
                  </TableCell>
                ))}
                <TableCell className="text-right font-medium">{total}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-medium">Total</TableCell>
              {table.columnTotals.map((count, i) => (
                <TableCell key={table.meters[i]} className="text-right font-medium">
                  {count}
                </TableCell>
              ))}
              <TableCell className="text-right font-medium">{table.grandTotal}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const RECENT_ITEMS_PAGE_SIZE = 5;

// Client-side pagination over an already-capped-by-the-API list (25 items, for both recent
// reviews and recent comments), rather than a server-paginated endpoint - there's no need for
// the backend to support arbitrary paging through a reviewer's entire history here, just to
// break the existing capped list into easier-to-scan chunks. Shared between Recent Reviews and
// Recent Comments since the paging chrome is otherwise identical.
function PaginatedList<T>({
  title,
  items,
  emptyMessage,
  renderItem,
}: {
  title: string;
  items: T[];
  emptyMessage: string;
  renderItem: (item: T) => ReactNode;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / RECENT_ITEMS_PAGE_SIZE));
  const pageItems = useMemo(
    () => items.slice(page * RECENT_ITEMS_PAGE_SIZE, (page + 1) * RECENT_ITEMS_PAGE_SIZE),
    [items, page],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        {pageCount > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-muted-foreground text-xs">
              Page {page + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
      {items.length === 0 && <p className="text-muted-foreground text-sm">{emptyMessage}</p>}
      {pageItems.map(renderItem)}
    </div>
  );
}

export function ReviewerDetailPage() {
  const { slug, userId } = useParams<{ slug: string; userId: string }>();
  const event = useEvent(slug ?? '');
  const detail = useReviewerDetail(slug ?? '', userId ?? '');

  const reviewerName = detail.status === 'loaded' ? displayNameOf(detail) : null;
  usePageBreadcrumb(
    event.status === 'loaded' && reviewerName
      ? [{ label: event.event.name, to: `/events/${slug}` }, { label: reviewerName }]
      : [],
  );
  usePageTitle(
    event.status !== 'loaded' || detail.status !== 'loaded'
      ? null
      : `${reviewerName} - Reviewers - ${event.event.name}`,
  );

  if (detail.status === 'loading') {
    return <Loading message="Loading reviewer…" />;
  }

  if (detail.status === 'error') {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{detail.notFound ? 'Reviewer not found' : "Couldn't load reviewer"}</CardTitle>
          <CardDescription>
            {detail.notFound
              ? "This reviewer doesn't exist, or has no relationship to this event."
              : 'Try refreshing.'}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4 self-start">
      <Link
        to={`/events/${encodeURIComponent(slug ?? '')}?tab=reviewers`}
        className="text-muted-foreground inline-flex w-fit items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" /> Back to event
      </Link>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Avatar className="size-8">
              <AvatarImage src={discordAvatarUrl(detail)} alt={reviewerName ?? ''} />
              <AvatarFallback className="text-xs">
                {(reviewerName ?? '').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium">{reviewerName}</span>
            <span className="text-muted-foreground text-sm">@{detail.discordUsername}</span>
            {!detail.isCurrentMember && <Badge variant="outline">Former member</Badge>}
            {detail.isCurrentMember && detail.grantedAt && (
              <span className="text-muted-foreground text-xs">
                Member since {format(new Date(detail.grantedAt), 'PP')}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span>
              <span className="text-muted-foreground">Reviews:</span> {detail.reviewCount}
            </span>
            <span>
              <span className="text-muted-foreground">Comments:</span> {detail.commentCount}
            </span>
            <span>
              <span className="text-muted-foreground">Coverage (S):</span>{' '}
              {formatCoverage(detail.coverageByPlaystyle.SINGLE)}
            </span>
            <span>
              <span className="text-muted-foreground">Coverage (D):</span>{' '}
              {formatCoverage(detail.coverageByPlaystyle.DOUBLE)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-muted-foreground">Avg. rating:</span>
              <RatingCell value={detail.avgRating} />
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-muted-foreground">Stdev:</span>
              <StdevCell value={detail.stdevRating} />
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-muted-foreground">Consensus deviation:</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <StdevCell value={detail.consensusDeviation} />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {detail.consensusDeviation == null
                    ? "No comparison data yet - every chart this reviewer rated has no other reviewer's rating to compare against."
                    : `Average distance from other reviewers' average rating on the same chart, based on ${detail.consensusSampleCount} of their ${detail.reviewCount} rated reviews.`}
                </TooltipContent>
              </Tooltip>
            </span>
          </div>
        </div>

        {(detail.ratingBreakdown.SINGLE.grandTotal > 0 ||
          detail.ratingBreakdown.DOUBLE.grandTotal > 0) && (
          <RatingCountsTable key={userId} breakdown={detail.ratingBreakdown} />
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PaginatedList
            key={`${userId}-reviews`}
            title="Recent Reviews"
            items={detail.recentReviews}
            emptyMessage="No reviews yet from this reviewer."
            renderItem={(review) => (
              <ReviewerReviewCard
                key={review.id}
                review={review}
                reviewer={detail}
                eventSlug={slug ?? ''}
              />
            )}
          />
          <PaginatedList
            key={`${userId}-comments`}
            title="Recent Comments"
            items={detail.recentComments}
            emptyMessage="No comments yet from this reviewer."
            renderItem={(comment) => (
              <ReviewerCommentCard
                key={comment.id}
                comment={comment}
                reviewer={detail}
                eventSlug={slug ?? ''}
              />
            )}
          />
        </div>
      </div>
    </div>
  );
}
