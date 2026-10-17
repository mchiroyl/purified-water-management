import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { VendorItineraryPanel } from './VendorItineraryPanel';

const mockItineraryRun = {
  id: 'run-1',
  routeId: 'route-1',
  routeCode: 'RUT-01',
  routeName: 'Ruta Centro',
  sellerUserId: 'seller-1',
  planDate: '2026-10-13',
  status: 'PUBLISHED',
  totalStops: 2,
  completedStops: 1,
  publishedAt: '2026-10-13T08:00:00Z',
  stops: [
    {
      id: 'stop-1',
      runId: 'run-1',
      customerId: 'cust-1',
      customerCode: 'CLI-001',
      customerName: 'Abarrotería El Centro',
      contactPhone: '55551234',
      addressReference: 'Calle principal 2-40',
      targetLatitude: 14.6349,
      targetLongitude: -90.5069,
      stopOrder: 1,
      instructions: 'Entregar antes de las 10am',
      status: 'ATTENDED_SALE',
      attendedAt: '2026-10-13T08:30:00Z',
      hasLocationMismatch: false,
    },
    {
      id: 'stop-2',
      runId: 'run-1',
      customerId: 'cust-2',
      customerCode: 'CLI-002',
      customerName: 'Tienda La Bendición',
      contactPhone: '55555678',
      addressReference: '3ra avenida 5-12',
      targetLatitude: 14.638,
      targetLongitude: -90.512,
      stopOrder: 2,
      instructions: null,
      status: 'PENDING',
      attendedAt: null,
      hasLocationMismatch: false,
    },
  ],
};

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <VendorItineraryPanel routeId="route-1" isSeller />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('VendorItineraryPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra el recorrido activo con paradas ordenadas y barra de progreso', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/itineraries/active')) {
          return Promise.resolve(
            new Response(JSON.stringify(mockItineraryRun), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }
        return Promise.resolve(new Response('Not found', { status: 404 }));
      })
    );

    renderPanel();

    expect(await screen.findByText('Ruta Centro')).toBeInTheDocument();
    expect(screen.getByText('Progreso de visitas')).toBeInTheDocument();
    expect(screen.getByText(/1 de 2 paradas \(50%\)/)).toBeInTheDocument();

    // Comprobar paradas renderizadas
    expect(screen.getByText('Abarrotería El Centro')).toBeInTheDocument();
    expect(screen.getByText('Tienda La Bendición')).toBeInTheDocument();
    expect(screen.getByText('Venta realizada')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Entregar antes de las 10am')).toBeInTheDocument();
  });

  it('permite abrir el modal de aplazamiento / posponer parada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/itineraries/active')) {
          return Promise.resolve(
            new Response(JSON.stringify(mockItineraryRun), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }
        return Promise.resolve(new Response('Not found', { status: 404 }));
      })
    );

    renderPanel();

    await screen.findByText('Tienda La Bendición');

    // Clic en Posponer
    const postponeBtn = screen.getByTitle('Posponer parada por bloqueo de acceso');
    fireEvent.click(postponeBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Posponer parada 2/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Calle bloqueada/i)).toBeInTheDocument();
  });

  it('muestra estado vacío amigable cuando no hay itinerario publicado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        return Promise.resolve(new Response(null, { status: 404 }));
      })
    );

    renderPanel();

    expect(await screen.findByText('Sin recorrido activo hoy')).toBeInTheDocument();
    expect(screen.getByText(/No hay un recorrido activo para esta ruta hoy/i)).toBeInTheDocument();
  });
});
