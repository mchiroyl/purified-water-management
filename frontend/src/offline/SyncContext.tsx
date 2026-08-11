import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { connectionManager } from '../features/connectivity/ConnectionManager';
import { apiRequest } from '../services/apiClient';
import { openMobileDatabase, type MobileDatabase, type OutboxRecord } from './mobileDatabase';
import {
  SyncEngine,
  type SyncBatchResult,
  type SyncEngineSnapshot,
  type SyncRequestOperation,
} from './SyncEngine';

let mobileDatabasePromise: Promise<MobileDatabase> | undefined;

export function getMobileDatabase() {
  mobileDatabasePromise ??= openMobileDatabase();
  return mobileDatabasePromise;
}

const syncEngine = new SyncEngine({
  database: getMobileDatabase,
  checkConnection: async () => (await connectionManager.beforeSync()).state,
  transport: {
    send: (operations: SyncRequestOperation[]) => apiRequest<SyncBatchResult[]>('/sync/batch', {
      method: 'POST',
      body: JSON.stringify({ operations }),
    }),
  },
});

type SyncContextValue = {
  snapshot: SyncEngineSnapshot;
  operations: OutboxRecord[];
  syncNow: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export async function requestBackgroundSync() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  const syncRegistration = registration as ServiceWorkerRegistration & {
    sync?: { register(tag: string): Promise<void> };
  };
  if (!syncRegistration.sync) return false;
  await syncRegistration.sync.register('agua-pura-outbox');
  return true;
}

export function notifyOutboxChanged() {
  window.dispatchEvent(new CustomEvent('agua-pura:outbox-changed'));
  void requestBackgroundSync().catch(() => false);
}

export function SyncProvider({
  children,
  engine = syncEngine,
  database = getMobileDatabase,
}: {
  children: ReactNode;
  engine?: SyncEngine;
  database?: () => Promise<MobileDatabase>;
}) {
  const [snapshot, setSnapshot] = useState(engine.getSnapshot());
  const [operations, setOperations] = useState<OutboxRecord[]>([]);

  const refresh = useCallback(async () => {
    const db = await database();
    const values = await db.getAll('outboxOperations');
    setOperations(values.sort((left, right) => right.createdAtLocal.localeCompare(left.createdAtLocal)));
  }, [database]);

  const syncNow = useCallback(async () => {
    await engine.sync();
    await refresh();
  }, [engine, refresh]);

  useEffect(() => engine.subscribe(setSnapshot), [engine]);

  useEffect(() => {
    const handleOnline = () => void syncNow();
    const handleOutbox = () => void syncNow();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void syncNow();
    };
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'AGUA_PURA_SYNC_REQUESTED') void syncNow();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('agua-pura:outbox-changed', handleOutbox);
    document.addEventListener('visibilitychange', handleVisibility);
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
    void syncNow();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('agua-pura:outbox-changed', handleOutbox);
      document.removeEventListener('visibilitychange', handleVisibility);
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [syncNow]);

  const value = useMemo(() => ({ snapshot, operations, syncNow, refresh }), [snapshot, operations, syncNow, refresh]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync debe utilizarse dentro de SyncProvider');
  return context;
}
