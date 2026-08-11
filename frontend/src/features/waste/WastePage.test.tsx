import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { WastePage } from './WastePage';

afterEach(() => vi.unstubAllGlobals());

describe('WastePage', () => {
  it('separa el reporte físico de la revisión y mantiene visible la diferencia pendiente', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const path = String(input);
      const body = path.endsWith('/wastes') ? [{
        id: 'waste-1', routeCode: 'R-01', routeName: 'Centro', sellerName: 'Ana',
        status: 'PENDING_REVIEW', reason: 'Fardo roto', reportedBaseUnits: 5,
        approvedBaseUnits: 0, pendingDifferenceBaseUnits: 5, occurredAtLocal: '2026-08-10T15:00:00Z',
        items: [{ id: 'item-1', productName: 'Agua', presentationName: 'Fardo x24',
          wasteTypeName: 'Rotura', reportedBaseUnits: 5, recoverableBaseUnits: 19,
          approvedBaseUnits: 0 }], evidence: [], reviews: [],
      }] : path.endsWith('/wastes/types') ? [{ id: 'type-1', code: 'ROTURA', name: 'Rotura',
        evidencePolicy: 'REQUIRED', warehouseApprovalLimitBaseUnits: 5,
        supervisorApprovalLimitBaseUnits: 20, dailyAlertThreshold: 3, active: true }] : [];
      return Promise.resolve(new Response(JSON.stringify(body), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));
    }));

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <WastePage canReport canReview canManageCatalog={false} deviceId="device-1" />
    </QueryClientProvider>);

    expect(screen.getByRole('heading', { name: 'Mermas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reportar pérdida física' })).toBeInTheDocument();
    expect(await screen.findByText(/Diferencia pendiente: 5/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aprobar cantidades/i })).toBeInTheDocument();
    expect(screen.queryByText(/efectivo esperado/i)).not.toBeInTheDocument();
  });
});
