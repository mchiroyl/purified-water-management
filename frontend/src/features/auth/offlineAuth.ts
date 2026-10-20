import type { SessionUser } from './types';

const OFFLINE_AUTH_KEY = 'agua_pura:offline_auth_profile';

export interface OfflineAuthProfile {
  user: SessionUser;
  credentialHash?: string;
  deviceId: string;
  savedAt: string;
}

/**
 * Genera un resumen criptográfico SHA-256 seguro ligado al usuario, contraseña y dispositivo.
 */
export async function hashOfflineCredential(username: string, password: string, deviceId: string): Promise<string> {
  const normalized = `agua-pura-v1:${username.trim().toLowerCase()}:${password}:${deviceId}`;
  const data = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Guarda el perfil del usuario autenticado y su verificación criptográfica para acceso offline seguro.
 */
export async function saveOfflineAuthProfile(user: SessionUser, password?: string): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  try {
    const existingRaw = localStorage.getItem(OFFLINE_AUTH_KEY);
    let credentialHash: string | undefined = undefined;
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw) as OfflineAuthProfile;
        if (existing.user?.username?.toLowerCase() === user.username.toLowerCase()) {
          credentialHash = existing.credentialHash;
        }
      } catch {
        // Ignorar si el JSON existente no es válido
      }
    }

    if (password) {
      credentialHash = await hashOfflineCredential(user.username, password, user.deviceId);
    }

    const profile: OfflineAuthProfile = {
      user,
      credentialHash,
      deviceId: user.deviceId,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(OFFLINE_AUTH_KEY, JSON.stringify(profile));
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
    if (!raw) return null;
    const profile = JSON.parse(raw) as OfflineAuthProfile;
    if (profile && profile.user && profile.user.id && profile.user.username) {
      return profile.user;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Verifica las credenciales locales de forma offline cuando no hay internet o red.
 */
export async function verifyOfflineCredentials(
  username: string,
  password: string,
): Promise<{ valid: boolean; user: SessionUser | null; reason?: string }> {
  if (typeof localStorage === 'undefined') {
    return { valid: false, user: null, reason: 'STORAGE_UNAVAILABLE' };
  }
  try {
    const raw = localStorage.getItem(OFFLINE_AUTH_KEY);
    if (!raw) {
      return { valid: false, user: null, reason: 'NO_PROFILE' };
    }
    const profile = JSON.parse(raw) as OfflineAuthProfile;
    if (!profile.user || !profile.credentialHash) {
      return { valid: false, user: null, reason: 'NO_PROFILE' };
    }
    if (profile.user.username.trim().toLowerCase() !== username.trim().toLowerCase()) {
      return { valid: false, user: null, reason: 'DIFFERENT_USER' };
    }

    const computed = await hashOfflineCredential(username, password, profile.deviceId);
    if (computed === profile.credentialHash) {
      return { valid: true, user: profile.user };
    }
    return { valid: false, user: null, reason: 'INVALID_CREDENTIALS' };
  } catch {
    return { valid: false, user: null, reason: 'ERROR' };
  }
}

/**
 * Limpia las credenciales offline cuando el usuario cierra sesión explícitamente.
 */
export function clearOfflineAuth(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(OFFLINE_AUTH_KEY);
  } catch {
    // Ignorar
  }
}
