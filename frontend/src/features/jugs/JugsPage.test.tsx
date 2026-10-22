import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JugsPage } from './JugsPage';

afterEach(() => vi.unstubAllGlobals());

describe('JugsPage', () => {
  it('renderiza encabezado, botones y clientes agrupados por ruta con garrafones prestados', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/jugs/outstanding')) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  customerId: 'c1',
                  customerCode: 'C-001',
                  customerName: 'Tienda La Esperanza',
                  customerPhone: '55551234',
                  routeId: 'r1',
                  routeCode: 'R-01',
                  routeName: 'Ruta Centro',
                  jugsOutstanding: 8,
                },
                {
                  customerId: 'c2',
                  customerCode: 'C-002',
                  customerName: 'Abarrotería El Sol',
                  customerPhone: '44445678',
                  routeId: 'r2',
                  routeCode: 'R-02',
                  routeName: 'Ruta Norte',
                  jugsOutstanding: 3,
                },
              ]),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        if (url.endsWith('/customers')) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: 'c1',
                  code: 'C-001',
                  name: 'Tienda La Esperanza',
                  contactName: 'Carlos',
                  phone: '55551234',
                  routeId: 'r1',
                  routeName: 'Ruta Centro',
                },
                {
                  id: 'c2',
                  code: 'C-002',
                  name: 'Abarrotería El Sol',
                  contactName: 'Ana',
                  phone: '44445678',
                  routeId: 'r2',
                  routeName: 'Ruta Norte',
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
                { id: 'r1', code: 'R-01', name: 'Ruta Centro' },
                { id: 'r2', code: 'R-02', name: 'Ruta Norte' },
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
          <JugsPage canRecord={true} canViewSummary={true} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { level: 1, name: /control de garrafones/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /saldos de clientes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /registrar movimiento/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resumen por ruta/i })).toBeInTheDocument();

    // Comprobar tarjetas KPI
    expect(await screen.findByText('Total Garrafones en Calle')).toBeInTheDocument();
    expect(screen.getByText('Clientes con Garrafones')).toBeInTheDocument();

    // Comprobar clientes y rutas agrupadas
    expect(await screen.findByText('Tienda La Esperanza')).toBeInTheDocument();
    expect(screen.getAllByText(/8 garrafones/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3 garrafones/i).length).toBeGreaterThan(0);

    // Probar filtro por buscador de cliente
    const searchInput = screen.getByPlaceholderText(/buscar por cliente, código/i);
    fireEvent.change(searchInput, { target: { value: 'Esperanza' } });

    expect(screen.getByText('Tienda La Esperanza')).toBeInTheDocument();
    expect(screen.queryByText('Abarrotería El Sol')).not.toBeInTheDocument();
  });

  it('muestra aviso cuando un cliente buscado tiene garrafones en múltiples rutas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/jugs/outstanding')) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  customerId: 'c1',
                  customerCode: 'C-001',
                  customerName: 'Restaurante Central',
                  customerPhone: '55559999',
                  routeId: 'r1',
                  routeCode: 'R-01',
                  routeName: 'Ruta Centro',
                  jugsOutstanding: 10,
                },
                {
                  customerId: 'c1',
                  customerCode: 'C-001',
                  customerName: 'Restaurante Central',
                  customerPhone: '55559999',
                  routeId: 'r2',
                  routeCode: 'R-02',
                  routeName: 'Ruta Sur',
                  jugsOutstanding: 5,
                },
              ]),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
          );
        }
        if (url.endsWith('/customers')) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  id: 'c1',
                  code: 'C-001',
                  name: 'Restaurante Central',
                  phone: '55559999',
                  routeId: 'r1',
                  routeName: 'Ruta Centro',
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
          <JugsPage canRecord={true} canViewSummary={true} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const searchInput = await screen.findByPlaceholderText(/buscar por cliente, código/i);
    fireEvent.change(searchInput, { target: { value: 'Restaurante Central' } });

    expect(await screen.findByText(/múltiples rutas/i)).toBeInTheDocument();
    expect(screen.getByText(/15 garrafones prestados/i)).toBeInTheDocument();
  });
});
