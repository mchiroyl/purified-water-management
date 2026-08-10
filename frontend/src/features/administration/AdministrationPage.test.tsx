import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { AdministrationPage } from './AdministrationPage';

afterEach(() => vi.unstubAllGlobals());

describe('AdministrationPage', () => {
  it('muestra perfiles de vendedor y dispositivos registrados', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = input.toString();
      const payload = url.endsWith('/users') ? [{
        id: 'u1', username: 'vendedor1', email: 'vendedor@example.com', status: 'ACTIVE',
        mustChangePassword: true, roles: ['VENDEDOR'], sellerId: 's1', sellerCode: 'V-001',
        sellerDisplayName: 'Juan Pérez', createdAt: '2026-08-10T00:00:00Z'
      }] : [{
        id: 'd1', userId: 'u1', username: 'vendedor1', friendlyName: 'Teléfono de Juan',
        status: 'ACTIVE', appVersion: '1.0', firstSeenAt: '2026-08-10T00:00:00Z',
        lastSeenAt: '2026-08-10T01:00:00Z', revokedAt: null
      }];
      return Promise.resolve(new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }));

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AdministrationPage />
    </QueryClientProvider>);

    expect(screen.getByRole('heading', { name: /usuarios y vendedores/i })).toBeInTheDocument();
    expect(await screen.findByText('Juan Pérez')).toBeInTheDocument();
    expect(await screen.findByText('Teléfono de Juan')).toBeInTheDocument();
  });
});
