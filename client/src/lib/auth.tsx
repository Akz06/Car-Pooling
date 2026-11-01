import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PublicUser } from '@shared/types';
import { api, getToken, setToken } from './api';

interface AuthCtx {
  user: PublicUser | null;
  ready: boolean;
  signIn: (token: string, user: PublicUser) => void;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api.me().then(setUser).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);

  const signIn = useCallback((token: string, u: PublicUser) => {
    setToken(token);
    setUser(u);
  }, []);
  const signOut = useCallback(() => {
    api.logout().catch(() => {});
    setToken(null);
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, ready, signIn, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
