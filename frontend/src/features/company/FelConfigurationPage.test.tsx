import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { FelConfigurationPage } from './FelConfigurationPage';

afterEach(() => vi.unstubAllGlobals());

describe('FelConfigurationPage', () => {
  it('keeps FEL disabled when there is no real provider adapter', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      id: 'fel-1', enabled: false, providerCode: '', environment: 'TEST', establishmentCode: '',
      providerAdapterInstalled: false, credentialsConfigured: false, activationAvailable: false,
      statusMessage: 'FEL desactivado: no hay certificador real y credenciales validadas. Los comprobantes internos continúan disponibles.',
      version: 0, updatedAt: '2026-08-11T00:00:00Z'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))));

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <FelConfigurationPage />
    </QueryClientProvider>);

    expect(screen.getByRole('heading', { name: 'FEL opcional' })).toBeInTheDocument();
    expect(await screen.findByText(/no hay certificador real/i)).toBeInTheDocument();
    expect(screen.getByText('Desactivado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activar FEL' })).toBeDisabled();
    expect(screen.getByText(/comprobante interno no es un DTE/i)).toBeInTheDocument();
  });
});
