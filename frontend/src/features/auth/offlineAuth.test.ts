import { afterEach, describe, expect, it } from 'vitest';
import {
  clearOfflineAuth,
  getCachedOfflineUser,
  hashOfflineCredential,
  saveOfflineAuthProfile,
  verifyOfflineCredentials,
} from './offlineAuth';

afterEach(() => {
  clearOfflineAuth();
});

describe('offlineAuth', () => {
  const mockUser = {
    id: 'user-123',
    username: 'mchiroyl',
    displayName: 'Marlon Chiroyl',
    deviceId: 'dev-456',
    roles: ['VENDEDOR'],
    mustChangePassword: false,
  };

  it('genera un hash consistente con usuario, contraseña y dispositivo', async () => {
    const hash1 = await hashOfflineCredential('mchiroyl', 'Password123!', 'dev-456');
    const hash2 = await hashOfflineCredential('MCHIROYL', 'Password123!', 'dev-456');
    expect(hash1).toBe(hash2); // Case insensitive para el username
    expect(hash1).toHaveLength(64); // SHA-256 en hex
  });

  it('guarda y recupera el perfil offline en el dispositivo', async () => {
    await saveOfflineAuthProfile(mockUser, 'Password123!');
    const cached = getCachedOfflineUser();
    expect(cached).toEqual(mockUser);
  });

  it('valida credenciales correctamente en modo offline', async () => {
    await saveOfflineAuthProfile(mockUser, 'Password123!');

    // Contraseña correcta
    const ok = await verifyOfflineCredentials('mchiroyl', 'Password123!');
    expect(ok.valid).toBe(true);
    expect(ok.user?.username).toBe('mchiroyl');

    // Contraseña incorrecta
    const badPass = await verifyOfflineCredentials('mchiroyl', 'WrongPassword!');
    expect(badPass.valid).toBe(false);
    expect(badPass.reason).toBe('INVALID_CREDENTIALS');

    // Usuario diferente
    const diffUser = await verifyOfflineCredentials('otro_usuario', 'Password123!');
    expect(diffUser.valid).toBe(false);
    expect(diffUser.reason).toBe('DIFFERENT_USER');
  });

  it('rechaza si no existe perfil guardado previamente en el dispositivo', async () => {
    const res = await verifyOfflineCredentials('alguien', 'Password123!');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('NO_PROFILE');
  });
});
