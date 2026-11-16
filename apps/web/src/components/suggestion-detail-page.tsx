import { format } from 'date-fns';
import { ArrowLeft, Link2, Link2Off, Search, SquareCheck, SquarePen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CommentsPanel } from '@/components/comments-panel';
import { Loading } from '@/components/loading';
import { CandidateRow } from '@/components/orphaned-reviews-panel';
import { RatingCell, StdevCell } from '@/components/reviews-table';
import { ReviewCard } from '@/components/submission-detail-page';
import { SuggestionReviewModal, SuggestionSummary } from '@/components/suggestion-review-modal';
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
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { usePageBreadcrumb } from '@/hooks/use-breadcrumb';
import { suggestionCommentsUrl } from '@/hooks/use-comments';
import { useEvent } from '@/hooks/use-event';
import type { OrphanedReviewCandidate } from '@/hooks/use-orphaned-reviews';
import { usePageTitle } from '@/hooks/use-page-title';
import { suggestionsUrl, useSuggestionDetail } from '@/hooks/use-suggestions';

const SEARCH_DEBOUNCE_MS = 300;

type LinkResult = { copied: number; skipped: { id: string; displayName: string }[] };

// Search -> pick -> confirm -> result. The admin-only search endpoint returns the same candidate
// shape as the Orphaned Reviews relink picker, so its row component is reused as-is.
function LinkToSubmissionDialog({
  eventSlug,
  position,
  reviewCount,
  onClose,
  onLinked,
}: {
  eventSlug: string;
  position: number;
  reviewCount: number;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OrphanedReviewCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<OrphanedReviewCandidate | null>(null);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LinkResult | null>(null);

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
      fetch(`${suggestionsUrl(eventSlug)}/search-submissions?q=${encodeURIComponent(trimmed)}`)
        .then((res) => (res.ok ? (res.json() as Promise<OrphanedReviewCandidate[]>) : []))
        .then((found) => {
          if (!cancelled) setResults(found);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, eventSlug]);

  async function handleLink() {
    if (!selected) return;
    setLinking(true);
    setError(null);
    try {
      const res = await fetch(`${suggestionsUrl(eventSlug)}/${position}/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: selected.fileId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? 'Failed to link suggestion');
      setResult(body as LinkResult);
      onLinked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link suggestion');
    } finally {
      setLinking(false);
    }
  }

  const selectedTitle = selected ? selected.chart.titleRomaji || selected.chart.title : null;

  return (
    <Dialog open onOpenChange={(open) => !open && !linking && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link to submission</DialogTitle>
          <DialogDescription>
            Copies this suggestion's {reviewCount} review{reviewCount === 1 ? '' : 's'} (with basic
            checks and revision history) onto the submission as independent submission reviews. A
            reviewer who already reviewed that submission keeps their existing review. The
            suggestion becomes read-only afterward.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>
              Linked to <span className="font-medium">{selectedTitle}</span>. Copied {result.copied}{' '}
              review{result.copied === 1 ? '' : 's'}.
            </p>
            {result.skipped.length > 0 && (
              <p className="text-muted-foreground">
                Skipped (already reviewed that submission):{' '}
                {result.skipped.map((r) => r.displayName).join(', ')}
              </p>
            )}
          </div>
        ) : selected ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>Link suggestion #{position} to:</p>
            <div className="rounded-md border">
              <CandidateRow candidate={selected} disabled onSelect={() => {}} />
            </div>
            {error && <p className="text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
              <Input
                autoFocus
                placeholder="Search submissions by title, artist, stepartist…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-7"
              />
            </div>
            <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
              {searching && <p className="text-muted-foreground px-2 text-xs">Searching…</p>}
              {!searching && query.trim() !== '' && results.length === 0 && (
                <p className="text-muted-foreground px-2 text-xs">No matching submissions.</p>
              )}
              {results.map((candidate) => (
                <CandidateRow
                  key={candidate.fileId}
                  candidate={candidate}
                  disabled={false}
                  onSelect={() => setSelected(candidate)}
                />
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={onClose}>Done</Button>
          ) : selected ? (
            <>
              <Button variant="outline" disabled={linking} onClick={() => setSelected(null)}>
                Back
              </Button>
              <Button disabled={linking} onClick={handleLink}>
                {linking ? 'Linking…' : 'Link and copy reviews'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SuggestionDetailPage() {
  const params = useParams<{ slug: string; position: string }>();
  const slug = params.slug ?? '';
  const position = Number(params.position);
  const auth = useAuth();
  const event = useEvent(slug);
  const detail = useSuggestionDetail(slug, position);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [confirmUnlinkOpen, setConfirmUnlinkOpen] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);

  const label = detail.status === 'loaded' ? detail.suggestion.chart : null;
  usePageBreadcrumb(
    event.status === 'loaded' && label
      ? [{ label: event.event.name, to: `/events/${slug}?tab=suggestions` }, { label }]
      : [],
  );
  usePageTitle(
    event.status === 'loaded' && label ? `${label} - Suggestion - ${event.event.name}` : null,
  );

  if (detail.status === 'loading') return <Loading message="Loading suggestion…" />;

  if (detail.status === 'error') {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {detail.notFound ? 'Suggestion not found' : "Couldn't load suggestion"}
          </CardTitle>
          <CardDescription>
            {detail.notFound
              ? "This suggestion doesn't exist, or you don't have access to it."
              : 'Try refreshing.'}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { suggestion, reviews, reviewRevisions, stats } = detail;
  const isAdmin = event.status === 'loaded' && event.event.isEventAdmin;
  const isLinked = suggestion.linkedSubmission !== null;
  const ownReview =
    auth.status === 'authenticated'
      ? reviews.find((r) => r.reviewer.id === auth.user.id)
      : undefined;
  const canReview = !isLinked;

  async function handleUnlink() {
    setUnlinkError(null);
    const res = await fetch(`${suggestionsUrl(slug)}/${position}/link`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setUnlinkError(body?.message ?? 'Failed to unlink');
      return;
    }
    detail.refetch();
  }

  return (
    <div className="flex w-full flex-col gap-4 self-start">
      <Link
        to={`/events/${encodeURIComponent(slug)}?tab=suggestions`}
        className="text-muted-foreground inline-flex w-fit items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" /> Back to event
      </Link>

      {suggestion.linkedSubmission && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-sky-500/40 bg-sky-50 p-3 text-sm dark:bg-sky-500/10">
          <Link2 className="size-4 shrink-0 text-sky-700 dark:text-sky-400" />
          <span>
            Linked to{' '}
            <Link
              to={`/events/${encodeURIComponent(slug)}/submissions/${encodeURIComponent(suggestion.linkedSubmission.fileId)}`}
              className="text-primary font-medium hover:underline"
            >
              {suggestion.linkedSubmission.title ?? suggestion.linkedSubmission.fileId}
            </Link>{' '}
            ({suggestion.linkedSubmission.stepartist})
            {suggestion.linkedBy && <> by {suggestion.linkedBy.displayName}</>}
            {suggestion.linkedAt && <> on {format(new Date(suggestion.linkedAt), 'PP')}</>}. This
            suggestion is read-only.
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3">
        <SuggestionSummary suggestion={suggestion} />
        {isAdmin &&
          (isLinked ? (
            <Button variant="outline" size="sm" onClick={() => setConfirmUnlinkOpen(true)}>
              <Link2Off /> Unlink
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setLinkDialogOpen(true)}>
              <Link2 /> Link to submission
            </Button>
          ))}
      </div>
      {unlinkError && <p className="text-destructive text-sm">{unlinkError}</p>}

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <span>
                <span className="text-muted-foreground">Reviews:</span> {stats.reviewCount}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground">Avg. rating:</span>
                <RatingCell value={stats.avgRating} />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground">Min:</span>
                <RatingCell value={stats.minRating} />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground">Max:</span>
                <RatingCell value={stats.maxRating} />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-muted-foreground">Stdev:</span>
                <StdevCell value={stats.stdevRating} />
              </span>
            </div>
            {canReview && (
              <Button onClick={() => setReviewModalOpen(true)}>
                {ownReview ? <SquareCheck /> : <SquarePen />}
                {ownReview ? 'Edit your review' : 'Add a review'}
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {reviews.length === 0 && (
              <p className="text-muted-foreground text-sm">No reviews yet for this suggestion.</p>
            )}
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} eventSlug={slug} />
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <CommentsPanel
            slug={slug}
            commentsUrl={suggestionCommentsUrl(slug, position)}
            reviewRevisions={reviewRevisions}
            readOnly={isLinked}
          />
        </div>
      </div>

      {reviewModalOpen && (
        <SuggestionReviewModal
          eventSlug={slug}
          position={position}
          onClose={() => setReviewModalOpen(false)}
          onSaved={detail.refetch}
        />
      )}

      {linkDialogOpen && (
        <LinkToSubmissionDialog
          eventSlug={slug}
          position={position}
          reviewCount={stats.reviewCount}
          onClose={() => setLinkDialogOpen(false)}
          onLinked={detail.refetch}
        />
      )}

      <AlertDialog open={confirmUnlinkOpen} onOpenChange={setConfirmUnlinkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink this suggestion?</AlertDialogTitle>
            <AlertDialogDescription>
              The suggestion becomes editable again. Reviews already copied onto the submission stay
              there - they're independent copies and are not removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlink}>Unlink</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
