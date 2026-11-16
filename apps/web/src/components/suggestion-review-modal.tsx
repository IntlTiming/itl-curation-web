import { ExternalLink } from 'lucide-react';
import { ReviewDialog, type ReviewDialogLoad } from '@/components/review-modal';
import { PublicConsentIndicator } from '@/components/reviews-table';
import { formatTimestamp } from '@/components/submission-row';
import {
  suggestionsUrl,
  useSuggestionDetail,
  type SuggestionDetail,
} from '@/hooks/use-suggestions';
import { toExternalHref } from '@/lib/external-link';

// Free text from the suggestion form - only rendered as a link when it's a usable http(s) URL
// (see toExternalHref); anything else is shown as plain text.
function SuggestionLink({ link }: { link: string }) {
  const href = toExternalHref(link);
  if (!href) {
    return <span className="text-xs break-all">{link}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary inline-flex w-fit items-center gap-1 text-xs break-all hover:underline"
    >
      <ExternalLink className="size-3 shrink-0" />
      {href}
    </a>
  );
}

// The read-only context block shown above the review form and on the detail page - a
// suggestion is just these few free-text fields, with no parsed chart behind them.
export function SuggestionSummary({ suggestion }: { suggestion: SuggestionDetail }) {
  return (
    <div className="flex flex-col gap-1.5 text-left text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-muted-foreground tabular-nums">#{suggestion.position}</span>
        <span className="font-medium">{suggestion.chart}</span>
        <PublicConsentIndicator
          submitter={suggestion.submitter}
          consentToPublicReview={suggestion.consentToPublicReview}
        />
      </div>
      <div className="text-muted-foreground text-xs">
        <span className="font-semibold">Suggested by:</span> {suggestion.submitter} on{' '}
        {formatTimestamp(suggestion.submittedAt)}
      </div>
      {suggestion.link.trim() && <SuggestionLink link={suggestion.link} />}
      {suggestion.reason && (
        <div className="text-xs">
          <span className="text-muted-foreground font-semibold">Reason:</span>{' '}
          {/* Plain text straight from the suggestion form - not markdown. */}
          <span className="whitespace-pre-wrap">{suggestion.reason}</span>
        </div>
      )}
    </div>
  );
}

export function SuggestionReviewModal({
  eventSlug,
  position,
  onClose,
  onSaved,
}: {
  eventSlug: string;
  position: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const detail = useSuggestionDetail(eventSlug, position);

  const load: ReviewDialogLoad =
    detail.status === 'loaded'
      ? { status: 'loaded', reviews: detail.reviews }
      : detail.status === 'error'
        ? {
            status: 'error',
            message: detail.notFound ? 'Suggestion not found.' : "Couldn't load suggestion.",
          }
        : { status: 'loading' };

  return (
    <ReviewDialog
      eventSlug={eventSlug}
      load={load}
      submitUrl={`${suggestionsUrl(eventSlug)}/${position}/review`}
      onClose={onClose}
      onSaved={onSaved}
      title={
        detail.status === 'loaded'
          ? `Review suggestion: ${detail.suggestion.chart}`
          : 'Review suggestion'
      }
      context={detail.status === 'loaded' && <SuggestionSummary suggestion={detail.suggestion} />}
    />
  );
}
