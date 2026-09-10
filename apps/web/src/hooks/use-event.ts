import { useCallback, useEffect, useState } from 'react';
import type { Event } from '@/hooks/use-events';

export type EventDetail = Event & { isEventAdmin: boolean };

export type EventState =
  | { status: 'loading' }
  | { status: 'error'; notFound: boolean }
  | { status: 'loaded'; event: EventDetail };

export function useEvent(slug: string) {
  const [state, setState] = useState<EventState>({ status: 'loading' });

  const refetch = useCallback(() => {
    fetch(`/api/events/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (res.ok) return res.json() as Promise<EventDetail>;
        return Promise.reject(res.status === 404);
      })
      .then((event) => setState({ status: 'loaded', event }))
      .catch((notFound) => setState({ status: 'error', notFound: notFound === true }));
  }, [slug]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
