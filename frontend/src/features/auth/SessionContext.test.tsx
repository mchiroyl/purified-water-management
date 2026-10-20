import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionProvider, useSession } from './SessionContext';
import * as mobileDatabase from '../../offline/mobileDatabase';
import { apiRequest, setAccessToken } from '../../services/apiClient';
import { clearOfflineAuth, saveOfflineAuthProfile } from './offlineAuth';

afterEach(async () => {
  setAccessToken(null);
  await clearOfflineAuth();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function SessionProbe() {
  const { user } = useSession();
  return <span>{user?.username ?? 'sin-sesion'}</span>;
}

describe('SessionProvider', () => {
  it('restaura la sesión desde la cookie refresh al cargar la aplicación', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      accessToken: 'access-token', accessTokenExpiresAt: '2026-08-10T10:00:00Z',
      user: { id: 'u1', username: 'admin', displayName: 'Administrador', deviceId: 'd1', roles: ['ADMINISTRADOR'], mustChangePassword: false }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    render(<SessionProvider><SessionProbe /></SessionProvider>);

    expect(await screen.findByText('admin')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/refresh'), expect.objectContaining({ method: 'POST' }));
  });

  it('limpia usuario, token y datos móviles cuando la sesión expira', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        accessToken: 'access-token', accessTokenExpiresAt: '2026-08-10T10:00:00Z',
        user: { id: 'u1', username: 'admin', displayName: 'Administrador', deviceId: 'd1', roles: ['ADMINISTRADOR'], mustChangePassword: false },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const clearMobileData = vi.spyOn(mobileDatabase, 'clearMobileData').mockResolvedValue(undefined);

    render(<SessionProvider><SessionProbe /></SessionProvider>);
    expect(await screen.findByText('admin')).toBeInTheDocument();

    window.dispatchEvent(new Event('agua-pura:session-expired'));

    expect(await screen.findByText('sin-sesion')).toBeInTheDocument();
    await vi.waitFor(() => expect(clearMobileData).toHaveBeenCalledTimes(1));
    await apiRequest<{ ok: boolean }>('/health');
    const headers = fetcher.mock.calls[1][1]?.headers as Headers;
    expect(headers.get('Authorization')).toBeNull();
  });

  it('mantiene la sesión del usuario si /auth/refresh falla por error de red/offline', async () => {
    // Guardar usuario en caché offline previamente
    await saveOfflineAuthProfile({
      id: 'u-seller',
      username: 'mchiroyl',
      displayName: 'Marlon Chiroyl',
      deviceId: 'dev-1',
      roles: ['VENDEDOR'],
      mustChangePassword: false,
    }, 'Password123!');

    // Simular que el fetch a /auth/refresh falla por falta de internet
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    render(<SessionProvider><SessionProbe /></SessionProvider>);

    // No debe sacar al usuario, debe mantenerlo activo
    expect(await screen.findByText('mchiroyl')).toBeInTheDocument();
  });
});
