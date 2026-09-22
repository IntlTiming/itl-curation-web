import { useCallback, useEffect, useState } from 'react';

export type Reviewer = {
  userId: string;
  discordId: string;
  discordUsername: string;
  displayName: string | null;
  discordAvatarHash: string | null;
  // False when this person's EventRole was revoked after they'd already left review history
  // behind - CuratorsService.removeCurator deletes the EventRole row but never the Review rows.
  isCurrentMember: boolean;
  grantedAt: string | null;
  reviewCount: number;
  commentCount: number;
  avgRating: number | null;
  minRating: number | null;
  maxRating: number | null;
  lastActivity: string | null;
};

export type ReviewersState =
  { status: 'loading' } | { status: 'error' } | { status: 'loaded'; reviewers: Reviewer[] };

export function useReviewers(slug: string) {
  const [state, setState] = useState<ReviewersState>({ status: 'loading' });

  const refetch = useCallback(() => {
    fetch(`/api/events/${encodeURIComponent(slug)}/reviewers`)
      .then((res) => (res.ok ? (res.json() as Promise<Reviewer[]>) : Promise.reject()))
      .then((reviewers) => setState({ status: 'loaded', reviewers }))
      .catch(() => setState({ status: 'error' }));
  }, [slug]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
