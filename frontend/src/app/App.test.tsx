import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionProvider } from '../features/auth/SessionContext';
import { App } from './App';

describe('App', () => {
  it('muestra el inicio de sesión sin una sesión activa', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SessionProvider><App /></SessionProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByRole('heading', { name: /sistema agua pura/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ingresar/i })).toBeInTheDocument();
  });
});
