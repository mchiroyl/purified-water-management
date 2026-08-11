import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { ReturnsPage } from './ReturnsPage';

afterEach(() => vi.unstubAllGlobals());

describe('ReturnsPage', () => {
  it('separa producto no vendido, devolución de cliente y recepción física', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.endsWith('/returns') ? [{
        id: 'return-1', returnType: 'UNSOLD_GOOD', routeCode: 'R-01', routeName: 'Centro',
        sellerName: 'Ana', status: 'PENDING_RECEIPT', reason: 'Producto no vendido',
        reportedBaseUnits: 10, receivedBaseUnits: 0, pendingDifferenceBaseUnits: 10,
        items: [{ id: 'item-1', productName: 'Agua', presentationName: 'Fardo',
          reportedBaseUnits: 10, receivedBaseUnits: 0 }],
      }] : path.endsWith('/inventory/locations') ? [{ id: 'warehouse-1', code: 'B-01', name: 'Bodega',
        locationType: 'WAREHOUSE', active: true, balances: [] }] : [];
      return Promise.resolve(new Response(JSON.stringify(body), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));
    }));

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ReturnsPage canReport canReceive deviceId="device-1" />
    </QueryClientProvider>);

    expect(screen.getByRole('heading', { name: 'Devoluciones' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Producto no vendido' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Devolución de cliente' })).toBeInTheDocument();
    expect(await screen.findByText(/Diferencia pendiente: 10/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar recepción física/i })).toBeInTheDocument();
    expect(screen.queryByText(/tipo de merma/i)).not.toBeInTheDocument();
  });
});
