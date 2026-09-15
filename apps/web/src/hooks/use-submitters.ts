import { useCallback, useEffect, useState } from 'react';

export type Submitter = {
  submitter: string;
  lowers: number;
  uppers: number;
  doubles: number;
  ignored: number;
  errored: number;
};

export type SubmittersState =
  { status: 'loading' } | { status: 'error' } | { status: 'loaded'; submitters: Submitter[] };

export function useSubmitters(slug: string) {
  const [state, setState] = useState<SubmittersState>({ status: 'loading' });

  const refetch = useCallback(() => {
    fetch(`/api/events/${encodeURIComponent(slug)}/submitters`)
      .then((res) => (res.ok ? (res.json() as Promise<Submitter[]>) : Promise.reject()))
      .then((submitters) => setState({ status: 'loaded', submitters }))
      .catch(() => setState({ status: 'error' }));
  }, [slug]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
