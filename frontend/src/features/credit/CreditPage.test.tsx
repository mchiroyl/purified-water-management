import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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
});
