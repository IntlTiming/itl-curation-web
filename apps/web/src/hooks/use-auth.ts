import { useEffect, useState } from 'react';

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

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? (res.json() as Promise<AuthUser>) : null))
      .then((user) => {
        setState(user ? { status: 'authenticated', user } : { status: 'unauthenticated' });
      })
      .catch(() => setState({ status: 'unauthenticated' }));
  }, []);

  return state;
}
