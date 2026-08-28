import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, vi } from 'vitest';
import { CustomersPage } from './CustomersPage';

afterEach(() => vi.unstubAllGlobals());

describe('CustomersPage', () => {
  it('muestra clientes con su ruta y vendedor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{
      id: 'c1', code: 'C-001', name: 'Tienda Central', contactName: 'Ana', phone: '55550101',
      whatsapp: '', addressReference: 'Frente al parque', customerType: 'PERMANENT', status: 'ACTIVE',
      creditAllowed: false, creditLimit: 0, currentBalance: 0, routeId: 'r1', routeCode: 'R-01',
      routeName: 'Ruta Centro', sellerId: 's1', sellerName: 'Juan Pérez', registrationState: 'ACTIVE',
      createdAt: '2026-08-10T00:00:00Z'
    }, {
      id: 'c2', code: 'C-002', name: 'Tienda Nueva', contactName: '', phone: '55550102',
      whatsapp: '', addressReference: 'Frente al mercado', customerType: 'PERMANENT', status: 'ACTIVE',
      creditAllowed: false, creditLimit: 0, currentBalance: 0, registrationState: 'ACTIVE',
      createdAt: '2026-08-12T00:00:00Z'
    }]), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><CustomersPage canManage={false} view="list" /></MemoryRouter>
    </QueryClientProvider>);

    expect(screen.getByRole('heading', { name: /^clientes$/i })).toBeInTheDocument();
    expect(await screen.findByText('Tienda Central')).toBeInTheDocument();
    expect(screen.getByText(/Ruta Centro.*Juan Pérez/i)).toBeInTheDocument();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Tienda Nueva');
    expect(rows[2]).toHaveTextContent('Tienda Central');
  });

  it('permite al vendedor guardar un provisional offline desde Clientes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.endsWith('/routes') ? [{
        id: '65f3dd47-02e8-41e1-a4f9-01cb35e8c1e5', code: 'R-01', name: 'Ruta Centro', status: 'ACTIVE',
        sellerId: '1fecc80c-71fa-4013-8fbd-dc8ac61931d1', customerCount: 0, description: '', createdAt: '2026-08-10T00:00:00Z',
      }] : [];
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }));

    render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CustomersPage canManage={false} canCreateRouteCustomer
        deviceId="f31c3ca9-440f-4e8c-87b0-ef13b1e2b2cc" />
    </QueryClientProvider></MemoryRouter>);

    await screen.findByRole('option', { name: /R-01.*Ruta Centro/i });
    fireEvent.change(screen.getByLabelText('Ruta'), { target: { value: '65f3dd47-02e8-41e1-a4f9-01cb35e8c1e5' } });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Tienda Offline' } });
    fireEvent.change(screen.getByLabelText('Dirección o referencia'), { target: { value: 'Frente al mercado' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cliente provisional offline/i }));

    expect(await screen.findByText(/guardado en el teléfono/i)).toBeInTheDocument();
    expect(await screen.findByText('Tienda Offline')).toBeInTheDocument();
  });
});
