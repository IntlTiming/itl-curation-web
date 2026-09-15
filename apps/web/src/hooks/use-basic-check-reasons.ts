import { useCallback, useEffect, useState } from 'react';

export type BasicCheckLevel = 'WARNING' | 'DISQUALIFIED';

export type BasicCheckReason = {
  id: string;
  code: string;
  label: string;
  description: string;
  level: BasicCheckLevel;
};

export type BasicCheckReasonsState =
  { status: 'loading' } | { status: 'error' } | { status: 'loaded'; reasons: BasicCheckReason[] };

export function useBasicCheckReasons(slug: string) {
  const [state, setState] = useState<BasicCheckReasonsState>({ status: 'loading' });

  const refetch = useCallback(() => {
    setState((prev) => (prev.status === 'loaded' ? prev : { status: 'loading' }));
    fetch(`/api/events/${encodeURIComponent(slug)}/basic-check-reasons`)
      .then((res) => (res.ok ? (res.json() as Promise<BasicCheckReason[]>) : Promise.reject()))
      .then((reasons) => setState({ status: 'loaded', reasons }))
      .catch(() => setState({ status: 'error' }));
  }, [slug]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
