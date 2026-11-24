import { useCallback, useEffect, useState } from 'react';
import type { Playstyle } from '@/hooks/use-overview';

export type SelectionSummaryRow = {
  playstyle: Playstyle;
  meter: number;
  derivedFocus: string;
  count: number;
};

export type SelectionSummaryResponse = {
  rows: SelectionSummaryRow[];
  // Selected submissions left out of `rows` (ignored, or no parsed chart to bucket by meter).
  excludedCount: number;
};

export type SelectionSummaryState =
  { status: 'loading' } | { status: 'error' } | ({ status: 'loaded' } & SelectionSummaryResponse);

export function useSelectionsSummary(slug: string) {
  const [state, setState] = useState<SelectionSummaryState>({ status: 'loading' });

  const refetch = useCallback(() => {
    fetch(`/api/events/${encodeURIComponent(slug)}/selections/summary`)
      .then((res) =>
        res.ok ? (res.json() as Promise<SelectionSummaryResponse>) : Promise.reject(),
      )
      .then((data) => setState({ status: 'loaded', ...data }))
      .catch(() => setState({ status: 'error' }));
  }, [slug]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
