import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { CustomersPage } from './CustomersPage';

afterEach(() => vi.unstubAllGlobals());

describe('CustomersPage', () => {
  it('muestra clientes con su ruta y vendedor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      id: 'c1', code: 'C-001', name: 'Tienda Central', contactName: 'Ana', phone: '55550101',
      whatsapp: '', addressReference: 'Frente al parque', customerType: 'PERMANENT', status: 'ACTIVE',
      creditAllowed: false, creditLimit: 0, currentBalance: 0, routeId: 'r1', routeCode: 'R-01',
      routeName: 'Ruta Centro', sellerId: 's1', sellerName: 'Juan Pérez', registrationState: 'ACTIVE',
      createdAt: '2026-08-10T00:00:00Z'
    }]), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CustomersPage canManage={false} />
    </QueryClientProvider>);

    expect(screen.getByRole('heading', { name: /^clientes$/i })).toBeInTheDocument();
    expect(await screen.findByText('Tienda Central')).toBeInTheDocument();
    expect(screen.getByText(/Ruta Centro.*Juan Pérez/i)).toBeInTheDocument();
  });
});
