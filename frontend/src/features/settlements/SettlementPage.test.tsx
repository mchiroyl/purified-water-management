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
    expect(await screen.findByText('Diferencia monetaria')).toBeInTheDocument();
    expect(screen.getByText('Q200.00')).toBeInTheDocument();
    expect(screen.getByText(/100 − 60 − 38 − 2 = 0/)).toBeInTheDocument();
    expect(screen.getByText(/Existen operaciones pendientes de sincronización/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cerrar liquidación/i })).toBeDisabled();
  });
});
