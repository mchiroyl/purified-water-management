import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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
      <PricingPage canManage={false} canApprove={false} canRequestDiscount={false} />
    </QueryClientProvider>);
    expect(screen.getByRole('heading', { name: /precios y mayoreo/i })).toBeInTheDocument();
    expect(await screen.findByText('Lista general')).toBeInTheDocument();
    expect(screen.getByText(/Fardo x12.*1–5.*Q12.00/i)).toBeInTheDocument();
  });
});
