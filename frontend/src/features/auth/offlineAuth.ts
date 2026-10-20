import type { SessionUser } from './types';
import { getKnownDeviceId } from './deviceIdentity';

const OFFLINE_AUTH_KEY = 'agua_pura:offline_auth_profile';
const OFFLINE_USERS_KEY = 'agua_pura:offline_users';

export interface OfflineAuthProfile {
  user: SessionUser;
  credentialHash?: string;
  deviceId: string;
  savedAt: string;
}

export type OfflineUsersMap = Record<string, OfflineAuthProfile>;

/**
 * Genera un resumen criptográfico SHA-256 seguro ligado al usuario, contraseña y dispositivo.
 */
export async function hashOfflineCredential(username: string, password: string, deviceId: string): Promise<string> {
  const normalized = `agua-pura-v1:${username.trim().toLowerCase()}:${password}:${deviceId || ''}`;
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Guarda el perfil del usuario autenticado y su verificación criptográfica para acceso offline seguro.
 * Se guarda tanto en localStorage como en IndexedDB para máxima persistencia ante cierres de sesión.
 */
export async function saveOfflineAuthProfile(user: SessionUser, password?: string): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  try {
    const usernameKey = user.username.trim().toLowerCase();
    const effectiveDeviceId = user.deviceId || getKnownDeviceId() || '';

    // Leer mapa de usuarios offline en localStorage
    let usersMap: OfflineUsersMap = {};
    try {
      const rawMap = localStorage.getItem(OFFLINE_USERS_KEY);
      if (rawMap) usersMap = JSON.parse(rawMap);
    } catch {
      usersMap = {};
    }

    const existing = usersMap[usernameKey];
    let credentialHash = existing?.credentialHash;

    if (password) {
      credentialHash = await hashOfflineCredential(usernameKey, password, effectiveDeviceId);
    }

    const profile: OfflineAuthProfile = {
      user,
      credentialHash,
      deviceId: effectiveDeviceId,
      savedAt: new Date().toISOString(),
    };

    usersMap[usernameKey] = profile;
    localStorage.setItem(OFFLINE_USERS_KEY, JSON.stringify(usersMap));
    localStorage.setItem(OFFLINE_AUTH_KEY, JSON.stringify(profile));

    // Respaldo secundario en IndexedDB (appMetadata) para que no se pierda al limpiar almacenamiento temporal
    try {
      const { openMobileDatabase } = await import('../../offline/mobileDatabase');
      const db = await openMobileDatabase();
      await db.put('appMetadata', {
        key: 'offline_auth',
        value: profile,
        updatedAt: profile.savedAt,
      });
      await db.put('appMetadata', {
        key: `offline_auth:${usernameKey}`,
        value: profile,
        updatedAt: profile.savedAt,
      });
    } catch {
      // Ignorar si IndexedDB no está disponible en este momento
    }
  } catch {
    // Ignorar si la cuota de almacenamiento está completa
  }
}

/**
 * Recupera el usuario con sesión local previa para permitir el arranque offline sin señal.
 */
export function getCachedOfflineUser(): SessionUser | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(OFFLINE_AUTH_KEY);
    if (raw) {
      const profile = JSON.parse(raw) as OfflineAuthProfile;
      if (profile?.user?.id && profile?.user?.username) {
        return profile.user;
      }
    }
    const rawMap = localStorage.getItem(OFFLINE_USERS_KEY);
    if (rawMap) {
      const map = JSON.parse(rawMap) as OfflineUsersMap;
      const firstUser = Object.values(map)[0]?.user;
      if (firstUser?.id && firstUser?.username) {
        return firstUser;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Verifica las credenciales locales de forma offline cuando no hay internet o red.
 * Busca primero en localStorage y luego en IndexedDB.
 */
export async function verifyOfflineCredentials(
  username: string,
  password: string,
): Promise<{ valid: boolean; user: SessionUser | null; reason?: string }> {
  const normUser = username.trim().toLowerCase();
  let profile: OfflineAuthProfile | null = null;
  let anyEnrolledProfile = false;

  // 1. Intentar desde localStorage map o single profile
  if (typeof localStorage !== 'undefined') {
    try {
      const rawMap = localStorage.getItem(OFFLINE_USERS_KEY);
      if (rawMap) {
        const map = JSON.parse(rawMap) as OfflineUsersMap;
        const keys = Object.keys(map);
        if (keys.length > 0) anyEnrolledProfile = true;
        if (map[normUser]) {
          profile = map[normUser];
        }
      }
      if (!profile) {
        const rawSingle = localStorage.getItem(OFFLINE_AUTH_KEY);
        if (rawSingle) {
          const single = JSON.parse(rawSingle) as OfflineAuthProfile;
          if (single?.user) anyEnrolledProfile = true;
          if (single?.user?.username?.trim()?.toLowerCase() === normUser) {
            profile = single;
          }
        }
      }
    } catch {
      // Continuar con IndexedDB
    }
  }

  // 2. Si no se encontró en localStorage, consultar IndexedDB
  if (!profile) {
    try {
      const { openMobileDatabase } = await import('../../offline/mobileDatabase');
      const db = await openMobileDatabase();
      const metaUser = await db.get('appMetadata', `offline_auth:${normUser}`);
      if (metaUser?.value) {
        profile = metaUser.value as OfflineAuthProfile;
        anyEnrolledProfile = true;
      } else {
        const metaGeneral = await db.get('appMetadata', 'offline_auth');
        if (metaGeneral?.value) {
          const p = metaGeneral.value as OfflineAuthProfile;
          if (p?.user) anyEnrolledProfile = true;
          if (p?.user?.username?.trim()?.toLowerCase() === normUser) {
            profile = p;
          }
        }
      }
    } catch {
      // IndexedDB falló o no disponible
    }
  }

  if (!profile || !profile.user) {
    return { valid: false, user: null, reason: anyEnrolledProfile ? 'DIFFERENT_USER' : 'NO_PROFILE' };
  }

  if (!profile.credentialHash) {
    return { valid: false, user: null, reason: 'NO_PROFILE' };
  }

  const effectiveDeviceId = profile.deviceId || profile.user.deviceId || getKnownDeviceId() || '';
  const computed = await hashOfflineCredential(normUser, password, effectiveDeviceId);

  if (computed === profile.credentialHash) {
    return { valid: true, user: profile.user };
  }

  // Comprobar también sin deviceId por si cambió el identificador del navegador
  const computedLegacy = await hashOfflineCredential(normUser, password, '');
  if (computedLegacy === profile.credentialHash) {
    return { valid: true, user: profile.user };
  }

  return { valid: false, user: null, reason: 'INVALID_CREDENTIALS' };
}

/**
 * Limpia las credenciales offline únicamente cuando se solicita explícitamente (ej. cambio de dispositivo o tests).
 */
export async function clearOfflineAuth(): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(OFFLINE_AUTH_KEY);
      localStorage.removeItem(OFFLINE_USERS_KEY);
    } catch {
      // Ignorar
    }
  }
  try {
    const { openMobileDatabase } = await import('../../offline/mobileDatabase');
    const db = await openMobileDatabase();
    const allKeys = await db.getAllKeys('appMetadata');
    for (const key of allKeys) {
      if (typeof key === 'string' && key.startsWith('offline_auth')) {
        await db.delete('appMetadata', key);
      }
    }
  } catch {
    // Ignorar si IndexedDB no está disponible
  }
}
