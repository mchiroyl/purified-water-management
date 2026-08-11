import { deleteDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMobileRepositories, openMobileDatabase, type OutboxRecord } from './mobileDatabase';
import { SyncEngine, type SyncBatchResult, type SyncRequestOperation, type SyncTransport } from './SyncEngine';

const databaseNames: string[] = [];

function newDatabaseName(label: string) {
  const name = `agua-pura-sync-${label}-${crypto.randomUUID()}`;
  databaseNames.push(name);
  return name;
}

function operation(id: string, dependencies: string[] = []): OutboxRecord {
  return {
    clientOperationId: id,
    deviceId: 'device-1',
    entityType: id.startsWith('customer') ? 'PROVISIONAL_CUSTOMER' : id.startsWith('payment') ? 'PAYMENT' : 'SALE',
    operationType: 'CREATE',
    aggregateLocalId: id,
    payload: { id },
    dependencies,
    status: 'PENDING',
    retryCount: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
    nextAttemptAt: null,
    createdAtLocal: `2026-08-10T20:00:0${dependencies.length}-06:00`,
    updatedAt: '2026-08-10T20:00:00-06:00',
  };
}

afterEach(async () => {
  await Promise.all(databaseNames.splice(0).map((name) => deleteDB(name)));
});

describe('SyncEngine', () => {
  it('ordena cliente provisional, venta y pago respetando dependencias', async () => {
    const db = await openMobileDatabase(newDatabaseName('dependencies'));
    const repositories = createMobileRepositories(db);
    await repositories.outboxOperations.put(operation('customer-1'));
    await repositories.outboxOperations.put(operation('sale-1', ['customer-1']));
    await repositories.outboxOperations.put(operation('payment-1', ['sale-1']));
    const sentBatches: string[][] = [];
    const transport: SyncTransport = {
      send: vi.fn(async (operations: SyncRequestOperation[]): Promise<SyncBatchResult[]> => {
        sentBatches.push(operations.map((item) => item.clientOperationId));
        return operations.map((item): SyncBatchResult => ({
          clientOperationId: item.clientOperationId,
          status: 'ACCEPTED',
          serverEntityId: `server-${item.clientOperationId}`,
        }));
      }),
    };
    const engine = new SyncEngine({
      database: async () => db,
      transport,
      checkConnection: async () => 'ONLINE',
      random: () => 0,
    });

    const summary = await engine.sync();

    expect(sentBatches).toEqual([['customer-1'], ['sale-1'], ['payment-1']]);
    expect(summary).toMatchObject({ synced: 3, conflicts: 0, rejected: 0, retryable: 0 });
    expect((await repositories.outboxOperations.getAll()).map((item) => item.status)).toEqual(['SYNCED', 'SYNCED', 'SYNCED']);
    db.close();
  });

  it('aplica cada resultado parcial sin declarar exitoso todo el batch', async () => {
    const db = await openMobileDatabase(newDatabaseName('partial'));
    const repositories = createMobileRepositories(db);
    for (const id of ['sale-accepted', 'sale-conflict', 'sale-rejected', 'sale-retry']) {
      await repositories.outboxOperations.put(operation(id));
    }
    const transport: SyncTransport = {
      send: vi.fn(async (): Promise<SyncBatchResult[]> => [
        { clientOperationId: 'sale-accepted', status: 'ALREADY_PROCESSED', serverEntityId: 'server-sale' },
        { clientOperationId: 'sale-conflict', status: 'CONFLICT', errorCode: 'PRICE_CHANGED', message: 'Precio actualizado' },
        { clientOperationId: 'sale-rejected', status: 'REJECTED', errorCode: 'INVALID_OPERATION', message: 'Operación inválida' },
        { clientOperationId: 'sale-retry', status: 'RETRY', errorCode: 'TEMPORARY', message: 'Intente nuevamente' },
      ]),
    };
    const engine = new SyncEngine({
      database: async () => db,
      transport,
      checkConnection: async () => 'ONLINE',
      now: () => Date.parse('2026-08-11T02:00:00Z'),
      random: () => 0,
      retryBaseMs: 2_000,
    });

    const summary = await engine.sync();
    const statuses = Object.fromEntries((await repositories.outboxOperations.getAll()).map((item) => [item.clientOperationId, item]));

    expect(summary).toMatchObject({ synced: 1, conflicts: 1, rejected: 1, retryable: 1 });
    expect(statuses['sale-accepted'].status).toBe('SYNCED');
    expect(statuses['sale-conflict']).toMatchObject({ status: 'CONFLICT', lastErrorCode: 'PRICE_CHANGED' });
    expect(statuses['sale-rejected'].status).toBe('REJECTED');
    expect(statuses['sale-retry']).toMatchObject({ status: 'FAILED_RETRYABLE', retryCount: 1, nextAttemptAt: '2026-08-11T02:00:01.000Z' });
    expect(await repositories.syncResults.get('sale-accepted')).toMatchObject({ resultStatus: 'ALREADY_PROCESSED', serverEntityId: 'server-sale' });
    db.close();
  });

  it('marca la merma y su evidencia como pendientes de revisión tras sincronizar', async () => {
    const db = await openMobileDatabase(newDatabaseName('waste'));
    const repositories = createMobileRepositories(db);
    const wasteOperation = { ...operation('waste-1'), entityType: 'WASTE', aggregateLocalId: 'waste-1' };
    await repositories.localWastes.put({ localWasteId: 'waste-1', routeRunId: 'route-1', sellerId: 'seller-1',
      deviceId: 'device-1', clientOperationId: 'waste-1', status: 'LOCAL_PENDING', reason: 'Rotura',
      syncStatus: 'PENDING', occurredAtLocal: '2026-08-10T20:00:00-06:00' });
    await repositories.localWasteEvidence.put({ id: 'evidence-1', localWasteId: 'waste-1',
      blobCacheKey: 'blob-1', mediaType: 'image/jpeg', sizeBytes: 4, sha256: 'a'.repeat(64),
      syncStatus: 'PENDING', capturedAtLocal: '2026-08-10T20:00:00-06:00' });
    await repositories.outboxOperations.put(wasteOperation);
    const engine = new SyncEngine({ database: async () => db, checkConnection: async () => 'ONLINE',
      transport: { send: async () => [{ clientOperationId: 'waste-1', status: 'ACCEPTED', serverEntityId: 'server-waste-1' }] } });

    await engine.sync();

    expect(await repositories.localWastes.get('waste-1')).toMatchObject({ status: 'PENDING_REVIEW',
      syncStatus: 'SYNCED', serverWasteId: 'server-waste-1' });
    expect(await repositories.localWasteEvidence.get('evidence-1')).toMatchObject({ syncStatus: 'SYNCED' });
    db.close();
  });

  it('convierte un fallo de transporte en reintento y no reenvía antes de tiempo', async () => {
    let now = Date.parse('2026-08-11T02:00:00Z');
    const db = await openMobileDatabase(newDatabaseName('retry'));
    const repositories = createMobileRepositories(db);
    await repositories.outboxOperations.put(operation('sale-retryable'));
    let attempts = 0;
    const transport: SyncTransport = { send: vi.fn(async (): Promise<SyncBatchResult[]> => {
      attempts += 1;
      if (attempts === 1) throw new TypeError('offline');
      return [{ clientOperationId: 'sale-retryable', status: 'ACCEPTED' }];
    }) };
    const engine = new SyncEngine({
      database: async () => db,
      transport,
      checkConnection: async () => 'ONLINE',
      now: () => now,
      random: () => 0,
      retryBaseMs: 2_000,
    });

    expect((await engine.sync()).retryable).toBe(1);
    expect(transport.send).toHaveBeenCalledTimes(1);
    await engine.sync();
    expect(transport.send).toHaveBeenCalledTimes(1);
    now += 1_000;
    await engine.sync();
    expect(transport.send).toHaveBeenCalledTimes(2);
    expect((await repositories.outboxOperations.get('sale-retryable'))?.status).toBe('SYNCED');
    db.close();
  });

  it('no envía operaciones sin conectividad confirmada', async () => {
    const db = await openMobileDatabase(newDatabaseName('offline'));
    const repositories = createMobileRepositories(db);
    await repositories.outboxOperations.put(operation('sale-offline'));
    const transport: SyncTransport = { send: vi.fn() };
    const engine = new SyncEngine({ database: async () => db, transport, checkConnection: async () => 'DEGRADED' });

    const summary = await engine.sync();

    expect(summary).toMatchObject({ blockedByConnection: true, pending: 1 });
    expect(transport.send).not.toHaveBeenCalled();
    expect((await repositories.outboxOperations.get('sale-offline'))?.status).toBe('PENDING');
    db.close();
  });

  it('deduplica solicitudes simultáneas de sincronización', async () => {
    const db = await openMobileDatabase(newDatabaseName('concurrent'));
    const repositories = createMobileRepositories(db);
    await repositories.outboxOperations.put(operation('sale-once'));
    let release!: (results: SyncBatchResult[]) => void;
    const transport: SyncTransport = { send: vi.fn((): Promise<SyncBatchResult[]> => new Promise((resolve) => { release = resolve; })) };
    const engine = new SyncEngine({ database: async () => db, transport, checkConnection: async () => 'ONLINE' });

    const first = engine.sync();
    const second = engine.sync();
    await vi.waitFor(() => expect(transport.send).toHaveBeenCalledTimes(1));
    release([{ clientOperationId: 'sale-once', status: 'ACCEPTED' }]);

    expect(await first).toEqual(await second);
    expect(transport.send).toHaveBeenCalledTimes(1);
    db.close();
  });
});
