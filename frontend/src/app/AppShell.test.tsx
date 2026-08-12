import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

const useSessionMock = vi.hoisted(() => vi.fn());

vi.mock('../features/auth/SessionContext', () => ({ useSession: useSessionMock }));
vi.mock('../features/connectivity/ConnectionIndicator', () => ({
  ConnectionIndicator: () => <span>online</span>
}));
vi.mock('../services/apiClient', () => ({
  apiRequest: vi.fn().mockResolvedValue({ commercialName: 'Agua Pura Demo', version: 1 })
}));

describe('AppShell navegación móvil', () => {
  beforeEach(() => {
    useSessionMock.mockReturnValue({
      user: { displayName: 'Administrador', roles: ['ADMINISTRADOR'] },
      logout: vi.fn()
    });
  });

  it('permite al administrador abrir un menú desplazable con todas sus opciones', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><AppShell /></MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.queryByRole('dialog', { name: 'Menú principal' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Menú' }));

    const menu = screen.getByRole('dialog', { name: 'Menú principal' });
    expect(menu).toHaveClass('mobile-menu-panel');
    for (const label of ['Usuarios', 'Datos de la empresa', 'FEL opcional', 'Auditoría', 'Reportes', 'Anulaciones']) {
      expect(within(menu).getByRole('link', { name: label })).toBeInTheDocument();
    }

    fireEvent.click(within(menu).getByRole('button', { name: 'Cerrar menú' }));
    expect(screen.queryByRole('dialog', { name: 'Menú principal' })).not.toBeInTheDocument();
  });
});
