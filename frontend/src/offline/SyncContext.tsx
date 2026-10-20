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
  checkConnection: async () => {
    // If we already know we're ONLINE (from the most recent probe), trust that
    // and avoid firing an additional HTTP probe that could bounce the state.
    const current = connectionManager.getSnapshot();
    if (current.state === 'ONLINE' && current.mode !== 'FORCE_OFFLINE') {
      return 'ONLINE';
    }
    // State is uncertain: do a real probe
    return (await connectionManager.beforeSync()).state;
  },
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
  // Track last auto-sync time to avoid hammering the server with probes
  const lastAutoSyncRef = { current: 0 };

  const refresh = useCallback(async () => {
    const db = await database();
    const values = await db.getAll('outboxOperations');
    setOperations(values.sort((left, right) => right.createdAtLocal.localeCompare(left.createdAtLocal)));
  }, [database]);

  const syncNow = useCallback(async () => {
    await engine.sync();
    await refresh();
  }, [engine, refresh]);

  // Rate-limited auto-sync: waits at least 15 s between automatic sync triggers
  // to avoid triggering repeated HTTP probes that would bounce the connection state.
  const autoSync = useCallback(() => {
    const now = Date.now();
    if (now - lastAutoSyncRef.current < 15_000) return;
    lastAutoSyncRef.current = now;
    void syncNow();
  }, [syncNow]);

  useEffect(() => engine.subscribe(setSnapshot), [engine]);

  useEffect(() => {
    let previousConnectionState = connectionManager.getSnapshot().state;

    const handleOnline = () => {
      lastAutoSyncRef.current = 0; // browser came back online: reset rate limit
      void syncNow();
    };
    const handleOutbox = async () => {
      await refresh();
      autoSync();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') autoSync();
    };
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'AGUA_PURA_SYNC_REQUESTED') void syncNow();
    };

    // Only trigger sync on TRANSITION to ONLINE (not on every ONLINE publish)
    // This is the key fix: prevents the probe loop that was bouncing the state
    const unsubscribeConnection = connectionManager.subscribe((connSnap) => {
      const wasOnline = previousConnectionState === 'ONLINE';
      const isNowOnline = connSnap.state === 'ONLINE';
      previousConnectionState = connSnap.state;
      if (!wasOnline && isNowOnline) {
        // Genuine transition to online: reset rate limiter and sync
        lastAutoSyncRef.current = 0;
        void syncNow();
      }
    });

    window.addEventListener('online', handleOnline);
    window.addEventListener('agua-pura:outbox-changed', handleOutbox);
    document.addEventListener('visibilitychange', handleVisibility);
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
    void refresh();
    autoSync();
    return () => {
      unsubscribeConnection();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('agua-pura:outbox-changed', handleOutbox);
      document.removeEventListener('visibilitychange', handleVisibility);
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [syncNow, refresh, autoSync]);

  const value = useMemo(() => ({ snapshot, operations, syncNow, refresh }), [snapshot, operations, syncNow, refresh]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncOptional() {
  return useContext(SyncContext);
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync debe utilizarse dentro de SyncProvider');
  return context;
}

