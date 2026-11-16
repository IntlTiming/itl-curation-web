import { useCallback, useEffect, useState } from 'react';
import type { BasicCheckLevel } from '@/hooks/use-basic-check-reasons';
import type {
  ReviewRevisionFeedEntry,
  SubmissionDetailReview,
} from '@/hooks/use-submission-detail';

export type ConsentToPublicReview = 'CONSENTS' | 'DOES_NOT_CONSENT' | 'NOT_STEPARTIST';

export type LinkedSubmissionSummary = {
  fileId: string;
  stepartist: string;
  title: string | null;
};

type SuggestionFields = {
  position: number; // 1-indexed position in suggestions.json - the suggestion's identity
  submittedAt: string;
  submitter: string;
  chart: string; // free text
  reason: string;
  link: string; // "" when blank
  consentToPublicReview: ConsentToPublicReview | null;
  linkedSubmission: LinkedSubmissionSummary | null;
};

export type SuggestionRow = SuggestionFields & {
  reviewCount: number;
  avgRating: number | null;
  minRating: number | null;
  maxRating: number | null;
  stdevRating: number | null;
  hasOwnReview: boolean;
  commentCount: number;
  lastActivity: string | null;
  basicChecks: { id: string; code: string; label: string; level: BasicCheckLevel }[];
  hasWarning: boolean;
  hasDisqualification: boolean;
};

export type SuggestionDetail = SuggestionFields & {
  linkedAt: string | null;
  linkedBy: { id: string; displayName: string } | null;
};

export type SuggestionReview = Omit<SubmissionDetailReview, 'submissionId' | 'chartHash'>;

export type SuggestionDetailResponse = {
  suggestion: SuggestionDetail;
  reviews: SuggestionReview[];
  reviewRevisions: ReviewRevisionFeedEntry[];
  stats: {
    reviewCount: number;
    avgRating: number | null;
    minRating: number | null;
    maxRating: number | null;
    stdevRating: number | null;
  };
};

export function suggestionsUrl(slug: string): string {
  return `/api/events/${encodeURIComponent(slug)}/suggestions`;
}

export function useSuggestions(slug: string) {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'error' } | { status: 'loaded'; suggestions: SuggestionRow[] }
  >({ status: 'loading' });

  const refetch = useCallback(() => {
    fetch(suggestionsUrl(slug))
      .then((res) => (res.ok ? (res.json() as Promise<SuggestionRow[]>) : Promise.reject()))
      .then((suggestions) => setState({ status: 'loaded', suggestions }))
      .catch(() => setState({ status: 'error' }));
  }, [slug]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}

export function useSuggestionDetail(slug: string, position: number) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; notFound: boolean }
    | ({ status: 'loaded' } & SuggestionDetailResponse)
  >({ status: 'loading' });

  const refetch = useCallback(() => {
    fetch(`${suggestionsUrl(slug)}/${position}`)
      .then((res) => {
        if (res.ok) return res.json() as Promise<SuggestionDetailResponse>;
        return Promise.reject(res.status === 404 || res.status === 400);
      })
      .then((data) => setState({ status: 'loaded', ...data }))
      .catch((notFound) => setState({ status: 'error', notFound: notFound === true }));
  }, [slug, position]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
