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

  it('permite alternar a modo local (Sin Señal) y regresar a modo conectado', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ONLINE' }), { status: 200 }));
    const manager = new ConnectionManager({ fetcher, minimumIntervalMs: 0 });
    const view = render(
      <ConnectionProvider manager={manager}>
        <ConnectionIndicator />
      </ConnectionProvider>,
    );

    expect(await screen.findByText('Estado: Red Activa')).toBeInTheDocument();

    const offlineBtn = screen.getByRole('radio', { name: /Sin Señal/i });
    fireEvent.click(offlineBtn);

    expect(await screen.findByText('Estado: Modo Local')).toBeInTheDocument();
    expect(manager.isForceOffline()).toBe(true);

    const onlineBtn = screen.getByRole('radio', { name: /Conectado/i });
    fireEvent.click(onlineBtn);

    expect(manager.isForceOffline()).toBe(false);
    expect(await screen.findByText('Estado: Red Activa')).toBeInTheDocument();

    view.unmount();
  });
});
