import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CustomerLocationModal } from './CustomerLocationModal';

const mockHistoricalPoints = [
  {
    id: 'pt-1',
    pointType: 'HISTORICAL_SALE',
    latitude: 14.635,
    longitude: -90.507,
    accuracyMeters: 12.5,
    capturedAt: '2026-10-10T10:00:00Z',
    referenceText: 'Venta FAC-00123 (Vendedor Juan)',
  },
];

const mockConfirmed = {
  id: 'ccl-1',
  customerId: 'cust-1',
  latitude: 14.6349,
  longitude: -90.5069,
  accuracyMeters: 15.0,
  sourceType: 'ADMIN_MANUAL',
  notes: 'Ubicación verificada en puerta de negocio',
  confirmedAt: '2026-10-12T14:00:00Z',
  status: 'ACTIVE',
};

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CustomerLocationModal
        customerId="cust-1"
        customerName="Abarrotería El Centro"
        onClose={onClose}
      />
    </QueryClientProvider>
  );
}

describe('CustomerLocationModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra las coordenadas confirmadas actuales y el historial de ventas previas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/confirmed-location')) {
          return Promise.resolve(
            new Response(JSON.stringify(mockConfirmed), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }
        if (url.includes('/historical-points')) {
          return Promise.resolve(
            new Response(JSON.stringify(mockHistoricalPoints), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }
        return Promise.resolve(new Response('Not found', { status: 404 }));
      })
    );

    renderModal();

    expect(await screen.findByText('Ubicación Confirmada de Cliente')).toBeInTheDocument();
    expect(screen.getByText('Abarrotería El Centro')).toBeInTheDocument();
    expect(await screen.findByText(/Ubicación actualmente confirmada/i)).toBeInTheDocument();
    expect(screen.getByText('Puntos Históricos de Ventas y Visitas')).toBeInTheDocument();
    expect(await screen.findByText('Venta FAC-00123 (Vendedor Juan)')).toBeInTheDocument();
  });

  it('permite hacer clic en un punto del historial para rellenar el formulario de confirmación', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/confirmed-location')) {
          return Promise.resolve(new Response(null, { status: 404 }));
        }
        if (url.includes('/historical-points')) {
          return Promise.resolve(
            new Response(JSON.stringify(mockHistoricalPoints), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
          );
        }
        return Promise.resolve(new Response('Not found', { status: 404 }));
      })
    );

    renderModal();

    const pointRow = await screen.findByText('Venta FAC-00123 (Vendedor Juan)');
    fireEvent.click(pointRow);

    // Los inputs de latitud y longitud deben tener el valor del punto
    const latInput = screen.getByPlaceholderText('Ej. 14.6349') as HTMLInputElement;
    const lonInput = screen.getByPlaceholderText('Ej. -90.5069') as HTMLInputElement;

    expect(latInput.value).toBe('14.635');
    expect(lonInput.value).toBe('-90.507');
  });
});
