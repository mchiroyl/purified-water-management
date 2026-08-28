import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, vi } from 'vitest';
import { ProductCatalogPage } from './ProductCatalogPage';

afterEach(() => vi.unstubAllGlobals());

describe('ProductCatalogPage', () => {
  it('muestra productos y sus conversiones obtenidas del servidor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {
        id: 'product-1', code: 'AGUA-600', name: 'Agua pura 600 ml', description: '',
        baseUnitCode: 'BOTELLA', active: true, controlsInventory: true,
        presentations: [
          { id: 'presentation-1', code: 'FARDO-12', name: 'Fardo x12', unitCode: 'FARDO', conversionFactor: 12, active: true }
        ]
      }
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ProductCatalogPage view="list" />
        </QueryClientProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Productos' })).toBeInTheDocument();
    expect(await screen.findByText('Agua pura 600 ml')).toBeInTheDocument();
    expect(screen.getByText('Fardo x12')).toBeInTheDocument();
    expect(screen.getByText('BOTELLA')).toBeInTheDocument();
  });
});
