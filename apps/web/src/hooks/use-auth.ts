import { useCallback, useEffect, useState } from 'react';

export type AuthUser = {
  id: string;
  discordId: string;
  discordUsername: string;
  discordAvatarHash: string | null;
  displayName: string | null;
  isGlobalAdmin: boolean;
};

export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'unauthenticated' };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? (res.json() as Promise<AuthUser>) : null))
      .then((user) => {
        setState(user ? { status: 'authenticated', user } : { status: 'unauthenticated' });
      })
      .catch(() => setState({ status: 'unauthenticated' }));
  }, []);

  const updateDisplayName = useCallback(async (displayName: string): Promise<void> => {
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.message ?? 'Failed to update display name');
    }
    const user = (await res.json()) as AuthUser;
    setState({ status: 'authenticated', user });
  }, []);

  return { ...state, updateDisplayName };
}
