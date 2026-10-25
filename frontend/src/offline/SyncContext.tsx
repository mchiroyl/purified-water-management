import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectionManager } from '../features/connectivity/ConnectionManager';
import { apiRequest } from '../services/apiClient';
import { openMobileDatabase, type MobileDatabase, type OutboxRecord } from './mobileDatabase';
import {
  SyncEngine,
  type SyncBatchResult,
  type SyncEngineSnapshot,
  type SyncRequestOperation,
} from './SyncEngine';

function useOptionalQueryClient() {
  try {
    return useQueryClient();
  } catch {
    return null;
  }
}

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
  discardOperation: (clientOperationId: string) => Promise<void>;
  clearRejected: () => Promise<void>;
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
  const queryClient = useOptionalQueryClient();
  const [snapshot, setSnapshot] = useState(engine.getSnapshot());
  const [operations, setOperations] = useState<OutboxRecord[]>([]);
  // Track last auto-sync time to avoid hammering the server with probes
  const lastAutoSyncRef = useRef(0);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const db = await database();
    const values = await db.getAll('outboxOperations');
    setOperations(values.sort((left, right) => right.createdAtLocal.localeCompare(left.createdAtLocal)));
  }, [database]);

  const syncNow = useCallback(async () => {
    const summary = await engine.sync();
    await refresh();
    if (summary.synced > 0 && queryClient) {
      void Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['sales'] }),
        queryClient.invalidateQueries({ queryKey: ['localSales'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['route-loads'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['settlements'] }),
        queryClient.invalidateQueries({ queryKey: ['customers'] }),
        queryClient.invalidateQueries({ queryKey: ['credit'] }),
      ]);
    }
  }, [engine, refresh, queryClient]);

  const discardOperation = useCallback(async (clientOperationId: string) => {
    const db = await database();
    await db.delete('outboxOperations', clientOperationId);
    await refresh();
  }, [database, refresh]);

  const clearRejected = useCallback(async () => {
    const db = await database();
    const ops = await db.getAll('outboxOperations');
    const tx = db.transaction('outboxOperations', 'readwrite');
    for (const op of ops) {
      if (op.status === 'REJECTED') {
        await tx.objectStore('outboxOperations').delete(op.clientOperationId);
      }
    }
    await tx.done;
    await refresh();
  }, [database, refresh]);

  // Rate-limited auto-sync: waits at least 10 s between automatic sync triggers
  // but if called within the window, schedules a deferred timer so requests are never lost.
  const autoSync = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastAutoSyncRef.current;
    if (elapsed < 10_000) {
      if (!pendingTimerRef.current) {
        pendingTimerRef.current = setTimeout(() => {
          pendingTimerRef.current = null;
          lastAutoSyncRef.current = Date.now();
          void syncNow();
        }, Math.max(500, 10_000 - elapsed));
      }
      return;
    }
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    lastAutoSyncRef.current = now;
    void syncNow();
  }, [syncNow]);

  useEffect(() => engine.subscribe(setSnapshot), [engine]);

  useEffect(() => {
    let previousConnectionState = connectionManager.getSnapshot().state;

    const handleOnline = () => {
      lastAutoSyncRef.current = 0; // browser came back online: reset rate limit
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      void syncNow();
    };
    const handleOutbox = async () => {
      await refresh();
      // Si la red está activa, sincronizar prontamente (debounce 400ms para asentar escritura)
      if (connectionManager.getSnapshot().state === 'ONLINE') {
        if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = setTimeout(() => {
          pendingTimerRef.current = null;
          lastAutoSyncRef.current = Date.now();
          void syncNow();
        }, 400);
      } else {
        autoSync();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') autoSync();
    };
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'AGUA_PURA_SYNC_REQUESTED') void syncNow();
    };

    // Only trigger sync on TRANSITION to ONLINE (not on every ONLINE publish)
    const unsubscribeConnection = connectionManager.subscribe((connSnap) => {
      const wasOnline = previousConnectionState === 'ONLINE';
      const isNowOnline = connSnap.state === 'ONLINE';
      previousConnectionState = connSnap.state;
      if (!wasOnline && isNowOnline) {
        lastAutoSyncRef.current = 0;
        if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        void syncNow();
      }
    });

    // Heartbeat periódico mientras hay conexión activa: solo sincroniza si hay operaciones pendientes en outbox
    const heartbeat = setInterval(() => {
      const snap = connectionManager.getSnapshot();
      if (snap.state === 'ONLINE' && snap.mode !== 'FORCE_OFFLINE') {
        void database()
          .then((db) => db.getAll('outboxOperations'))
          .then((ops) => {
            if (ops.some((op) => op.status !== 'SYNCED')) {
              autoSync();
            }
          })
          .catch(() => {});
      }
    }, 20_000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('agua-pura:outbox-changed', handleOutbox);
    document.addEventListener('visibilitychange', handleVisibility);
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
    void refresh();
    autoSync();
    return () => {
      clearInterval(heartbeat);
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      unsubscribeConnection();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('agua-pura:outbox-changed', handleOutbox);
      document.removeEventListener('visibilitychange', handleVisibility);
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [syncNow, refresh, autoSync]);

  const value = useMemo(
    () => ({ snapshot, operations, syncNow, refresh, discardOperation, clearRejected }),
    [snapshot, operations, syncNow, refresh, discardOperation, clearRejected],
  );
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

