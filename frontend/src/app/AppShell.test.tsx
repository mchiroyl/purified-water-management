import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

const useSessionMock = vi.hoisted(() => vi.fn());
const logoutMock = vi.hoisted(() => vi.fn());

vi.mock('../features/auth/SessionContext', () => ({ useSession: useSessionMock }));
vi.mock('../features/connectivity/ConnectionIndicator', () => ({
  ConnectionIndicator: () => <span>online</span>
}));
vi.mock('../services/apiClient', () => ({
  apiRequest: vi.fn().mockResolvedValue({ commercialName: 'Agua Pura Demo', version: 1 })
}));

describe('AppShell navegación móvil', () => {
  beforeEach(() => {
    logoutMock.mockReset();
    useSessionMock.mockReturnValue({
      user: { displayName: 'Administrador', roles: ['ADMINISTRADOR'] },
      logout: logoutMock
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
    const catalog = within(menu).getByRole('button', { name: 'Catálogo y planificación' });
    expect(catalog).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(catalog);
    expect(catalog).toHaveAttribute('aria-expanded', 'true');
    for (const label of ['Productos', 'Clientes', 'Rutas', 'Precios']) {
      expect(within(menu).getByRole('link', { name: label })).toBeInTheDocument();
    }
    expect(within(menu).getByRole('button', { name: 'Administración' })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();

    fireEvent.click(within(menu).getByRole('button', { name: 'Cerrar menú' }));
    expect(screen.queryByRole('dialog', { name: 'Menú principal' })).not.toBeInTheDocument();
  });

  it('cierra el menú con Escape y devuelve el foco al disparador', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><AppShell /></MemoryRouter>
      </QueryClientProvider>
    );

    const trigger = screen.getByRole('button', { name: 'Menú' });
    fireEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'Cerrar menú' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Menú principal' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('permite cerrar sesión desde el menú móvil', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><AppShell /></MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Menú' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Menú principal' }))
      .getByRole('button', { name: 'Cerrar sesión' }));

    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});
