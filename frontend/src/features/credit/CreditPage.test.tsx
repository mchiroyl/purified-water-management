import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreditPage } from './CreditPage';

afterEach(() => vi.unstubAllGlobals());

describe('CreditPage', () => {
  it('renderiza encabezado y pestañas operativas de crédito y abonos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/customers')) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: 'c1',
                  code: 'C-001',
                  name: 'Farmacia El Milagro',
                  currentBalance: 350.0,
                  creditLimit: 1000.0,
                  creditAllowed: true,
                },
              ]),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        if (url.endsWith('/routes')) {
          return Promise.resolve(
            new Response(JSON.stringify([{ id: 'r1', code: 'R-01', name: 'Ruta Centro' }]), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      })
    );

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <CreditPage canRecord={true} canVerify={true} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { level: 1, name: /créditos y abonos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /estados de cuenta/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /registrar abono/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verificar transferencias/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cartera por ruta/i })).toBeInTheDocument();
  });

  it('agrupa deudores por ruta y cliente para el usuario admin', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/customers')) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: 'c1',
                  code: 'C-001',
                  name: 'Farmacia El Milagro',
                  currentBalance: 350.0,
                  creditLimit: 1000.0,
                  creditAllowed: true,
                  routeId: 'r1',
                  routeCode: 'R-01',
                  routeName: 'Ruta Reu',
                  sellerName: 'M. Chiroy',
                },
                {
                  id: 'c2',
                  code: 'C-002',
                  name: 'Abarrotes Don Pepe',
                  currentBalance: 0.0,
                  creditLimit: 500.0,
                  creditAllowed: true,
                  routeId: 'r1',
                  routeCode: 'R-01',
                  routeName: 'Ruta Reu',
                },
                {
                  id: 'c3',
                  code: 'C-003',
                  name: 'Tienda La Bendición',
                  currentBalance: 200.0,
                  creditLimit: 600.0,
                  creditAllowed: true,
                  routeId: 'r2',
                  routeCode: 'R-02',
                  routeName: 'Ruta Mazate',
                  sellerName: 'A. Martinez',
                },
              ]),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        if (url.endsWith('/routes')) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                { id: 'r1', code: 'R-01', name: 'Ruta Reu', sellerName: 'M. Chiroy' },
                { id: 'r2', code: 'R-02', name: 'Ruta Mazate', sellerName: 'A. Martinez' },
              ]),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      })
    );

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <CreditPage canRecord={true} canVerify={true} isAdmin={true} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole('heading', { level: 2, name: /cartera de clientes deudores por ruta/i })).toBeInTheDocument();
    expect(await screen.findByText(/farmacia el milagro/i)).toBeInTheDocument();
    expect(await screen.findByText(/tienda la bendición/i)).toBeInTheDocument();
    expect(screen.queryByText(/abarrotes don pepe/i)).not.toBeInTheDocument();
  });

  it('muestra los productos dejados a crédito para cada cliente con deuda', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/customers')) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: 'c1',
                  code: 'CLI-001',
                  name: 'Aby',
                  currentBalance: 90.0,
                  creditLimit: 200.0,
                  creditAllowed: true,
                  routeId: 'r1',
                  routeCode: 'RUT-000003',
                  routeName: 'San José y Tonquin',
                },
              ]),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        if (url.endsWith('/sales')) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: 's1',
                  customerId: 'c1',
                  status: 'CONFIRMED',
                  creditAmount: 90.0,
                  createdAt: '2026-09-30T10:00:00Z',
                  items: [
                    { id: 'si1', productName: 'Garrafon', presentationQuantity: 2, quantityBaseUnits: 2 },
                    { id: 'si2', productName: 'Fardo', presentationQuantity: 1, quantityBaseUnits: 1 },
                  ],
                  payments: [{ method: 'CREDIT', amount: 90.0, status: 'APPLIED' }],
                },
              ]),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      })
    );

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <CreditPage canRecord={true} canVerify={true} isAdmin={true} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText('Productos a Crédito')).toBeInTheDocument();
    expect(await screen.findByText('Garrafon')).toBeInTheDocument();
    expect(await screen.findByText('Fardo')).toBeInTheDocument();
  });

  it('permite al administrador auditar el historial de abonos y muestra últimos abonos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/customers')) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: 'c1',
                  code: 'CLI-001',
                  name: 'Farmacia El Milagro',
                  currentBalance: 350.0,
                  creditLimit: 1000.0,
                  creditAllowed: true,
                  routeId: 'r1',
                  routeCode: 'R-01',
                  routeName: 'Ruta Reu',
                },
              ]),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        if (url.endsWith('/routes')) {
          return Promise.resolve(
            new Response(
              JSON.stringify([{ id: 'r1', code: 'R-01', name: 'Ruta Reu' }]),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        if (url.endsWith('/credit/payments')) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: 'pay-001-uuid-1234',
                  customerId: 'c1',
                  customerName: 'Farmacia El Milagro',
                  customerCode: 'CLI-001',
                  amount: 80.0,
                  paymentMethod: 'CASH',
                  status: 'CONFIRMED',
                  reference: '',
                  bank: '',
                  collectedByName: 'Vendedor Juan',
                  createdAt: '2026-10-10T14:30:00Z',
                },
              ]),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      })
    );

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter>
          <CreditPage canRecord={true} canVerify={true} isAdmin={true} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verifica que en la tabla de deudores se muestre la columna Último Abono
    expect(await screen.findByText('Último Abono')).toBeInTheDocument();
    expect(await screen.findByText(/Q 80.00/)).toBeInTheDocument();

    // Navega a la pestaña de Historial de Abonos
    const historyButton = screen.getByRole('button', { name: /historial de abonos/i });
    expect(historyButton).toBeInTheDocument();
    fireEvent.click(historyButton);

    // Verifica que se renderice el panel de auditoría de abonos y KPIs
    expect(await screen.findByRole('heading', { level: 2, name: /historial y control de abonos/i })).toBeInTheDocument();
    expect(await screen.findByText(/total abonos cobrados/i)).toBeInTheDocument();
    expect(await screen.findByText(/efectivo físico/i)).toBeInTheDocument();
    expect(await screen.findByText('AB-PAY-001-')).toBeInTheDocument();
    expect(await screen.findByText('Vendedor Juan')).toBeInTheDocument();
  });
});
