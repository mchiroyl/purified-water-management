import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { SalesPage } from './SalesPage';

afterEach(() => vi.unstubAllGlobals());

describe('SalesPage', () => {
  it('muestra el número, precios y total calculados por el servidor', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const path = input.toString();
      if (path.endsWith('/sales/sale-1/receipt')) {
        return Promise.resolve(new Response(new Blob(['%PDF receipt'], { type: 'application/pdf' }), {
          status: 200, headers: { 'Content-Type': 'application/pdf', 'X-Document-Type': 'INTERNAL_RECEIPT' }
        }));
      }
      const value = path.endsWith('/sales') ? [{
        id: 'sale-1', clientReference: 'reference-1', documentNumber: 'V-00000042',
        routeId: 'route-1', routeCode: 'R-01', routeName: 'Ruta norte',
        sellerId: 'seller-1', sellerName: 'Ana Pérez', customerId: 'customer-1',
        customerCode: 'C-01', customerName: 'Tienda La Fuente', status: 'CONFIRMED',
        subtotal: 17, total: 17, currencyCode: 'GTQ', companyName: 'Agua Pura',
        companyTaxId: '1234567-8', companyAddress: 'Guatemala', documentLegend: 'Gracias',
        createdBy: 'user-1', createdByUsername: 'ana', deviceId: 'device-1',
        createdAt: '2026-08-10T15:00:00Z', items: [{ id: 'item-1', productId: 'product-1',
          productCode: 'AGUA', productName: 'Agua pura', presentationId: 'presentation-1',
          presentationCode: 'BOT-600', presentationName: 'Botella 600 ml',
          presentationQuantity: 2, quantityBaseUnits: 2, unitPrice: 8.5,
          lineTotal: 17, priceSource: 'TIER' }]
      }] : [];
      return Promise.resolve(new Response(JSON.stringify(value), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      }));
    }));

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SalesPage canSell={false} />
    </QueryClientProvider>);

    expect(screen.getByRole('heading', { level: 1, name: 'Ventas' })).toBeInTheDocument();
    expect(await screen.findByText('V-00000042')).toBeInTheDocument();
    expect(screen.getByText(/Botella 600 ml.*2.*Q8.50/i)).toBeInTheDocument();
    expect(screen.getAllByText('Q17.00')).toHaveLength(3);
    const createUrl = vi.fn(() => 'blob:receipt');
    const revokeUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeUrl });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));
    await waitFor(() => expect(createUrl).toHaveBeenCalled());
    expect(click).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith('blob:receipt');
  });
});
