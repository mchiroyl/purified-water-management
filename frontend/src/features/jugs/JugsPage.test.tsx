import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JugsPage } from './JugsPage';

afterEach(() => vi.unstubAllGlobals());

describe('JugsPage', () => {
  it('renderiza encabezado y botones para control de garrafones', async () => {
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
                  name: 'Tienda La Esperanza',
                  contactName: 'Carlos',
                  phone: '55551234',
                  routeName: 'Ruta 1',
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
          <JugsPage canRecord={true} canViewSummary={true} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { level: 1, name: /control de garrafones/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /saldos de clientes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /registrar movimiento/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resumen por ruta/i })).toBeInTheDocument();
    expect(await screen.findByText('Tienda La Esperanza')).toBeInTheDocument();
  });
});
