import { useCallback, useEffect, useState } from 'react';

export type OrphanedReviewCandidate = {
  fileId: string;
  stepartist: string;
  pack: string;
  submitter: string;
  // Whether this candidate shares the orphaned submission's own `submitter` - the strongest
  // signal that this is the actual resubmission (see orphaned-reviews.service.ts).
  sameSubmitter: boolean;
  chart: {
    hash: string;
    title: string;
    titleRomaji: string;
    artist: string;
    artistRomaji: string;
    playstyle: 'SINGLE' | 'DOUBLE';
    difficulty: 'BEGINNER' | 'EASY' | 'MEDIUM' | 'HARD' | 'CHALLENGE';
    meter: number;
  };
};

export type OrphanedReview = {
  id: string;
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
  createdAt: string;
  updatedAt: string;
  chartHash: string;
  chart: {
    title: string;
    titleRomaji: string;
    artist: string;
    artistRomaji: string;
    playstyle: 'SINGLE' | 'DOUBLE';
    difficulty: 'BEGINNER' | 'EASY' | 'MEDIUM' | 'HARD' | 'CHALLENGE';
    meter: number;
  };
};

export type OrphanedReviewGroup = {
  submission: {
    fileId: string;
    stepartist: string;
    pack: string;
    submitter: string;
    submittedAt: string;
  };
  reviews: OrphanedReview[];
  candidates: OrphanedReviewCandidate[];
};

export type OrphanedReviewsState =
  { status: 'loading' } | { status: 'error' } | { status: 'loaded'; groups: OrphanedReviewGroup[] };

function orphanedReviewsUrl(slug: string): string {
  return `/api/events/${encodeURIComponent(slug)}/orphaned-reviews`;
}

export function useOrphanedReviews(slug: string) {
  const [state, setState] = useState<OrphanedReviewsState>({ status: 'loading' });

  const refetch = useCallback(() => {
    setState((prev) => (prev.status === 'loaded' ? prev : { status: 'loading' }));
    fetch(orphanedReviewsUrl(slug))
      .then((res) => (res.ok ? (res.json() as Promise<OrphanedReviewGroup[]>) : Promise.reject()))
      .then((groups) => setState({ status: 'loaded', groups }))
      .catch(() => setState({ status: 'error' }));
  }, [slug]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function relink(reviewId: string, targetFileId: string): Promise<void> {
    const res = await fetch(`${orphanedReviewsUrl(slug)}/${encodeURIComponent(reviewId)}/relink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetFileId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message ?? 'Failed to relink review');
    }
    refetch();
  }

  async function searchCandidates(query: string): Promise<OrphanedReviewCandidate[]> {
    const res = await fetch(
      `${orphanedReviewsUrl(slug)}/search-submissions?q=${encodeURIComponent(query)}`,
    );
    if (!res.ok) return [];
    return res.json() as Promise<OrphanedReviewCandidate[]>;
  }

  return { ...state, refetch, relink, searchCandidates };
}
