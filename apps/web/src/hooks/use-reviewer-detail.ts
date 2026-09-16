import { useCallback, useEffect, useState } from 'react';
import type { Reviewer } from '@/hooks/use-reviewers';
import type { BasicCheckLevel } from '@/hooks/use-basic-check-reasons';

export type ReviewerRecentReview = {
  id: string;
  submissionId: string;
  chartTitle: string;
  chartTitleRomaji: string;
  chartArtist: string;
  chartArtistRomaji: string;
  chartPlaystyle: string;
  chartDifficulty: string;
  chartMeter: number;
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
  // True when review.chartHash no longer matches the submission's current chart hash (the
  // chart was re-parsed/changed since this review was written) - same concept as
  // SubmissionDetailReview.isStale.
  isStale: boolean;
};

export type ReviewerRecentComment = {
  id: string;
  submissionId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
  // True when the comment's chartHash no longer matches the submission's current chart hash.
  isStale: boolean;
  // Comment has no chart-identity snapshot of its own (unlike Review) - null when the
  // submission's chart has since been deleted or never parsed.
  chart: {
    title: string;
    titleRomaji: string;
    artist: string;
    artistRomaji: string;
    playstyle: string;
    difficulty: string;
    meter: number;
  } | null;
};

// rating null means "reviewed but left the rating blank" - a distinct bucket from every
// RATING_OPTIONS value, not folded into any of them. counts[i] pairs with meters[i] in the
// enclosing RatingMeterTable; total is the row's sum across every meter.
export type RatingMeterRow = { rating: number | null; counts: number[]; total: number };
// meters is only the meters this reviewer has actually rated within this playstyle, ascending.
// columnTotals/grandTotal pair with meters the same way a spreadsheet's totals row would.
export type RatingMeterTable = {
  meters: number[];
  rows: RatingMeterRow[];
  columnTotals: number[];
  grandTotal: number;
};
export type RatingBreakdownByPlaystyle = { SINGLE: RatingMeterTable; DOUBLE: RatingMeterTable };

// Coverage split by chart.playstyle (parsed), same convention as reviewedCount/reviewableCount
// on the backend - reviewableCount is the same denominator for every reviewer in the event,
// reviewedCount is this reviewer's own count within that playstyle.
export type PlaystyleCoverage = { reviewedCount: number; reviewableCount: number };
export type CoverageByPlaystyle = { SINGLE: PlaystyleCoverage; DOUBLE: PlaystyleCoverage };

export type ReviewerDetailResponse = Reviewer & {
  recentReviews: ReviewerRecentReview[];
  recentComments: ReviewerRecentComment[];
  ratingBreakdown: RatingBreakdownByPlaystyle;
  coverageByPlaystyle: CoverageByPlaystyle;
  // Average |this reviewer's rating - the average of every OTHER reviewer's rating on that same
  // chart| across their own rated reviews - null when there's no comparison data at all (e.g.
  // every chart they rated was a solo review). consensusSampleCount is how many of their rated
  // reviews actually had another rated reviewer to compare against, which can be less than
  // reviewCount.
  consensusDeviation: number | null;
  consensusSampleCount: number;
};

export type ReviewerDetailState =
  | { status: 'loading' }
  | { status: 'error'; notFound: boolean }
  | ({ status: 'loaded' } & ReviewerDetailResponse);

export function useReviewerDetail(slug: string, userId: string) {
  const [state, setState] = useState<ReviewerDetailState>({ status: 'loading' });

  const refetch = useCallback(() => {
    fetch(`/api/events/${encodeURIComponent(slug)}/user/${encodeURIComponent(userId)}`)
      .then((res) => {
        if (res.ok) return res.json() as Promise<ReviewerDetailResponse>;
        return Promise.reject(res.status === 404);
      })
      .then((data) => setState({ status: 'loaded', ...data }))
      .catch((notFound) => setState({ status: 'error', notFound: notFound === true }));
  }, [slug, userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
