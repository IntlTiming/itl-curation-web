import { useCallback, useEffect, useState } from 'react';
import type { ChartFields } from '@/components/chart-detail';
import type { SubmissionFields } from '@/components/submission-detail';
import type { BasicCheckLevel } from '@/hooks/use-basic-check-reasons';

export type SubmissionDetailSubmission = SubmissionFields & {
  fileId: string;
  chart: ChartFields | null;
};

export type SubmissionDetailReview = {
  id: string;
  submissionId: string;
  reviewer: {
    id: string;
    displayName: string;
    discordId: string;
    discordAvatarHash: string | null;
  };
  rating: number | null;
  passing: number | null;
  scoring: number | null;
  notes: string | null;
  basicChecks: {
    id: string;
    code: string;
    label: string;
    level: BasicCheckLevel;
    note: string | null;
  }[];
  createdAt: string;
  updatedAt: string;
  // True when this review is about a DIFFERENT submission that happens to share the current
  // chart's hash - see prisma/schema.prisma's file header on chart identity.
  isFromDifferentSubmission: boolean;
  // True when review.chartHash no longer matches the chart's current hash (the chart was
  // re-parsed/changed since this review was written).
  isStale: boolean;
};

export type SubmissionDetailStats = {
  reviewCount: number;
  avgRating: number | null;
  minRating: number | null;
  maxRating: number | null;
  stdevRating: number | null;
};

export type ReviewRevisionEntryContent = {
  rating: number | null;
  passing: number | null;
  scoring: number | null;
  notes: string | null;
  basicChecks: {
    id: string;
    code: string;
    label: string;
    level: BasicCheckLevel;
    note: string | null;
  }[];
};

// One historical state in a review's edit chain - see submissions.service.ts's
// buildReviewRevisionEntries for how this is reconstructed server-side. An unedited review
// (never revised) still contributes one "submitted" entry with showDetails: false, so it appears
// in the comments feed without duplicating values already shown on its live Reviews-column card.
export type ReviewRevisionEntry = {
  id: string;
  kind: 'submitted' | 'updated';
  reviewId: string;
  submissionId: string;
  reviewer: {
    id: string;
    displayName: string;
    discordId: string;
    discordAvatarHash: string | null;
  };
  content: ReviewRevisionEntryContent;
  timestamp: string;
  chartHash: string;
  isStale: boolean;
  showDetails: boolean;
};

export type SubmissionDetailResponse = {
  submission: SubmissionDetailSubmission;
  reviews: SubmissionDetailReview[];
  reviewRevisions: ReviewRevisionEntry[];
  stats: SubmissionDetailStats | null;
};

export type SubmissionDetailState =
  | { status: 'loading' }
  | { status: 'error'; notFound: boolean }
  | ({ status: 'loaded' } & SubmissionDetailResponse);

export function useSubmissionDetail(slug: string, fileId: string) {
  const [state, setState] = useState<SubmissionDetailState>({ status: 'loading' });

  const refetch = useCallback(() => {
    fetch(`/api/events/${encodeURIComponent(slug)}/submissions/${encodeURIComponent(fileId)}`)
      .then((res) => {
        if (res.ok) return res.json() as Promise<SubmissionDetailResponse>;
        return Promise.reject(res.status === 404);
      })
      .then((data) => setState({ status: 'loaded', ...data }))
      .catch((notFound) => setState({ status: 'error', notFound: notFound === true }));
  }, [slug, fileId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
