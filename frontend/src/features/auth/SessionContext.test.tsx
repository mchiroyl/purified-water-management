import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { SessionProvider, useSession } from './SessionContext';

afterEach(() => vi.unstubAllGlobals());

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
});
