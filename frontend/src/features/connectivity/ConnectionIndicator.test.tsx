import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConnectionProvider } from './ConnectionContext';
import { ConnectionIndicator } from './ConnectionIndicator';
import { ConnectionManager } from './ConnectionManager';

describe('ConnectionIndicator', () => {
  it('muestra el estado confirmado y permite comprobar manualmente', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ONLINE' }), { status: 200 }));
    const manager = new ConnectionManager({ fetcher, minimumIntervalMs: 0 });
    const view = render(
      <ConnectionProvider manager={manager}>
        <ConnectionIndicator />
      </ConnectionProvider>,
    );

    expect(await screen.findByRole('button', { name: 'En línea' })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.click(screen.getByRole('button', { name: 'En línea' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));

    view.unmount();
  });
});
