import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { RouteLoadsPage } from './RouteLoadsPage';

afterEach(() => vi.unstubAllGlobals());

describe('RouteLoadsPage', () => {
  it('muestra estado, artículos y confirmaciones independientes', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const value = input.toString().endsWith('/loads') ? [{
        id: 'l1', loadNumber: 'CARGA-000001', routeId: 'r1', routeCode: 'R-01', routeName: 'Ruta norte',
        sourceLocationId: 'w1', sourceLocationName: 'Bodega central', targetLocationId: 't1',
        targetLocationName: 'Inventario ruta norte', plannedDate: '2026-08-10', notes: '', status: 'RECEIVED',
        createdByUsername: 'bodega', warehouseConfirmedByUsername: 'bodega', sellerReceivedByUsername: 'vendedor',
        items: [{ id: 'i1', productId: 'p1', productName: 'Agua pura', productCode: 'AGUA',
          baseUnitCode: 'BOTELLA', quantityBaseUnits: 100 }], corrections: []
      }] : [];
      return Promise.resolve(new Response(JSON.stringify(value), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      }));
    }));
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouteLoadsPage canPrepare={false} canConfirmWarehouse={false} canReceive={false} canStart={false} canCorrect={false} />
    </QueryClientProvider>);
    expect(screen.getByRole('heading', { name: /cargas de ruta/i })).toBeInTheDocument();
    expect(await screen.findByText('CARGA-000001')).toBeInTheDocument();
    expect(screen.getByText(/100 BOTELLA/i)).toBeInTheDocument();
    expect(screen.getByText(/Entrega: bodega.*Recepción: vendedor/i)).toBeInTheDocument();
  });
});
