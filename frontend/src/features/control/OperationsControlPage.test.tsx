import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { OperationsControlPage } from './OperationsControlPage';

afterEach(() => vi.unstubAllGlobals());

describe('OperationsControlPage', () => {
  it('separa solicitudes, decisiones e incidencias', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const path=String(input);
      const body=path.endsWith('/authorizations') ? [{ id: 'auth-1', authorizationType: 'LOAD_CORRECTION',
        entityType: 'ROUTE_LOAD', entityId: 'load-1', requestedByUsername: 'vendedor', reason: 'Ajuste',
        status: 'REQUESTED', expiresAt: '2026-08-12T00:00:00Z' }] : path.endsWith('/incidents') ? [{
        id: 'incident-1', routeCode: 'R-01', routeName: 'Centro', incidentType: 'CASH_DIFFERENCE',
        severity: 'HIGH', status: 'OPEN', description: 'Faltante', reportedByUsername: 'vendedor' }] : [];
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200,
        headers: { 'Content-Type': 'application/json' } }));
    }));

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <OperationsControlPage canDecide />
    </QueryClientProvider>);

    expect(screen.getByRole('heading', { name: 'Autorizaciones e incidencias' })).toBeInTheDocument();
    expect(await screen.findByText('Solicitud pendiente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeInTheDocument();
    expect(screen.getByText(/Incidencia abierta/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resolver' })).toBeInTheDocument();
  });
});
