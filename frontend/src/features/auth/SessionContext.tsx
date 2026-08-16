import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { apiRequest, setAccessToken } from '../../services/apiClient';
import type { AuthResponse, SessionUser } from './types';
import { clearMobileData, prepareMobileDataForSession } from '../../offline/mobileDatabase';

interface SessionContextValue {
  user: SessionUser | null;
  busy: boolean;
  initializing: boolean;
  login(username: string, password: string, deviceName: string): Promise<void>;
  refresh(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  logout(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const bootstrapAttempted = useRef(false);

  const applyAuth = useCallback(async (auth: AuthResponse) => {
    await prepareMobileDataForSession(auth.user.id, auth.user.deviceId);
    setAccessToken(auth.accessToken);
    setUser(auth.user);
  }, []);

  const login = useCallback(async (username: string, password: string, deviceName: string) => {
    setBusy(true);
    try {
      await applyAuth(await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, deviceName })
      }));
    } finally {
      setBusy(false);
    }
  }, [applyAuth]);

  const refresh = useCallback(async () => {
    await applyAuth(await apiRequest<AuthResponse>('/auth/refresh', { method: 'POST' }));
  }, [applyAuth]);

  useEffect(() => {
    if (bootstrapAttempted.current) return;
    bootstrapAttempted.current = true;
    void refresh()
      .catch(() => {
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => setInitializing(false));
  }, [refresh]);

  useEffect(() => {
    const handleExpired = () => {
      setAccessToken(null);
      setUser(null);
      void clearMobileData();
    };
    window.addEventListener('agua-pura:session-expired', handleExpired);
    return () => window.removeEventListener('agua-pura:session-expired', handleExpired);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
    } finally {
      await clearMobileData();
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    setBusy(true);
    try {
      await apiRequest<void>('/auth/change-password', {
        method: 'POST', body: JSON.stringify({ currentPassword, newPassword }),
      });
      await clearMobileData();
      setAccessToken(null);
      setUser(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo(() => ({ user, busy, initializing, login, refresh, changePassword, logout }),
    [user, busy, initializing, login, refresh, changePassword, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession debe utilizarse dentro de SessionProvider');
  return context;
}
