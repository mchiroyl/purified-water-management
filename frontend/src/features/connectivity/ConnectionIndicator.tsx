import { useEffect, useState } from 'react';

type ConnectionState = 'UNKNOWN' | 'CHECKING' | 'OFFLINE' | 'DEGRADED' | 'ONLINE';

export function ConnectionIndicator() {
  const [state, setState] = useState<ConnectionState>('UNKNOWN');

  useEffect(() => {
    const check = async () => {
      setState('CHECKING');
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 3000);
      try {
        const response = await fetch('/api/connectivity', { cache: 'no-store', signal: controller.signal });
        setState(response.ok ? 'ONLINE' : 'DEGRADED');
      } catch {
        setState('OFFLINE');
      } finally {
        window.clearTimeout(timeout);
      }
    };
    void check();
    window.addEventListener('online', check);
    window.addEventListener('offline', check);
    return () => {
      window.removeEventListener('online', check);
      window.removeEventListener('offline', check);
    };
  }, []);

  return <span className={`connection ${state.toLowerCase()}`}>{state === 'ONLINE' ? 'En línea' : state === 'OFFLINE' ? 'Sin conexión' : state === 'DEGRADED' ? 'Conexión limitada' : 'Comprobando'}</span>;
}
