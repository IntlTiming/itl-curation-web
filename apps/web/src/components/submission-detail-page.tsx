import { format } from 'date-fns';
import { ArrowLeft, ChevronDown, RefreshCw, SquareCheck, SquarePen } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { BasicCheckList } from '@/components/basic-check-list';
import { chartBadgeLabel, ChartDetail, DifficultyBadge } from '@/components/chart-detail';
import { CommentsPanel } from '@/components/comments-panel';
import { GradientBadge } from '@/components/gradient-badge';
import { Loading } from '@/components/loading';
import { MarkdownContent } from '@/components/markdown-content';
import { ReviewModal } from '@/components/review-modal';
import {
  CmoddabilityIndicator,
  PublicConsentIndicator,
  RatingCell,
  StdevCell,
} from '@/components/reviews-table';
import { SubmissionDetail } from '@/components/submission-detail';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/hooks/use-auth';
import { usePageBreadcrumb } from '@/hooks/use-breadcrumb';
import { useEvent } from '@/hooks/use-event';
import { usePageTitle } from '@/hooks/use-page-title';
import {
  useSubmissionDetail,
  type SubmissionDetailReview,
  type SubmissionDetailSubmission,
} from '@/hooks/use-submission-detail';
import { discordAvatarUrl } from '@/lib/discord-avatar';
import { PASSING_GRADIENT, SCORING_GRADIENT } from '@/lib/gradient-color';
import { shortenTechTag } from '@/lib/tech-tags';

// The only submission-form "focus" value where singleTechTag is meaningful - see
// submissions-import.mapper.spec.ts's sample entry, which pairs this exact focus string
// with a populated tech_represented_single.
const SINGLE_TECH_FOCUS = 'Tech/Timing - single tech';

// Glance-friendly line shown above the fold - the full field grids (SubmissionDetail,
// ChartDetail) are worth a lot of vertical space but not worth defaulting to open, since
// reviews are the primary thing this page is for.
function SubmissionSummary({ submission }: { submission: SubmissionDetailSubmission }) {
  const chart = submission.chart;
  const badgeLabel = chart ? chartBadgeLabel(chart) : chartBadgeLabel(submission);
  const difficulty = chart?.difficulty ?? submission.difficulty;
  const title = (chart?.titleRomaji || chart?.title) ?? submission.fileId;
  const artist = chart ? chart.artistRomaji || chart.artist : null;

  return (
    <div className="flex flex-col gap-0.5 text-left">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <DifficultyBadge label={badgeLabel} difficulty={difficulty} size="small" />
        <span className="font-medium">{title}</span>
        <CmoddabilityIndicator
          chart={chart ?? { hasSignificantTimingChanges: false }}
          cmodPreference={submission.cmodPreference}
        />
        <PublicConsentIndicator
          submitter={submission.submitter}
          consentToPublicReview={submission.consentToPublicReview}
        />
        {artist && <span className="text-muted-foreground">by {artist}</span>}
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{submission.stepartist}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{submission.pack}</span>
      </div>
      <div className="text-muted-foreground text-xs">
        <span className="font-semibold">Focus:</span> {submission.focus || '—'}
        {submission.focus === SINGLE_TECH_FOCUS &&
          submission.singleTechTag &&
          ` (${shortenTechTag(submission.singleTechTag)})`}
      </div>
      <div className="text-muted-foreground text-xs">
        <span className="font-semibold">Tech tags:</span>{' '}
        {submission.techTags.length ? submission.techTags.map(shortenTechTag).join(', ') : '(none)'}
      </div>
      <div className="text-muted-foreground text-xs">
        <span className="font-semibold">Submitter:</span> {submission.submitter}
      </div>
      {submission.additionalNotes && (
        <div className="text-muted-foreground text-xs italic">{submission.additionalNotes}</div>
      )}
    </div>
  );
}

