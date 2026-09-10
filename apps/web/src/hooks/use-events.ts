import { useCallback, useEffect, useState } from 'react'

export type Event = {
  id: string
  slug: string
  name: string
  date: string | null
  createdAt: string
  updatedAt: string
}

export type EventsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; events: Event[] }

export function useEvents() {
  const [state, setState] = useState<EventsState>({ status: 'loading' })

  const refetch = useCallback(() => {
    fetch('/api/events')
      .then((res) => (res.ok ? (res.json() as Promise<Event[]>) : Promise.reject()))
      .then((events) => setState({ status: 'loaded', events }))
      .catch(() => setState({ status: 'error' }))
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { ...state, refetch }
}
