import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

    expect((await screen.findAllByText('Ruta Retalhuleu'))[0]).toBeInTheDocument();
    expect(screen.getAllByText(/amartinez/i)[0]).toBeInTheDocument();
    expect(screen.getByText('100 GARRAFON')).toBeInTheDocument();
    expect(screen.getByText('30 GARRAFON')).toBeInTheDocument();
    expect(screen.getAllByText('70 GARRAFON')).toHaveLength(2);
    // La lista de últimas ventas fue reemplazada por el dashboard gerencial de gráficas;
    // el cliente individual no se muestra en panel admin (sí en panel vendedor)
    expect(screen.getByText(/ranking de ventas por vendedor/i)).toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: /ver cargas/i })).toBeInTheDocument();
    expect(screen.getByText('Efectivo en mano (A entregar)')).toBeInTheDocument();
    expect(screen.getAllByText('Q400.00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('30').length).toBeGreaterThan(0); // 30 restantes en camion
    expect(screen.getByText('Restaurante El Mar')).toBeInTheDocument();
  });

  it('permite filtrar por Ayer y Personalizado mostrando la ruta histórica del vendedor', async () => {
    const SessionModule = await import('../features/auth/SessionContext');
    vi.spyOn(SessionModule, 'useOptionalSession').mockReturnValue({
      user: { id: 'u-admin', username: 'admin', displayName: 'Administrador', deviceId: 'dev-1', roles: ['ADMINISTRADOR'], mustChangePassword: false },
      busy: false,
      initializing: false,
      login: vi.fn(),
      enroll: vi.fn(),
      refresh: vi.fn(),
      changePassword: vi.fn(),
      logout: vi.fn(),
    });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url.includes('/loads')) {
        return Promise.resolve(new Response(JSON.stringify([{
          id: 'load-amilcar-yesterday', loadNumber: 'CARGA-000010', routeId: 'r-retalhuleu', routeCode: 'RUT-01', routeName: 'Ruta Retalhuleu',
          sourceLocationId: 'loc-1', sourceLocationName: 'Bodega Central', targetLocationId: 'loc-r1', targetLocationName: 'Inventario Ruta',
          plannedDate: yStr, loadType: 'INITIAL', status: 'STARTED', sellerReceivedByUsername: 'amartinez',
          createdByUsername: 'admin', items: [{ id: 'it-1', productId: 'p1', productCode: 'GAR-20', productName: 'Garrafon 20L', baseUnitCode: 'GARRAFON', quantityBaseUnits: 70 }]
        }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/settlements')) {
        return Promise.resolve(new Response(JSON.stringify([{
          id: 'sett-10', routeLoadId: 'load-amilcar-yesterday', loadNumber: 10, routeCode: 'RUT-01', routeName: 'Ruta Retalhuleu',
          sellerName: 'Amilcar Israel Martinez Ageataz', status: 'WITH_DIFFERENCE', salesTotal: 1017, salesCash: 967, deliveredCash: 0,
          monetaryDifference: 967, physicalDifferenceTotal: 14,
          items: [{ id: 'si-1', productName: 'Garrafon 20L', loadedUnits: 70, soldUnits: 56, physicalDifference: 14 }]
        }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/sales')) {
        return Promise.resolve(new Response(JSON.stringify([{
          id: 's-amilcar', documentNumber: 'V-00000258', routeId: 'r-retalhuleu', routeCode: 'RUT-01', routeName: 'Ruta Retalhuleu',
          sellerName: 'Amilcar Israel Martinez Ageataz', customerName: 'Cliente Retalhuleu', total: 1017, createdAt: `${yStr}T20:00:00Z`,
          items: [{ id: 'si-1', productName: 'Garrafon 20L', presentationQuantity: 56, quantityBaseUnits: 56, unitPrice: 10, lineTotal: 1017 }]
        }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/inventory/locations') || url.includes('/products') || url.includes('/pricing/lists')) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        generatedAt: `${yStr}T23:00:00Z`, timezone: 'America/Guatemala', currencyCode: 'GTQ',
        salesToday: 50, expectedCash: 50, deliveredCash: 50, transfers: 0, credit: 0,
        monetaryDifferences: 0, inventoryDifferences: 0, approvedWasteUnits: 0,
        pendingWastes: 0, provisionalCustomers: 0, pendingTransfers: 0,
        activeRoutes: 1, completedRoutes: 1, pendingOfflineOperations: 0,
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

    // Esperar a que el panel operativo monte y cargue los datos iniciales
    expect(await screen.findByText('Q50.00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ayer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /personalizado/i })).toBeInTheDocument();

    // Al hacer clic en "Ayer"
    fireEvent.click(screen.getByRole('button', { name: /ayer/i }));

    // Debe mostrar la ruta y liquidación de Amílcar de ayer
    expect(await screen.findByText(/ruta retalhuleu/i)).toBeInTheDocument();
    expect(screen.getAllByText(/amartinez|amilcar/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Q1,017.00').length).toBeGreaterThanOrEqual(1);

    // Al hacer clic en "Personalizado"
    fireEvent.click(screen.getByRole('button', { name: /personalizado/i }));
    const startDateInput = screen.getByLabelText(/desde:/i) as HTMLInputElement;
    const endDateInput = screen.getByLabelText(/hasta:/i) as HTMLInputElement;
    expect(startDateInput).toBeInTheDocument();
    expect(endDateInput).toBeInTheDocument();

    // 1. Si fecha Desde es ayer y Hasta está vacío, debe encontrar la ruta de ayer
    fireEvent.change(startDateInput, { target: { value: yStr } });
    expect(screen.getByText(/ruta retalhuleu/i)).toBeInTheDocument();

    // 2. Si fecha Desde es hace 5 días y Hasta está vacío, NO debe encontrar la ruta de ayer
    fireEvent.change(startDateInput, { target: { value: '2020-01-01' } });
    expect(screen.queryByText(/ruta retalhuleu/i)).not.toBeInTheDocument();

    // 3. Si se define un rango Hasta que cubre la fecha de ayer ('2020-01-01' a '2030-01-01'), debe volver a mostrarla
    fireEvent.change(endDateInput, { target: { value: '2030-01-01' } });
    expect(await screen.findByText(/ruta retalhuleu/i)).toBeInTheDocument();
  });
});
