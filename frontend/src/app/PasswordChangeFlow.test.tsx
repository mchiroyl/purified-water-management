import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, it, vi } from 'vitest';
import { SessionProvider } from '../features/auth/SessionContext';
import { App } from './App';

afterEach(() => vi.unstubAllGlobals());

describe('cambio obligatorio de contrasena', () => {
  it('impide abrir el sistema con una contrasena temporal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      accessToken: 'temporary-access', accessTokenExpiresAt: '2026-08-10T10:00:00Z',
      user: { id: 'u1', username: 'admin', displayName: 'Administrador', deviceId: 'd1', roles: ['ADMINISTRADOR'], mustChangePassword: true }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SessionProvider><App /></SessionProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole('heading', { name: /cambiar contrasena/i })).toBeInTheDocument();
  });
});
