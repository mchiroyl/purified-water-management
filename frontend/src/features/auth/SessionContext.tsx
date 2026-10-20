import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../../types/api';
import { apiRequest, setAccessToken, getAccessToken, RefreshRejectedError } from '../../services/apiClient';
import type { AuthResponse, SessionUser } from './types';
import { clearMobileData, prepareMobileDataForSession } from '../../offline/mobileDatabase';
import { getKnownDeviceId, saveKnownDeviceId } from './deviceIdentity';
import { getDeviceName } from './deviceIdentity';
import {
  getCachedOfflineUser,
  saveOfflineAuthProfile,
  verifyOfflineCredentials,
} from './offlineAuth';

interface SessionContextValue {
  user: SessionUser | null;
  busy: boolean;
  initializing: boolean;
  login(username: string, password: string, deviceName?: string): Promise<void>;
  enroll(token: string): Promise<void>;
  refresh(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  logout(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => getCachedOfflineUser());
  const [busy, setBusy] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const bootstrapAttempted = useRef(false);

  const applyAuth = useCallback(async (auth: AuthResponse, password?: string) => {
    await prepareMobileDataForSession(auth.user.id, auth.user.deviceId);
    saveKnownDeviceId(auth.user.deviceId);
    setAccessToken(auth.accessToken);
    setUser(auth.user);
    await saveOfflineAuthProfile(auth.user, password);
  }, []);

  const login = useCallback(async (username: string, password: string, deviceName = getDeviceName()) => {
    setBusy(true);
    try {
      // 1. Intentar primero autenticación en línea si hay conectividad (timeout corto de 3.5s)
      try {
        const timeoutController = new AbortController();
        const timer = setTimeout(() => timeoutController.abort(), 3_500);
        try {
          const auth = await apiRequest<AuthResponse>('/auth/login', {
            method: 'POST',
            signal: timeoutController.signal,
            body: JSON.stringify({
              username,
              password,
              deviceName,
              appVersion: 'web',
              knownDeviceId: getKnownDeviceId(),
            }),
          });
          await applyAuth(auth, password);
          return;
        } finally {
          clearTimeout(timer);
        }
      } catch (onlineError) {
        // Si el servidor HTTP respondió explícitamente 401 Credenciales incorrectas,
        // respetar la respuesta del servidor (no es fallo de red, es contraseña errónea)
        if (onlineError instanceof ApiError && onlineError.status === 401) {
          throw onlineError;
        }
        // Si falló por red/timeout/Failed to fetch/AbortError, proceder a verificación offline local
      }

      // 2. Verificación offline segura en el dispositivo con hash criptográfico SHA-256
      const check = await verifyOfflineCredentials(username, password);
      if (check.valid && check.user) {
        await prepareMobileDataForSession(check.user.id, check.user.deviceId);
        saveKnownDeviceId(check.user.deviceId);
        setUser(check.user);
        return;
      }

      if (check.reason === 'INVALID_CREDENTIALS') {
        throw new Error('Contraseña incorrecta para el usuario guardado en este dispositivo.');
      }
      if (check.reason === 'DIFFERENT_USER') {
        throw new Error('Este dispositivo tiene registrada la sesión de otro usuario en modo local. Conéctese a internet para ingresar.');
      }
      if (check.reason === 'NO_PROFILE') {
        throw new Error('Sin conexión al servidor. Para ingresar por primera vez debe tener señal o internet.');
      }
      throw new Error('No fue posible iniciar sesión en modo local.');
    } finally {
      setBusy(false);
    }
  }, [applyAuth]);

  const enroll = useCallback(async (token: string) => {
    setBusy(true);
    try {
      await applyAuth(await apiRequest<AuthResponse>('/auth/device-enrollment', {
        method: 'POST',
        body: JSON.stringify({ token, deviceName: getDeviceName(), appVersion: 'web' })
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
      .catch((err) => {
        // Solo si el servidor rechazó expresamente la sesión (401/403: token revocado o usuario bloqueado)
        if (err instanceof RefreshRejectedError) {
          setAccessToken(null);
          setUser(null);
          return;
        }
        // Si falló por error de red/timeout/Failed to fetch:
        // CONSERVAR la sesión local del usuario para no sacarlo del sistema en campo
        const cached = getCachedOfflineUser();
        if (cached) {
          setUser(cached);
          void prepareMobileDataForSession(cached.id, cached.deviceId);
        }
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

  useEffect(() => {
    const handleReconnected = () => {
      if (user && !getAccessToken()) {
        void refresh().catch(() => {
          // Si el servidor todavía no responde o la red es intermitente, conservar sesión local
        });
      }
    };
    window.addEventListener('online', handleReconnected);
    window.addEventListener('agua-pura:connection-restored', handleReconnected);
    return () => {
      window.removeEventListener('online', handleReconnected);
      window.removeEventListener('agua-pura:connection-restored', handleReconnected);
    };
  }, [user, refresh]);

  const logout = useCallback(async () => {
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
    } catch {
      // Ignorar error si no hay internet al cerrar sesión
    } finally {
      // IMPORTANTE: NO borrar las credenciales offline ni los datos locales al cerrar sesión normal.
      // El vendedor asignado a este dispositivo debe poder volver a ingresar con su contraseña
      // sin necesidad de internet en ruta.
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
      setAccessToken(null);
      setUser(null);
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo(() => ({ user, busy, initializing, login, enroll, refresh, changePassword, logout }),
    [user, busy, initializing, login, enroll, refresh, changePassword, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession debe utilizarse dentro de SessionProvider');
  return context;
}

export function useOptionalSession(): SessionContextValue | null {
  return useContext(SessionContext);
}
