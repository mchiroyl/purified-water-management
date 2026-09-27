import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';

afterEach(() => vi.unstubAllGlobals());

describe('DashboardPage', () => {
  it('muestra los indicadores oficiales y los pendientes operativos', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/loads') || url.includes('/sales') || url.includes('/inventory/locations') || url.includes('/products') || url.includes('/pricing/lists')) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        generatedAt: '2026-08-11T15:00:00Z', timezone: 'America/Guatemala', currencyCode: 'GTQ',
        salesToday: 425.5, expectedCash: 300, deliveredCash: 250, transfers: 75, credit: 50,
        monetaryDifferences: 50, inventoryDifferences: 3, approvedWasteUnits: 2,
        pendingWastes: 1, provisionalCustomers: 2, pendingTransfers: 3,
        activeRoutes: 4, completedRoutes: 5, pendingOfflineOperations: 6,
        pendingReturns: 1, pendingAuthorizations: 2, openIncidents: 1,
        alerts: [{ code: 'CASH_SHORTAGE', severity: 'CRITICAL', title: 'Faltante de efectivo', count: 1 }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }));

    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <DashboardPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: /panel operativo/i })).toBeInTheDocument();
    expect(await screen.findByText('Q425.50')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText(/faltante de efectivo/i)).toBeInTheDocument();
    expect(screen.getByText(/6 operaciones offline/i)).toBeInTheDocument();
  });

  it('muestra el monitor de rutas en vivo con lo cargado, vendido y restante del vendedor', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/loads')) {
        return Promise.resolve(new Response(JSON.stringify([{
          id: 'load-1', loadNumber: 'CRG-001', routeId: 'r1', routeCode: 'RUT-01', routeName: 'Ruta Retalhuleu',
          sourceLocationId: 'loc-1', sourceLocationName: 'Bodega Central', targetLocationId: 'loc-r1', targetLocationName: 'Inventario Ruta',
          plannedDate: '2026-08-11', loadType: 'INITIAL', status: 'STARTED', sellerReceivedByUsername: 'amartinez',
          createdByUsername: 'admin', items: [{ id: 'it-1', productId: 'p1', productCode: 'GAR-20', productName: 'Garrafon 20L', baseUnitCode: 'GARRAFON', quantityBaseUnits: 100 }]
        }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/sales')) {
        return Promise.resolve(new Response(JSON.stringify([{
          id: 's-1', documentNumber: 'FAC-001', routeId: 'r1', routeCode: 'RUT-01', routeName: 'Ruta Retalhuleu',
          sellerName: 'amartinez', customerName: 'Tienda La Bendición', total: 600, createdAt: '2026-08-11T10:30:00Z',
          items: [{ id: 'si-1', productName: 'Garrafon 20L', presentationQuantity: 30, quantityBaseUnits: 30, unitPrice: 20, lineTotal: 600 }]
        }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/inventory/locations')) {
        return Promise.resolve(new Response(JSON.stringify([
          { id: 'loc-1', code: 'BOD-01', name: 'Bodega Central', locationType: 'WAREHOUSE', active: true, balances: [{ productId: 'p1', productCode: 'GAR-20', productName: 'Garrafon 20L', baseUnitCode: 'GARRAFON', quantityBaseUnits: 200 }] },
          { id: 'loc-r1', code: 'IR-01', name: 'Inventario Retalhuleu', locationType: 'ROUTE', routeId: 'r1', active: true, balances: [{ productId: 'p1', productCode: 'GAR-20', productName: 'Garrafon 20L', baseUnitCode: 'GARRAFON', quantityBaseUnits: 70 }] }
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/products') || url.includes('/pricing/lists')) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        generatedAt: '2026-08-11T15:00:00Z', timezone: 'America/Guatemala', currencyCode: 'GTQ',
        salesToday: 600, expectedCash: 600, deliveredCash: 0, transfers: 0, credit: 0,
        monetaryDifferences: 0, inventoryDifferences: 0, approvedWasteUnits: 0,
        pendingWastes: 0, provisionalCustomers: 0, pendingTransfers: 0,
        activeRoutes: 1, completedRoutes: 0, pendingOfflineOperations: 0,
        pendingReturns: 0, pendingAuthorizations: 0, openIncidents: 0, alerts: []
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }));

    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <DashboardPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Ruta Retalhuleu')).toBeInTheDocument();
    expect(screen.getAllByText(/amartinez/i)[0]).toBeInTheDocument();
    expect(screen.getByText('100 GARRAFON')).toBeInTheDocument();
    expect(screen.getByText('30 GARRAFON')).toBeInTheDocument();
    expect(screen.getAllByText('70 GARRAFON')).toHaveLength(2);
    expect(screen.getByText('Tienda La Bendición')).toBeInTheDocument();
  });

  it('muestra la cabina especializada y operativa para el rol VENDEDOR', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/loads')) {
        return Promise.resolve(new Response(JSON.stringify([{
          id: 'load-s1', loadNumber: 'CRG-V01', routeId: 'r1', routeCode: 'RUT-01', routeName: 'Ruta Retalhuleu',
          sourceLocationId: 'loc-1', sourceLocationName: 'Bodega Central', targetLocationId: 'loc-r1', targetLocationName: 'Inventario Ruta',
          plannedDate: '2026-08-11', loadType: 'INITIAL', status: 'STARTED', sellerReceivedByUsername: 'cvendedor',
          createdByUsername: 'admin', items: [{ id: 'it-1', productId: 'p1', productCode: 'GAR-20', productName: 'Garrafon 20L', baseUnitCode: 'GARRAFON', quantityBaseUnits: 50 }]
        }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/sales')) {
        return Promise.resolve(new Response(JSON.stringify([{
          id: 's-10', documentNumber: 'FAC-010', routeId: 'r1', routeCode: 'RUT-01', routeName: 'Ruta Retalhuleu',
          sellerName: 'Carlos Vendedor', customerName: 'Restaurante El Mar', total: 400, createdAt: '2026-08-11T11:00:00Z',
          items: [{ id: 'si-1', productName: 'Garrafon 20L', presentationQuantity: 20, quantityBaseUnits: 20, unitPrice: 20, lineTotal: 400 }]
        }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/inventory/locations')) {
        return Promise.resolve(new Response(JSON.stringify([
          { id: 'loc-r1', code: 'IR-01', name: 'Inventario Retalhuleu', locationType: 'ROUTE', routeId: 'r1', active: true, balances: [{ productId: 'p1', productCode: 'GAR-20', productName: 'Garrafon 20L', baseUnitCode: 'GARRAFON', quantityBaseUnits: 30 }] }
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        generatedAt: '2026-08-11T15:00:00Z', timezone: 'America/Guatemala', currencyCode: 'GTQ',
        salesToday: 400, expectedCash: 400, deliveredCash: 0, transfers: 0, credit: 0,
        monetaryDifferences: 0, inventoryDifferences: 0, approvedWasteUnits: 0,
        pendingWastes: 0, provisionalCustomers: 0, pendingTransfers: 0,
        activeRoutes: 1, completedRoutes: 0, pendingOfflineOperations: 0,
        pendingReturns: 0, pendingAuthorizations: 0, openIncidents: 0, alerts: []
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }));

    // Mock session as VENDEDOR
    const SessionModule = await import('../features/auth/SessionContext');
    vi.spyOn(SessionModule, 'useOptionalSession').mockReturnValue({
      user: { id: 'u-seller', username: 'cvendedor', displayName: 'Carlos Vendedor', deviceId: 'dev-1', roles: ['VENDEDOR'], mustChangePassword: false },
      busy: false,
      initializing: false,
      login: vi.fn(),
      enroll: vi.fn(),
      refresh: vi.fn(),
      changePassword: vi.fn(),
      logout: vi.fn(),
    });

    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <DashboardPage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText(/¡hola, carlos vendedor!/i)).toBeInTheDocument();
    expect(screen.getByText(/vendedor en ruta/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nueva venta/i })).toBeInTheDocument();
    expect(screen.getByText('Efectivo en mano (A entregar)')).toBeInTheDocument();
    expect(screen.getAllByText('Q400.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('30').length).toBeGreaterThan(0); // 30 restantes en camion
    expect(screen.getByText('Restaurante El Mar')).toBeInTheDocument();
  });
});
