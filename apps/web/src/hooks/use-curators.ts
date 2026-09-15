import { useCallback, useEffect, useState } from 'react';

export type Curator = {
  userId: string;
  discordId: string;
  discordUsername: string;
  displayName: string | null;
  discordAvatarHash: string | null;
  isAdmin: boolean;
  grantedAt: string;
};

export type CuratorsState =
  { status: 'loading' } | { status: 'error' } | { status: 'loaded'; curators: Curator[] };

function curatorsUrl(slug: string): string {
  return `/api/events/${encodeURIComponent(slug)}/curators`;
}

export function useCurators(slug: string) {
  const [state, setState] = useState<CuratorsState>({ status: 'loading' });

  const refetch = useCallback(() => {
    fetch(curatorsUrl(slug))
      .then((res) => (res.ok ? (res.json() as Promise<Curator[]>) : Promise.reject()))
      .then((curators) => setState({ status: 'loaded', curators }))
      .catch(() => setState({ status: 'error' }));
  }, [slug]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function addCurator(userId: string): Promise<void> {
    const res = await fetch(curatorsUrl(slug), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message ?? 'Failed to add curator');
    }
    refetch();
  }

  async function removeCurator(userId: string): Promise<void> {
    const res = await fetch(`${curatorsUrl(slug)}/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message ?? 'Failed to remove curator');
    }
    refetch();
  }

  async function setCuratorAdmin(userId: string, isAdmin: boolean): Promise<void> {
    const res = await fetch(`${curatorsUrl(slug)}/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAdmin }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message ?? 'Failed to update admin access');
    }
    refetch();
  }

  return { ...state, refetch, addCurator, removeCurator, setCuratorAdmin };
}
