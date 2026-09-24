import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, vi } from 'vitest';
import { PricingPage } from './PricingPage';

afterEach(() => vi.unstubAllGlobals());

describe('PricingPage', () => {
  it('muestra versiones y tramos configurados por el servidor', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = input.toString();
      const value = url.includes('/pricing/lists') ? [{
        id: 'l1', code: 'GENERAL', name: 'Lista general', status: 'ACTIVE', currencyCode: 'GTQ',
        versions: [{ id: 'v1', versionNumber: 1, validFrom: '2026-08-10T00:00:00Z', status: 'ACTIVE',
          tiers: [{ id: 't1', presentationId: 'p1', presentationCode: 'FARDO-12', presentationName: 'Fardo x12', minimumBaseUnits: 1, maximumBaseUnits: 5, unitPrice: 12 }] }]
      }] : [];
      return Promise.resolve(new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }));
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><PricingPage view="list" canManage={false} canApprove={false} canRequestDiscount={false} /></MemoryRouter>
    </QueryClientProvider>);
    expect(screen.getByRole('heading', { name: /precios registrados/i })).toBeInTheDocument();
    expect(await screen.findByText('Lista general')).toBeInTheDocument();
    expect(screen.getByText(/Fardo x12.*1–5.*Q12.00/i)).toBeInTheDocument();
  });

  it('ofrece una vista separada para consultar precios registrados', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))));
    render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PricingPage view="list" canManage={false} canApprove={false} canRequestDiscount={false} />
    </QueryClientProvider></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Precios registrados' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar nuevos precios' })).toBeInTheDocument();
    expect(screen.getByText('Listas y versiones registradas')).toBeInTheDocument();
  });

  it('mantiene los formularios separados de los precios registrados', () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))));
    render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PricingPage canManage canApprove canRequestDiscount />
    </QueryClientProvider></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Registrar precios' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nueva lista' })).toBeInTheDocument();
    expect(screen.queryByText('Resumen de listas')).not.toBeInTheDocument();
    expect(screen.queryByText('Precios especiales registrados')).not.toBeInTheDocument();
    expect(screen.queryByText('Solicitudes de descuento registradas')).not.toBeInTheDocument();
  });

  it('muestra ventana flotante Datos grabados, limpia los campos y permite cerrar con OK', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (url.includes('/pricing/lists') && !url.includes('/versions')) {
        return Promise.resolve(new Response(JSON.stringify([{
          id: 'l1', code: 'LST-0001', name: 'General', status: 'ACTIVE', currencyCode: 'GTQ', versions: []
        }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/products')) {
        return Promise.resolve(new Response(JSON.stringify([{
          id: 'p1', name: 'Garrafon', presentations: [{ id: 'pres1', code: 'G-18', name: 'Garrafón 18.9 L', active: true }]
        }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      if (url.includes('/versions') && init?.method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify({
          id: 'l1', code: 'LST-0001', name: 'General', status: 'ACTIVE', currencyCode: 'GTQ',
          versions: [{ id: 'v1', versionNumber: 1, validFrom: '2026-09-24T00:00:00Z', status: 'DRAFT', tiers: [] }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }));

    render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PricingPage canManage canApprove canRequestDiscount />
    </QueryClientProvider></MemoryRouter>);

    const saveButton = await screen.findByRole('button', { name: 'Guardar versión' });
    fireEvent.submit(saveButton.closest('form')!);

    expect(await screen.findByText('Datos grabados')).toBeInTheDocument();
    expect(screen.getAllByText(/Versión 1 registrada exitosamente/i).length).toBeGreaterThanOrEqual(1);

    const okButton = screen.getByRole('button', { name: 'OK' });
    fireEvent.click(okButton);

    expect(screen.queryByText('Datos grabados')).not.toBeInTheDocument();

    const desdeInput = screen.getByPlaceholderText('1') as HTMLInputElement;
    expect(desdeInput.value).toBe('');
  });
});
