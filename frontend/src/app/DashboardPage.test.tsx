import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';

afterEach(() => vi.unstubAllGlobals());

describe('DashboardPage', () => {
  it('muestra los indicadores oficiales y los pendientes operativos', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      generatedAt: '2026-08-11T15:00:00Z', timezone: 'America/Guatemala', currencyCode: 'GTQ',
      salesToday: 425.5, expectedCash: 300, deliveredCash: 250, transfers: 75, credit: 50,
      monetaryDifferences: 50, inventoryDifferences: 3, approvedWasteUnits: 2,
      pendingWastes: 1, provisionalCustomers: 2, pendingTransfers: 3,
      activeRoutes: 4, completedRoutes: 5, pendingOfflineOperations: 6,
      pendingReturns: 1, pendingAuthorizations: 2, openIncidents: 1,
      alerts: [{ code: 'CASH_SHORTAGE', severity: 'CRITICAL', title: 'Faltante de efectivo', count: 1 }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))));

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DashboardPage />
    </QueryClientProvider>);

    expect(screen.getByRole('heading', { level: 1, name: /panel operativo/i })).toBeInTheDocument();
    expect(await screen.findByText('Q425.50')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText(/faltante de efectivo/i)).toBeInTheDocument();
    expect(screen.getByText(/6 operaciones offline/i)).toBeInTheDocument();
  });
});
