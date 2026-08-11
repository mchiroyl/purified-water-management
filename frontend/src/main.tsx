import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { SessionProvider } from './features/auth/SessionContext';
import { ConnectionProvider } from './features/connectivity/ConnectionContext';
import { PwaLifecycle } from './pwa/PwaLifecycle';
import { SyncProvider } from './offline/SyncContext';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000
    }
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ConnectionProvider>
          <SyncProvider>
            <SessionProvider>
              <App />
              <PwaLifecycle />
            </SessionProvider>
          </SyncProvider>
        </ConnectionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
