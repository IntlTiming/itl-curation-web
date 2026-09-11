import { useCallback, useEffect, useState } from 'react';

export type SubmissionChart = {
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
  minBpm: number;
  maxBpm: number;
  totalSteps: number;
  totalRolls: number;
  totalHolds: number;
  totalMines: number;
  totalJumps: number;
  lengthSeconds: number;
  totalMeasures: number;
  totalBreakMeasures: number;
  totalStreamMeasures: number;
  totalTrueStreamMeasures: number;
  weightedNps: number;
  hasSignificantTimingChanges: boolean;
  bracketCount: number | null;
  halfCrossoverCount: number | null;
  fullCrossoverCount: number | null;
  crossoverCount: number | null;
  downFootswitchCount: number | null;
  upFootswitchCount: number | null;
  footswitchCount: number | null;
  doublestepCount: number | null;
  jackCount: number | null;
  sideswitchCount: number | null;
};

export type Submission = {
  fileId: string;
  stepartist: string;
  submitter: string;
  pack: string;
  playstyle: 'SINGLE' | 'DOUBLE';
  difficulty: 'BEGINNER' | 'EASY' | 'MEDIUM' | 'HARD' | 'CHALLENGE';
  focus: string;
  derivedFocus: string;
  cmodPreference: string;
  releaseYear: string;
  theme: string;
  additionalNotes: string;
  consentToPublicReview: string | null;
  fileUrl: string;
  driveMd5: string;
  songDir: string | null;
  bannerSlug: string;
  isInternal: boolean;
  isIgnored: boolean;
  submittedAt: string;
  processingError: string | null;
  techTags: string[];
  singleTechTag: string | null;
  chart: SubmissionChart | null;
};

export type SubmissionsState =
  { status: 'loading' } | { status: 'error' } | { status: 'loaded'; submissions: Submission[] };

export function useSubmissions(slug: string) {
  const [state, setState] = useState<SubmissionsState>({ status: 'loading' });

  const refetch = useCallback(() => {
    fetch(`/api/events/${encodeURIComponent(slug)}/submissions`)
      .then((res) => (res.ok ? (res.json() as Promise<Submission[]>) : Promise.reject()))
      .then((submissions) => setState({ status: 'loaded', submissions }))
      .catch(() => setState({ status: 'error' }));
  }, [slug]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
