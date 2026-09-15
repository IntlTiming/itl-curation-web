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

export type ReviewsRow = {
  fileId: string;
  submitter: string;
  stepartist: string;
  pack: string;
  cmodPreference: 'CMOD_OKAY' | 'NO_CMOD' | 'NOT_STEPARTIST';
  consentToPublicReview: 'CONSENTS' | 'DOES_NOT_CONSENT' | 'NOT_STEPARTIST' | null;
  isIgnored: boolean;
  chart: ReviewsChart;
  reviewCount: number;
  avgRating: number | null;
  minRating: number | null;
  maxRating: number | null;
  stdevRating: number | null;
  // Whether the current user already has a review on this exact submission (by fileId) - lets
  // the Add/Edit icon distinguish the two states.
  hasOwnReview: boolean;
};

export type ReviewsMeterBounds = { min: number; max: number } | null;

type ReviewsResponse = {
  rows: ReviewsRow[];
  meterBounds: ReviewsMeterBounds;
  totalCount: number;
};

export type ReviewsState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'loaded';
      rows: ReviewsRow[];
      meterBounds: ReviewsMeterBounds;
      totalCount: number;
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
      .then(({ rows, meterBounds, totalCount }) =>
        setState({ status: 'loaded', rows, meterBounds, totalCount }),
      )
      .catch(() => setState({ status: 'error' }));
  }, [slug, filters]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
