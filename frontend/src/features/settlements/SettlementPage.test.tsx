import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { SettlementPage } from './SettlementPage';

vi.mock('../../offline/SyncContext', () => ({
  useSync: () => ({ operations: [{ status: 'PENDING' }, { status: 'SYNCED' }], syncNow: vi.fn() }),
}));

afterEach(() => vi.unstubAllGlobals());

describe('SettlementPage', () => {
  it('muestra por separado conciliación física, efectivo y bloqueo offline', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.endsWith('/loads') ? [{ id: 'load-1', loadNumber: '1', routeCode: 'R-01',
        routeName: 'Centro', status: 'STARTED', items: [], corrections: [] }] : path.endsWith('/settlements') ? [{
        id: 'settlement-1', routeLoadId: 'load-1', loadNumber: 1, routeCode: 'R-01', routeName: 'Centro',
        sellerName: 'Ana', loadStatus: 'STARTED', status: 'WITH_DIFFERENCE', salesTotal: 600,
        expectedCash: 600, deliveredCash: 400, verifiedTransfers: 0, appliedCredit: 0,
        monetaryDifference: 200, physicalDifferenceTotal: 0, blockingReasons: [], items: [{ id: 'item-1',
          productName: 'Agua', loadedUnits: 100, soldUnits: 60, returnedGoodUnits: 38,
          customerReturnUnits: 0, approvedWasteUnits: 2, physicalDifference: 0 }], cashDeliveries: [],
      }] : [];
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200,
        headers: { 'Content-Type': 'application/json' } }));
    }));

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SettlementPage canClose canReceiveCash />
    </QueryClientProvider>);

    expect(screen.getByRole('heading', { name: 'Liquidaciones' })).toBeInTheDocument();
    expect(await screen.findByText(/Faltante Q200.00/)).toBeInTheDocument();
    expect(screen.getByText('Agua')).toBeInTheDocument();
    expect(screen.getByText('Conciliación Física de Inventario')).toBeInTheDocument();
    expect(screen.getByText(/Existen operaciones pendientes de sincronización/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrar liquidación/i })).toBeDisabled();
  });

  it('muestra el desglose de productos vendidos por precio y subtotales', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.endsWith('/loads') ? [] : path.endsWith('/settlements') ? [{
        id: 'settlement-2', routeLoadId: 'load-2', loadNumber: 2, routeCode: 'R-02', routeName: 'Sur',
        sellerName: 'Carlos', loadStatus: 'STARTED', status: 'BALANCED', salesTotal: 150,
        expectedCash: 150, deliveredCash: 150, verifiedTransfers: 0, appliedCredit: 0,
        monetaryDifference: 0, physicalDifferenceTotal: 0, blockingReasons: [], items: [],
        cashDeliveries: [],
        salesByPrice: [
          { productId: 'p1', productCode: 'FAR', productName: 'Fardo 500ml', presentationName: 'Fardo', unitPrice: 5.0, quantitySold: 10, totalAmount: 50.0 },
          { productId: 'p1', productCode: 'FAR', productName: 'Fardo 500ml', presentationName: 'Fardo', unitPrice: 4.0, quantitySold: 15, totalAmount: 60.0 },
          { productId: 'p2', productCode: 'GAR', productName: 'Garrafón 20L', presentationName: 'Garrafón', unitPrice: 10.0, quantitySold: 4, totalAmount: 40.0 },
        ],
      }] : [];
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200,
        headers: { 'Content-Type': 'application/json' } }));
    }));

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SettlementPage canClose canReceiveCash />
    </QueryClientProvider>);

    expect(await screen.findByText(/Productos Vendidos por Precio/)).toBeInTheDocument();
    expect(screen.getByText('Fardo 500ml')).toBeInTheDocument();
    expect(screen.getByText('Total: 25 und · Q110.00')).toBeInTheDocument();
    expect(screen.getByText(/a Q5.00 c\/u/)).toBeInTheDocument();
    expect(screen.getByText(/a Q4.00 c\/u/)).toBeInTheDocument();
    expect(screen.getByText('Garrafón 20L')).toBeInTheDocument();
    expect(screen.getByText('Total: 4 und · Q40.00')).toBeInTheDocument();
    expect(screen.getByText(/a Q10.00 c\/u/)).toBeInTheDocument();
  });
});
