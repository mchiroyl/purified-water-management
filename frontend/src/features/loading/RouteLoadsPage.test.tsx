import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { RouteLoadsPage } from './RouteLoadsPage';

afterEach(() => vi.unstubAllGlobals());

function renderPage() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <RouteLoadsPage canPrepare={false} canConfirmWarehouse={false} canReceive={true} canStart={false} canCorrect={false} />
  </QueryClientProvider>);
}

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

  it('envía la ubicación obtenida al confirmar la recepción', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({
      coords: { latitude: 14.6349, longitude: -90.5069, accuracy: 6 },
    } as GeolocationPosition));
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (input.toString().endsWith('/loads/l1/receipt')) {
        return Promise.resolve(new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (input.toString().endsWith('/loads')) {
        return Promise.resolve(new Response(JSON.stringify([{
          id: 'l1', loadNumber: 'CARGA-000001', routeId: 'r1', routeCode: 'R-01', routeName: 'Ruta norte',
          sourceLocationId: 'w1', sourceLocationName: 'Bodega central', targetLocationId: 't1', targetLocationName: 'Inventario ruta norte',
          plannedDate: '2026-08-10', loadType: 'INITIAL', notes: '', status: 'WAREHOUSE_CONFIRMED', createdByUsername: 'bodega',
          items: [], corrections: [],
        }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (input.toString().endsWith('/company-configuration')) {
        return Promise.resolve(new Response(JSON.stringify({ timezone: 'America/Guatemala' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar recepción' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input]) => input.toString().endsWith('/loads/l1/receipt'));
      expect(call).toBeDefined();
      expect(JSON.parse((call?.[1] as RequestInit).body as string)).toMatchObject({
        location: { latitude: 14.6349, longitude: -90.5069, accuracyMeters: 6 },
      });
    });
  });

  it('no confirma la recepción si se deniega la ubicación', async () => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: vi.fn((_success: PositionCallback, failure: PositionErrorCallback) => failure({ code: 1 } as GeolocationPositionError)) } });
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (input.toString().endsWith('/loads')) {
        return Promise.resolve(new Response(JSON.stringify([{
          id: 'l1', loadNumber: 'CARGA-000001', routeId: 'r1', routeCode: 'R-01', routeName: 'Ruta norte',
          sourceLocationId: 'w1', sourceLocationName: 'Bodega central', targetLocationId: 't1', targetLocationName: 'Inventario ruta norte',
          plannedDate: '2026-08-10', loadType: 'INITIAL', notes: '', status: 'WAREHOUSE_CONFIRMED', createdByUsername: 'bodega', items: [], corrections: [],
        }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (input.toString().endsWith('/company-configuration')) {
        return Promise.resolve(new Response(JSON.stringify({ timezone: 'America/Guatemala' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });
    vi.stubGlobal('fetch', fetchMock);

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar recepción' }));

    expect(await screen.findByText(/se requiere permitir el acceso a la ubicación/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => input.toString().endsWith('/loads/l1/receipt'))).toBe(false);
  });
});
