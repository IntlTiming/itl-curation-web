import { useCallback, useEffect, useState } from 'react';
import type { ReviewsFilters } from '@/hooks/use-reviews-filters';

export type ReviewsChart = {
  hash: string;
  title: string;
  titleRomaji: string;
  subtitle: string;
  subtitleRomaji: string;
  artist: string;
  artistRomaji: string;
  playstyle: 'SINGLE' | 'DOUBLE';
  difficulty: 'BEGINNER' | 'EASY' | 'MEDIUM' | 'HARD' | 'CHALLENGE';
  meter: number;
  hasSignificantTimingChanges: boolean;
};

// A union member of ReviewsRow.basicChecks - deduped by BasicCheckReason across every active
// review on the chart, so a reason two different reviewers both flagged appears once.
export type ReviewsBasicCheck = {
  id: string;
  code: string;
  label: string;
  level: 'WARNING' | 'DISQUALIFIED';
};

export type ReviewsRow = {
  fileId: string;
  submitter: string;
  stepartist: string;
  pack: string;
  cmodPreference: 'CMOD_OKAY' | 'NO_CMOD' | 'NOT_STEPARTIST';
  consentToPublicReview: 'CONSENTS' | 'DOES_NOT_CONSENT' | 'NOT_STEPARTIST' | null;
  isIgnored: boolean;
  // TechTag labels this submission has claimed - shortened to codes for display (see
  // @/lib/tech-tags's shortenTechTag).
  techTags: string[];
  chart: ReviewsChart;
  reviewCount: number;
  avgRating: number | null;
  minRating: number | null;
  maxRating: number | null;
  stdevRating: number | null;
  // Whether the current user already has a review on this exact submission (by fileId) - lets
  // the Add/Edit icon distinguish the two states.
  hasOwnReview: boolean;
  // Both submissionId-scoped, NOT chart-hash matched like every field above - see the
  // Comment model's schema comment for why comments never cross-match submissions.
  commentCount: number;
  lastActivity: string | null;
  // Union of every basic-check flag raised across all of this chart's active reviews, plus the
  // two booleans summarizing it for the Reviews table's row tint - DISQUALIFIED takes visual
  // precedence over WARNING when a chart has both.
  basicChecks: ReviewsBasicCheck[];
  hasWarning: boolean;
  hasDisqualification: boolean;
};

export type ReviewsMeterBounds = { min: number; max: number } | null;

type ReviewsResponse = {
  rows: ReviewsRow[];
  meterBounds: ReviewsMeterBounds;
  totalCount: number;
  // Distinct Submission.focus values available under every other active filter - populates the
  // Focus filter's checkbox list (see reviews.service.ts's focusOptions comment).
  focusOptions: string[];
};

export type ReviewsState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'loaded';
      rows: ReviewsRow[];
      meterBounds: ReviewsMeterBounds;
      totalCount: number;
      focusOptions: string[];
    };

function buildQueryString(filters: ReviewsFilters): string {
  const params = new URLSearchParams();
  const trimmedSearch = filters.search.trim();
  if (trimmedSearch) params.set('search', trimmedSearch);
  params.set('playstyle', filters.playstyle);
  if (filters.minMeter != null) params.set('minMeter', String(filters.minMeter));
  if (filters.maxMeter != null) params.set('maxMeter', String(filters.maxMeter));
  if (filters.unreviewedOnly) params.set('unreviewedOnly', 'true');
  if (filters.publiclyReviewableOnly) params.set('publiclyReviewableOnly', 'true');
  if (filters.techTags.length > 0) params.set('techTags', filters.techTags.join(','));
  if (filters.focus.length > 0) params.set('focus', filters.focus.join(','));
  return params.toString();
}

export function useReviews(slug: string, filters: ReviewsFilters) {
  const [state, setState] = useState<ReviewsState>({ status: 'loading' });

  const refetch = useCallback(() => {
    // Keep showing the previous rows/meterBounds while a filter-change-triggered refetch is
    // in flight, rather than collapsing to a bare loading state - blanking meterBounds mid-
    // fetch would disable and reset the meter range controls on every single filter tweak,
    // including on the very meter-range edit that triggered the refetch. Only the very first
    // load (no prior data yet) shows the loading message.
    setState((prev) => (prev.status === 'loaded' ? prev : { status: 'loading' }));
    fetch(`/api/events/${encodeURIComponent(slug)}/reviews?${buildQueryString(filters)}`)
      .then((res) => (res.ok ? (res.json() as Promise<ReviewsResponse>) : Promise.reject()))
      .then(({ rows, meterBounds, totalCount, focusOptions }) =>
        setState({ status: 'loaded', rows, meterBounds, totalCount, focusOptions }),
      )
      .catch(() => setState({ status: 'error' }));
  }, [slug, filters]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
