import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  connectionManager,
  type ConnectionManager,
  type ConnectionSnapshot,
} from './ConnectionManager';

type ConnectionContextValue = {
  manager: ConnectionManager;
  snapshot: ConnectionSnapshot;
};

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({
  children,
  manager = connectionManager,
}: {
  children: ReactNode;
  manager?: ConnectionManager;
}) {
  const [snapshot, setSnapshot] = useState(manager.getSnapshot());

  useEffect(() => {
    const unsubscribe = manager.subscribe(setSnapshot);
    manager.start();
    return () => {
      unsubscribe();
      manager.stop();
    };
  }, [manager]);

  return <ConnectionContext.Provider value={{ manager, snapshot }}>{children}</ConnectionContext.Provider>;
}

export function useConnection(): ConnectionContextValue {
  const context = useContext(ConnectionContext);
  if (context) return context;
  return { manager: connectionManager, snapshot: connectionManager.getSnapshot() };
}
