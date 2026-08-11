import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { ReportsPage } from './ReportsPage';

afterEach(() => vi.unstubAllGlobals());

describe('ReportsPage', () => {
  it('muestra ventas paginadas y filtros operativos', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      content: [{ saleId: 's1', documentNumber: 'V-00000021', occurredAt: '2026-08-11T14:00:00Z',
        sellerCode: 'VEN-01', sellerName: 'Ana', routeCode: 'R-01', routeName: 'Norte',
        customerCode: 'C-01', customerName: 'Tienda Uno', productCode: 'AGUA', productName: 'Agua pura',
        presentationCode: 'F12', presentationName: 'Fardo x12', presentationQuantity: 2,
        baseUnits: 24, unitPrice: 15, lineTotal: 30, saleTotal: 30, currencyCode: 'GTQ',
        paymentMethods: 'CASH', cashAmount: 30, transferAmount: 0, creditAmount: 0, saleStatus: 'CONFIRMED' }],
      totalElements: 1, page: 0, size: 25, hasNext: false
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))));

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ReportsPage />
    </QueryClientProvider>);

    expect(screen.getByRole('heading', { level: 1, name: /reportes/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/vendedor/i)).toBeInTheDocument();
    expect(await screen.findByText('V-00000021')).toBeInTheDocument();
    expect(screen.getByText(/Fardo x12/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exportar ventas/i })).toBeInTheDocument();
  });
});
