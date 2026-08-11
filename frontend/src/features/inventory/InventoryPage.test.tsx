import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { InventoryPage } from './InventoryPage';

afterEach(() => vi.unstubAllGlobals());

describe('InventoryPage', () => {
  it('muestra ubicaciones y saldos en unidades base', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = input.toString();
      const value = url.includes('/inventory/locations') ? [{
        id: 'l1', code: 'BOD-01', name: 'Bodega central', locationType: 'WAREHOUSE', active: true,
        createdAt: '2026-08-10T00:00:00Z', balances: [{ productId: 'p1', productCode: 'AGUA-600',
          productName: 'Agua pura 600 ml', baseUnitCode: 'BOTELLA', quantityBaseUnits: 42, version: 1,
          updatedAt: '2026-08-10T00:00:00Z' }]
      }] : [];
      return Promise.resolve(new Response(JSON.stringify(value), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      }));
    }));
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <InventoryPage canManage={false} />
    </QueryClientProvider>);
    expect(screen.getByRole('heading', { name: /inventario/i })).toBeInTheDocument();
    expect(await screen.findByText('Bodega central')).toBeInTheDocument();
    expect(screen.getByText(/42 BOTELLA/i)).toBeInTheDocument();
  });
});
