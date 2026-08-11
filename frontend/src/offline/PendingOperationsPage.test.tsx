import { render, screen } from '@testing-library/react';
import { deleteDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import { openMobileDatabase, type OutboxRecord } from './mobileDatabase';
import { PendingOperationsPage } from './PendingOperationsPage';
import { SyncProvider } from './SyncContext';
import { SyncEngine } from './SyncEngine';

let databaseName = '';

afterEach(async () => {
  if (databaseName) await deleteDB(databaseName);
  databaseName = '';
});

describe('PendingOperationsPage', () => {
  it('muestra estados, errores y bloqueo de red sin perder operaciones', async () => {
    databaseName = `agua-pura-pending-${crypto.randomUUID()}`;
    const db = await openMobileDatabase(databaseName);
    const pending: OutboxRecord = {
      clientOperationId: 'operation-1', deviceId: 'device-1', entityType: 'SALE', operationType: 'CREATE',
      aggregateLocalId: 'sale-1', payload: {}, dependencies: [], status: 'PENDING', retryCount: 0,
      lastErrorCode: null, lastErrorMessage: null, nextAttemptAt: null,
      createdAtLocal: '2026-08-10T20:00:00-06:00', updatedAt: '2026-08-10T20:00:00-06:00',
    };
    const conflict: OutboxRecord = {
      ...pending,
      clientOperationId: 'operation-2', aggregateLocalId: 'sale-2', status: 'CONFLICT',
      lastErrorCode: 'PRICE_CHANGED', lastErrorMessage: 'El precio cambió.',
    };
    await db.put('outboxOperations', pending);
    await db.put('outboxOperations', conflict);
    const engine = new SyncEngine({
      database: async () => db,
      transport: { send: async () => [] },
      checkConnection: async () => 'OFFLINE',
    });

    render(
      <SyncProvider engine={engine} database={async () => db}>
        <PendingOperationsPage />
      </SyncProvider>,
    );

    expect(await screen.findByText(/no hay conexión confirmada/i)).toBeInTheDocument();
    expect(await screen.findByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText('En conflicto')).toBeInTheDocument();
    expect(screen.getByText(/PRICE_CHANGED: El precio cambió/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sincronizar ahora/i })).toBeEnabled();
    expect(await db.count('outboxOperations')).toBe(2);
    db.close();
  });
});
