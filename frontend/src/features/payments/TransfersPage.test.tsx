import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { TransfersPage } from './TransfersPage';

afterEach(() => vi.unstubAllGlobals());

describe('TransfersPage', () => {
  it('muestra transferencias pendientes con evidencia y decisiones separadas', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify([{
      id: 'payment-1', saleId: 'sale-1', documentNumber: 'V-00000042', routeCode: 'R-01',
      routeName: 'Ruta norte', sellerName: 'Ana Pérez', customerCode: 'C-01',
      customerName: 'Tienda La Fuente', amount: 25, currencyCode: 'GTQ',
      status: 'PENDING_VERIFICATION', reference: 'TRX-2026-9', bank: 'Banco Uno',
      evidenceReference: 'foto-9', registeredByUsername: 'ana', createdAt: '2026-08-10T15:00:00Z'
    }]), { status: 200, headers: { 'Content-Type': 'application/json' } }))));

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TransfersPage />
    </QueryClientProvider>);

    expect(screen.getByRole('heading', { level: 1, name: /transferencias/i })).toBeInTheDocument();
    expect(await screen.findByText('TRX-2026-9')).toBeInTheDocument();
    expect(screen.getByText(/Banco Uno.*foto-9/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verificar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rechazar/i })).toBeInTheDocument();
  });
});
