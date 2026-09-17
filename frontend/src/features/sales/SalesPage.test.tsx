import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { SalesPage } from './SalesPage';

afterEach(() => {
  vi.unstubAllGlobals();
  delete (navigator as { geolocation?: Geolocation }).geolocation;
});

describe('SalesPage', () => {
  async function prepareSaleForm(fetchMock: ReturnType<typeof vi.fn>) {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SalesPage canSell={true} canViewLocation={false} />
    </QueryClientProvider>);
    await screen.findByRole('option', { name: /r-01.*ruta norte/i });
    fireEvent.change(screen.getByLabelText('Ruta'), { target: { value: 'route-1' } });
    await waitFor(() => expect(screen.getByLabelText('Cliente')).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'customer-1' } });
    fireEvent.change(screen.getByLabelText('Presentación'), { target: { value: 'presentation-1' } });
    expect(fetchMock).toBeDefined();
  }

  function formFetchMock() {
    return vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      const path = input.toString();
      const value = path.endsWith('/routes') ? [{ id: 'route-1', code: 'R-01', name: 'Ruta norte', status: 'ACTIVE' }]
        : path.endsWith('/customers') ? [{ id: 'customer-1', code: 'C-01', name: 'Tienda La Fuente', status: 'ACTIVE', routeId: 'route-1', customerType: 'OCCASIONAL', creditAllowed: false, creditLimit: 0, currentBalance: 0 }]
        : path.endsWith('/products') ? [{ id: 'product-1', code: 'AGUA', name: 'Agua pura', active: true, controlsInventory: true, presentations: [{ id: 'presentation-1', code: 'BOT-600', name: 'Botella 600 ml', active: true }] }]
        : [];
      return Promise.resolve(new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });
  }

  it('muestra el número, precios y total calculados por el servidor', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const path = input.toString();
      if (path.endsWith('/sales/sale-1/receipt')) {
        return Promise.resolve(new Response(new Blob(['%PDF receipt'], { type: 'application/pdf' }), {
          status: 200, headers: { 'Content-Type': 'application/pdf', 'X-Document-Type': 'INTERNAL_RECEIPT' }
        }));
      }
      const value = path.endsWith('/sales') ? [{
        id: 'sale-1', clientReference: 'reference-1', documentNumber: 'V-00000042',
        routeId: 'route-1', routeCode: 'R-01', routeName: 'Ruta norte',
        sellerId: 'seller-1', sellerName: 'Ana Pérez', customerId: 'customer-1',
        customerCode: 'C-01', customerName: 'Tienda La Fuente', status: 'CONFIRMED',
        subtotal: 17, total: 17, currencyCode: 'GTQ', companyName: 'Agua Pura',
        companyTaxId: '1234567-8', companyAddress: 'Guatemala', documentLegend: 'Gracias',
        createdBy: 'user-1', createdByUsername: 'ana', deviceId: 'device-1',
        createdAt: '2026-08-10T15:00:00Z', items: [{ id: 'item-1', productId: 'product-1',
          productCode: 'AGUA', productName: 'Agua pura', presentationId: 'presentation-1',
          presentationCode: 'BOT-600', presentationName: 'Botella 600 ml',
          presentationQuantity: 2, quantityBaseUnits: 2, unitPrice: 8.5,
          lineTotal: 17, priceSource: 'TIER' }]
      }] : [];
      return Promise.resolve(new Response(JSON.stringify(value), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      }));
    }));

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SalesPage canSell={false} canViewLocation={false} />
    </QueryClientProvider>);

    expect(screen.getByRole('heading', { level: 1, name: 'Ventas' })).toBeInTheDocument();
    expect(await screen.findByText('V-00000042')).toBeInTheDocument();
    expect(screen.getByText(/Botella 600 ml.*2.*Q8.50/i)).toBeInTheDocument();
    expect(screen.getAllByText('Q17.00')).toHaveLength(3);
    const createUrl = vi.fn(() => 'blob:receipt');
    const revokeUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeUrl });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    await waitFor(() => expect(createUrl).toHaveBeenCalled());
    expect(click).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith('blob:receipt');
  });

  it('envía la ubicación obtenida al confirmar una venta', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition: vi.fn((success: PositionCallback) => {
        success({ coords: { latitude: 14.6349, longitude: -90.5069, accuracy: 7 } } as GeolocationPosition);
        return 1;
      }),
      clearWatch: vi.fn(),
    } });
    const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      const path = input.toString();
      const value = path.endsWith('/routes') ? [{ id: 'route-1', code: 'R-01', name: 'Ruta norte', status: 'ACTIVE' }]
        : path.endsWith('/customers') ? [{ id: 'customer-1', code: 'C-01', name: 'Tienda La Fuente', status: 'ACTIVE', routeId: 'route-1', customerType: 'OCCASIONAL', creditAllowed: false, creditLimit: 0, currentBalance: 0 }]
        : path.endsWith('/products') ? [{ id: 'product-1', code: 'AGUA', name: 'Agua pura', active: true, controlsInventory: true, presentations: [{ id: 'presentation-1', code: 'BOT-600', name: 'Botella 600 ml', active: true }] }]
        : path.endsWith('/sales') ? [] : [];
      return Promise.resolve(new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SalesPage canSell={true} canViewLocation={false} />
    </QueryClientProvider>);
    await screen.findByRole('option', { name: /r-01.*ruta norte/i });
    fireEvent.change(screen.getByLabelText('Ruta'), { target: { value: 'route-1' } });
    await waitFor(() => expect(screen.getByLabelText('Cliente')).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'customer-1' } });
    fireEvent.change(screen.getByLabelText('Presentación'), { target: { value: 'presentation-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([input, init]) => input.toString().endsWith('/sales') && (init as RequestInit | undefined)?.method === 'POST');
      expect(call).toBeDefined();
      expect(JSON.parse((call?.[1] as RequestInit).body as string)).toMatchObject({
        routeId: 'route-1', customerId: 'customer-1', location: { latitude: 14.6349, longitude: -90.5069, accuracyMeters: 7 },
      });
    });
  });

  it('bloquea una segunda confirmación mientras obtiene la ubicación', async () => {
    let resolvePosition!: PositionCallback;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition: vi.fn((success: PositionCallback) => {
        resolvePosition = success;
        return 1;
      }),
      clearWatch: vi.fn(),
    } });
    const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      const path = input.toString();
      const value = path.endsWith('/routes') ? [{ id: 'route-1', code: 'R-01', name: 'Ruta norte', status: 'ACTIVE' }]
        : path.endsWith('/customers') ? [{ id: 'customer-1', code: 'C-01', name: 'Tienda La Fuente', status: 'ACTIVE', routeId: 'route-1', customerType: 'OCCASIONAL', creditAllowed: false, creditLimit: 0, currentBalance: 0 }]
        : path.endsWith('/products') ? [{ id: 'product-1', code: 'AGUA', name: 'Agua pura', active: true, controlsInventory: true, presentations: [{ id: 'presentation-1', code: 'BOT-600', name: 'Botella 600 ml', active: true }] }]
        : [];
      return Promise.resolve(new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SalesPage canSell={true} canViewLocation={false} />
    </QueryClientProvider>);
    await screen.findByRole('option', { name: /r-01.*ruta norte/i });
    fireEvent.change(screen.getByLabelText('Ruta'), { target: { value: 'route-1' } });
    await waitFor(() => expect(screen.getByLabelText('Cliente')).not.toBeDisabled());
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'customer-1' } });
    fireEvent.change(screen.getByLabelText('Presentación'), { target: { value: 'presentation-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));

    const submit = await screen.findByRole('button', { name: 'Refinando precisión GPS…' });
    expect(submit).toBeDisabled();
    expect(fetchMock.mock.calls.some(([input, init]) => input.toString().endsWith('/sales') && (init as RequestInit | undefined)?.method === 'POST')).toBe(false);

    resolvePosition({ coords: { latitude: 14.6349, longitude: -90.5069, accuracy: 7 } } as GeolocationPosition);
    await waitFor(() => expect(fetchMock.mock.calls.some(([input, init]) => input.toString().endsWith('/sales') && (init as RequestInit | undefined)?.method === 'POST')).toBe(true));
  });

  it('no crea una venta cuando el usuario deniega la ubicación', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      watchPosition: vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
        error?.({ code: 1, message: 'denied' } as GeolocationPositionError);
        return 1;
      }),
      clearWatch: vi.fn(),
    } });
    const fetchMock = formFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    await prepareSaleForm(fetchMock);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));

    expect(await screen.findByText(/Se requiere permitir el acceso a la ubicación/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input, init]) => input.toString().endsWith('/sales') && (init as RequestInit | undefined)?.method === 'POST')).toBe(false);
  });

  it('no crea una venta cuando el dispositivo no admite geolocalización', async () => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    const fetchMock = formFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    await prepareSaleForm(fetchMock);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));

    expect(await screen.findByText(/Este dispositivo no permite obtener la ubicación/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input, init]) => input.toString().endsWith('/sales') && (init as RequestInit | undefined)?.method === 'POST')).toBe(false);
  });
});
