import { useCallback, useEffect, useState } from 'react';

export type AccessRequest = {
  userId: string;
  discordId: string;
  discordUsername: string;
  displayName: string | null;
  discordAvatarHash: string | null;
  requestedAt: string;
};

export type AccessRequestsState =
  { status: 'loading' } | { status: 'error' } | { status: 'loaded'; requests: AccessRequest[] };

function accessRequestsUrl(slug: string): string {
  return `/api/events/${encodeURIComponent(slug)}/access-requests`;
}

// Admin side of the access-request flow (list/approve/deny) - the requester's own
// request/revoke actions are simple enough to inline directly where they're used
// (event-detail.tsx's Request-access card).
export function useAccessRequests(slug: string) {
  const [state, setState] = useState<AccessRequestsState>({ status: 'loading' });

  const refetch = useCallback(() => {
    fetch(accessRequestsUrl(slug))
      .then((res) => (res.ok ? (res.json() as Promise<AccessRequest[]>) : Promise.reject()))
      .then((requests) => setState({ status: 'loaded', requests }))
      .catch(() => setState({ status: 'error' }));
  }, [slug]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function approve(userId: string): Promise<void> {
    const res = await fetch(`${accessRequestsUrl(slug)}/${encodeURIComponent(userId)}/approve`, {
      method: 'POST',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message ?? 'Failed to approve request');
    }
    refetch();
  }

  async function deny(userId: string): Promise<void> {
    const res = await fetch(`${accessRequestsUrl(slug)}/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message ?? 'Failed to deny request');
    }
    refetch();
  }

  return { ...state, refetch, approve, deny };
}
