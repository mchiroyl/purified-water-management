import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { AuditPage } from './AuditPage';

afterEach(() => vi.unstubAllGlobals());

describe('AuditPage', () => {
  it('presenta eventos filtrables con correlación y datos seguros', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      content: [{ id: 'a1', username: 'admin', deviceName: 'Equipo principal', action: 'CREATE_SALE',
        entityType: 'SALE', entityId: 'sale-1', beforeData: null, afterData: { status: 'CONFIRMED' },
        correlationId: '00000000-0000-0000-0000-000000000099', ipAddress: '127.0.0.1',
        occurredAt: '2026-08-11T15:00:00Z' }], totalElements: 1, page: 0, size: 25, hasNext: false
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))));

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuditPage />
    </QueryClientProvider>);

    expect(screen.getByRole('heading', { level: 1, name: /auditoría/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/acción/i)).toBeInTheDocument();
    expect(await screen.findByText('CREATE_SALE')).toBeInTheDocument();
    expect(screen.getByText(/00000000-0000-0000-0000-000000000099/)).toBeInTheDocument();
    expect(screen.getByText(/CONFIRMED/)).toBeInTheDocument();
  });
});