function DetailCollapsible({
  label,
  open,
  onOpenChange,
  children,
}: {
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger asChild>
        <button className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium">
          {label}
          <ChevronDown
            className={`text-muted-foreground size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function ReviewCard({ review, eventSlug }: { review: SubmissionDetailReview; eventSlug: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link
              to={`/events/${encodeURIComponent(eventSlug)}/user/${encodeURIComponent(review.reviewer.id)}`}
              className="flex items-center gap-2 hover:underline"
            >
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
            </Link>
            {review.isFromDifferentSubmission && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-1">
                    <RefreshCw className="size-3" /> Other submission
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  This review was recorded against a different submission that shares this chart's
                  hash.
                </TooltipContent>
              </Tooltip>
            )}
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
          </div>
          <span className="text-muted-foreground text-xs">
            {format(new Date(review.updatedAt), 'PP p')}
          </span>
        </div>
        {review.isFromDifferentSubmission && (
          <span className="text-muted-foreground pl-8 text-xs">
            (from{' '}
            <Link
              to={`/events/${encodeURIComponent(eventSlug)}/submissions/${encodeURIComponent(review.submissionId)}`}
              className="text-primary hover:underline"
            >
              {review.submissionId}
            </Link>
            )
          </span>
        )}
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

      <BasicCheckList checks={review.basicChecks} />

      <MarkdownContent markdown={review.notes} />
    </div>
  );
}

export function SubmissionDetailPage() {
  const { slug, fileId } = useParams<{ slug: string; fileId: string }>();
  const auth = useAuth();
  const event = useEvent(slug ?? '');
  const detail = useSubmissionDetail(slug ?? '', fileId ?? '');
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);

  const chartTitle =
    detail.status === 'loaded'
      ? detail.submission.chart?.titleRomaji || detail.submission.chart?.title || fileId
      : null;
  usePageBreadcrumb(
    event.status === 'loaded' && chartTitle
      ? [{ label: event.event.name, to: `/events/${slug}?tab=reviews` }, { label: chartTitle }]
      : [],
  );
  usePageTitle(
    event.status !== 'loaded' || detail.status !== 'loaded'
      ? null
      : detail.submission.chart
        ? `${chartTitle} - Submission - ${event.event.name}`
        : `Submission (${fileId}) - ${event.event.name}`,
  );

  if (detail.status === 'loading') {
    return <Loading message="Loading submission…" />;
  }

  if (detail.status === 'error') {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {detail.notFound ? 'Submission not found' : "Couldn't load submission"}
          </CardTitle>
          <CardDescription>
            {detail.notFound
              ? "This submission doesn't exist, or you don't have access to it."
              : 'Try refreshing.'}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { submission, reviews, reviewRevisions, stats } = detail;
  const ownReview =
    auth.status === 'authenticated'
      ? reviews.find((r) => r.submissionId === fileId && r.reviewer.id === auth.user.id)
      : undefined;

  return (
    <div className="flex w-full flex-col gap-4 self-start">
      <Link
        to={`/events/${encodeURIComponent(slug ?? '')}?tab=reviews`}
        className="text-muted-foreground inline-flex w-fit items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" /> Back to event
      </Link>

      <div className="divide-y rounded-md border">
        <div className="p-3">
          <SubmissionSummary submission={submission} />
        </div>

        <DetailCollapsible
          label="Submission"
          open={submissionOpen}
          onOpenChange={setSubmissionOpen}
        >
          <SubmissionDetail submission={submission} fileId={submission.fileId} hideHeading />
        </DetailCollapsible>

        {submission.chart && (
          <DetailCollapsible label="Chart" open={chartOpen} onOpenChange={setChartOpen}>
            <ChartDetail chart={submission.chart} hideHeading />
          </DetailCollapsible>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span>
                <span className="text-muted-foreground">Reviews:</span> {stats?.reviewCount ?? 0}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground">Avg. rating:</span>
                <RatingCell value={stats?.avgRating ?? null} />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground">Min:</span>
                <RatingCell value={stats?.minRating ?? null} />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground">Max:</span>
                <RatingCell value={stats?.maxRating ?? null} />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground">Stdev:</span>
                <StdevCell value={stats?.stdevRating ?? null} />
              </span>
            </div>
            {submission.chart && (
              <Button onClick={() => setReviewModalOpen(true)}>
                {ownReview ? <SquareCheck /> : <SquarePen />}
                {ownReview ? 'Edit your review' : 'Add a review'}
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {reviews.length === 0 && (
              <p className="text-muted-foreground text-sm">No reviews yet for this chart.</p>
            )}
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} eventSlug={slug ?? ''} />
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {slug && fileId && (
            <CommentsPanel slug={slug} fileId={fileId} reviewRevisions={reviewRevisions} />
          )}
        </div>
      </div>

      {reviewModalOpen && slug && fileId && (
        <ReviewModal
          eventSlug={slug}
          fileId={fileId}
          onClose={() => setReviewModalOpen(false)}
          onSaved={detail.refetch}
        />
      )}
    </div>
  );
}
