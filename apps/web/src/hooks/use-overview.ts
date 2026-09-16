import { useCallback, useEffect, useState } from 'react';

export type Playstyle = 'SINGLE' | 'DOUBLE';

export type MeterCoverageRow = {
  playstyle: Playstyle;
  meter: number;
  reviewableCount: number;
  reviewedCount: number;
};

export type CategoryCountRow = {
  playstyle: Playstyle;
  meter: number;
  category: string;
  count: number;
};

export type OverviewResponse = {
  coverageByMeter: MeterCoverageRow[];
  focusBreakdown: CategoryCountRow[];
  derivedFocusBreakdown: CategoryCountRow[];
};

export type OverviewState =
  { status: 'loading' } | { status: 'error' } | ({ status: 'loaded' } & OverviewResponse);

export function useOverview(slug: string) {
  const [state, setState] = useState<OverviewState>({ status: 'loading' });

  const refetch = useCallback(() => {
    fetch(`/api/events/${encodeURIComponent(slug)}/overview`)
      .then((res) => (res.ok ? (res.json() as Promise<OverviewResponse>) : Promise.reject()))
      .then((data) => setState({ status: 'loaded', ...data }))
      .catch(() => setState({ status: 'error' }));
  }, [slug]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
