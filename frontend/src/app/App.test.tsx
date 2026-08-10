import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, vi } from 'vitest';
import { SessionProvider } from '../features/auth/SessionContext';
import { App } from './App';

afterEach(() => vi.unstubAllGlobals());

describe('App', () => {
  it('muestra el inicio de sesión sin una sesión activa', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Sin cookie refresh')));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SessionProvider><App /></SessionProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByRole('heading', { name: /sistema agua pura/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument();
  });
});
