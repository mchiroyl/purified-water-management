import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { apiRequest, setAccessToken } from '../../services/apiClient';
import type { AuthResponse, SessionUser } from './types';

interface SessionContextValue {
  user: SessionUser | null;
  busy: boolean;
  login(username: string, password: string, deviceName: string): Promise<void>;
  refresh(): Promise<void>;
  logout(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [busy, setBusy] = useState(false);

  const applyAuth = useCallback((auth: AuthResponse) => {
    setAccessToken(auth.accessToken);
    setUser(auth.user);
  }, []);

  const login = useCallback(async (username: string, password: string, deviceName: string) => {
    setBusy(true);
    try {
      applyAuth(await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, deviceName })
      }));
    } finally {
      setBusy(false);
    }
  }, [applyAuth]);

  const refresh = useCallback(async () => {
    applyAuth(await apiRequest<AuthResponse>('/auth/refresh', { method: 'POST' }));
  }, [applyAuth]);

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, busy, login, refresh, logout }), [user, busy, login, refresh, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession debe utilizarse dentro de SessionProvider');
  return context;
}
