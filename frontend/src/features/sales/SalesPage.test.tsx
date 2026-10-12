import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, vi } from 'vitest';
import { SalesPage } from './SalesPage';

afterEach(() => {
  vi.unstubAllGlobals();
  delete (navigator as { geolocation?: Geolocation }).geolocation;
});

describe('SalesPage', () => {
  async function prepareSaleForm(fetchMock: ReturnType<typeof vi.fn>) {
    render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SalesPage canSell={true} canViewLocation={false} />
    </QueryClientProvider></MemoryRouter>);
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
        return Promise.resolve(new Response('%PDF receipt', {
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

    render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SalesPage canSell={false} canViewLocation={false} />
    </QueryClientProvider></MemoryRouter>);

    expect(screen.getByRole('heading', { level: 1, name: 'Ventas' })).toBeInTheDocument();
    expect(await screen.findByText('V-00000042')).toBeInTheDocument();
    expect(screen.getByText(/Botella 600 ml/)).toBeInTheDocument();
    expect(screen.getAllByText('Q17.00')).toHaveLength(2);
    const createUrl = vi.fn(() => 'blob:receipt');
    const revokeUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeUrl });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: /descargar pdf/i }));
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

    render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SalesPage canSell={true} canViewLocation={false} />
    </QueryClientProvider></MemoryRouter>);
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

    render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SalesPage canSell={true} canViewLocation={false} />
    </QueryClientProvider></MemoryRouter>);
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

  it('permite registrar un cliente provisional en ruta directamente desde la pantalla de venta', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = input.toString();
      if (path.endsWith('/routes')) {
        return Promise.resolve(new Response(JSON.stringify([{ id: 'route-1', code: 'R-01', name: 'Ruta norte', status: 'ACTIVE' }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (path.endsWith('/customers/occasional') && init?.method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify({
          id: 'cust-prov-1', code: 'CLI-000999', name: 'Comedor Doña Marta', status: 'ACTIVE',
          routeId: 'route-1', customerType: 'OCCASIONAL', creditAllowed: false, creditLimit: 0, currentBalance: 0
        }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
      }
      if (path.endsWith('/customers')) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (path.endsWith('/products')) {
        return Promise.resolve(new Response(JSON.stringify([{ id: 'p-1', code: 'GAR', name: 'Garrafon', active: true, controlsInventory: true, presentations: [{ id: 'pres-1', code: 'GAR-20', name: '20L', active: true }] }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <SalesPage canSell={true} canViewLocation={false} />
        </QueryClientProvider>
      </MemoryRouter>
    );

    // Seleccionar ruta
    await screen.findByRole('option', { name: /r-01.*ruta norte/i });
    fireEvent.change(screen.getByLabelText('Ruta'), { target: { value: 'route-1' } });

    // Abrir modal de cliente provisional
    const openBtn = await screen.findByRole('button', { name: /cliente nuevo en ruta \(provisional\)/i });
    fireEvent.click(openBtn);

    expect(screen.getByRole('heading', { name: /cliente nuevo en ruta/i })).toBeInTheDocument();

    // Llenar formulario
    fireEvent.change(screen.getByPlaceholderText(/doña marta/i), { target: { value: 'Comedor Doña Marta' } });
    fireEvent.change(screen.getByPlaceholderText(/frente al parque/i), { target: { value: 'Frente al parque central' } });

    // Guardar
    fireEvent.click(screen.getByRole('button', { name: /guardar y vender ahora/i }));

    // Verificar que se registró y se muestra confirmación
    expect(await screen.findByText(/cliente provisional registrado/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input, init]) => input.toString().endsWith('/customers/occasional') && (init as RequestInit | undefined)?.method === 'POST')).toBe(true);
  });

  it('permite registrar abono en ruta y muestra botones para enviar por WhatsApp y descargar PDF', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const path = input.toString();
      if (path.endsWith('/routes')) {
        return Promise.resolve(new Response(JSON.stringify([{ id: 'route-1', code: 'R-01', name: 'Ruta norte', status: 'ACTIVE' }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (path.endsWith('/customers')) {
        return Promise.resolve(new Response(JSON.stringify([{
          id: 'cust-1', code: 'CLI-001', name: 'Abarrotes La Fe', status: 'ACTIVE',
          routeId: 'route-1', customerType: 'REGULAR', creditAllowed: true, creditLimit: 500, currentBalance: 200, phone: '55551234'
        }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (path.includes('/credit/customers/') && path.endsWith('/balance')) {
        return Promise.resolve(new Response(JSON.stringify({
          customerId: 'cust-1', customerName: 'Abarrotes La Fe', customerCode: 'CLI-001',
          creditAllowed: true, creditLimit: 500, currentBalance: 200, availableCredit: 300
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (path.endsWith('/credit/payments') && init?.method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify({
          id: 'pay-uuid-777', customerId: 'cust-1', customerName: 'Abarrotes La Fe', customerCode: 'CLI-001',
          amount: 50.0, paymentMethod: 'CASH', status: 'CONFIRMED', reference: '', bank: '',
          collectedByName: 'Vendedor', createdAt: '2026-10-12T10:00:00Z'
        }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
      }
      if (path.endsWith('/products')) {
        return Promise.resolve(new Response(JSON.stringify([{ id: 'p-1', code: 'GAR', name: 'Garrafon', active: true, controlsInventory: true, presentations: [{ id: 'pres-1', code: 'GAR-20', name: '20L', active: true }] }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <SalesPage canSell={true} canViewLocation={false} />
        </QueryClientProvider>
      </MemoryRouter>
    );

    // Seleccionar ruta
    await screen.findByRole('option', { name: /r-01.*ruta norte/i });
    fireEvent.change(screen.getByLabelText('Ruta'), { target: { value: 'route-1' } });

    // Seleccionar cliente con deuda
    fireEvent.change(screen.getByLabelText('Cliente'), { target: { value: 'cust-1' } });

    // Abrir formulario de abono
    const abonoBtn = await screen.findByRole('button', { name: /registrar abono/i });
    fireEvent.click(abonoBtn);

    // Llenar monto y registrar
    const amountInput = screen.getByLabelText(/monto/i);
    fireEvent.change(amountInput, { target: { value: '50' } });
    const confirmBtn = screen.getByRole('button', { name: /confirmar abono/i });
    fireEvent.click(confirmBtn);

    // Validar tarjeta de éxito con botones de WhatsApp y PDF
    expect(await screen.findByText(/¡abono registrado exitosamente!/i)).toBeInTheDocument();
    expect(await screen.findByText(/AB-PAY-UUID/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar por whatsapp/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descargar pdf/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /listo \/ continuar/i })).toBeInTheDocument();
  });
});
