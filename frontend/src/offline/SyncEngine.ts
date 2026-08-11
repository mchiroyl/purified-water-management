import type { ConnectionState } from '../features/connectivity/ConnectionManager';
import type { IDBPTransaction } from 'idb';
import {
  type MobileDatabase,
  type MobileDatabaseSchema,
  type OutboxRecord,
  type SyncResultRecord,
  type SyncStatus,
} from './mobileDatabase';

type ResultStoreName = 'outboxOperations' | 'syncResults' | 'provisionalCustomers' | 'localSales' | 'localPayments' | 'localWastes' | 'localWasteEvidence' | 'localReturns';
type ResultTransaction = IDBPTransaction<MobileDatabaseSchema, ResultStoreName[], 'readwrite'>;

export type SyncRequestOperation = Pick<
  OutboxRecord,
  'clientOperationId' | 'deviceId' | 'entityType' | 'operationType' | 'aggregateLocalId' | 'payload' | 'dependencies' | 'createdAtLocal'
>;

export type SyncResultStatus = 'ACCEPTED' | 'ALREADY_PROCESSED' | 'REJECTED' | 'CONFLICT' | 'RETRY';

export type SyncBatchResult = {
  clientOperationId: string;
  status: SyncResultStatus;
  serverEntityId?: string | null;
  result?: unknown;
  errorCode?: string | null;
  message?: string | null;
  processedAtServer?: string | null;
};

export interface SyncTransport {
  send(operations: SyncRequestOperation[]): Promise<SyncBatchResult[]>;
}

export type SyncSummary = {
  synced: number;
  conflicts: number;
  rejected: number;
  retryable: number;
  pending: number;
  batches: number;
  blockedByConnection: boolean;
};

export type SyncEngineState = 'IDLE' | 'CHECKING_CONNECTION' | 'SYNCING' | 'BLOCKED' | 'ERROR';
export type SyncEngineSnapshot = { state: SyncEngineState; summary: SyncSummary; lastRunAt: string | null };

type SyncEngineOptions = {
  database: () => Promise<MobileDatabase>;
  transport: SyncTransport;
  checkConnection: () => Promise<ConnectionState>;
  batchSize?: number;
  maximumBatchesPerRun?: number;
  retryBaseMs?: number;
  retryMaximumMs?: number;
  now?: () => number;
  random?: () => number;
};

const emptySummary = (): SyncSummary => ({
  synced: 0,
  conflicts: 0,
  rejected: 0,
  retryable: 0,
  pending: 0,
  batches: 0,
  blockedByConnection: false,
});

export class SyncEngine {
  private readonly database: () => Promise<MobileDatabase>;
  private readonly transport: SyncTransport;
  private readonly checkConnection: () => Promise<ConnectionState>;
  private readonly batchSize: number;
  private readonly maximumBatchesPerRun: number;
  private readonly retryBaseMs: number;
  private readonly retryMaximumMs: number;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly listeners = new Set<(snapshot: SyncEngineSnapshot) => void>();
  private snapshot: SyncEngineSnapshot = { state: 'IDLE', summary: emptySummary(), lastRunAt: null };
  private currentRun?: Promise<SyncSummary>;

  constructor(options: SyncEngineOptions) {
    this.database = options.database;
    this.transport = options.transport;
    this.checkConnection = options.checkConnection;
    this.batchSize = options.batchSize ?? 10;
    this.maximumBatchesPerRun = options.maximumBatchesPerRun ?? 20;
    this.retryBaseMs = options.retryBaseMs ?? 2_000;
    this.retryMaximumMs = options.retryMaximumMs ?? 5 * 60_000;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
  }

  getSnapshot = () => this.snapshot;

  subscribe = (listener: (snapshot: SyncEngineSnapshot) => void) => {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  };

  sync() {
    if (this.currentRun) return this.currentRun;
    this.currentRun = this.run().finally(() => {
      this.currentRun = undefined;
    });
    return this.currentRun;
  }

  private async run() {
    const summary = emptySummary();
    const db = await this.database();
    await this.recoverInterruptedOperations(db);
    this.publish('CHECKING_CONNECTION', summary);

    const connection = await this.checkConnection();
    if (connection !== 'ONLINE') {
      summary.blockedByConnection = true;
      summary.pending = await this.countUnfinished(db);
      this.publish('BLOCKED', summary);
      return summary;
    }

    this.publish('SYNCING', summary);
    try {
      for (let batchNumber = 0; batchNumber < this.maximumBatchesPerRun; batchNumber += 1) {
        const eligible = await this.getEligibleOperations(db);
        if (eligible.length === 0) break;
        const batch = eligible.slice(0, this.batchSize);
        await this.markBatchSyncing(db, batch);
        summary.batches += 1;

        let results: SyncBatchResult[];
        try {
          results = await this.transport.send(batch.map(this.toRequestOperation));
        } catch {
          results = batch.map((operation) => ({
            clientOperationId: operation.clientOperationId,
            status: 'RETRY',
            errorCode: 'NETWORK_ERROR',
            message: 'No fue posible enviar la operación.',
          }));
        }

        const resultsById = new Map(results.map((result) => [result.clientOperationId, result]));
        const normalizedResults = batch.map((operation) => resultsById.get(operation.clientOperationId) ?? ({
          clientOperationId: operation.clientOperationId,
          status: 'RETRY' as const,
          errorCode: 'MISSING_RESULT',
          message: 'El servidor no devolvió resultado para la operación.',
        }));
        await this.applyResults(db, batch, normalizedResults, summary);
      }

      summary.pending = await this.countUnfinished(db);
      this.publish('IDLE', summary);
      return summary;
    } catch (error) {
      summary.pending = await this.countUnfinished(db);
      this.publish('ERROR', summary);
      throw error;
    }
  }

  private async recoverInterruptedOperations(db: MobileDatabase) {
    const syncing = await db.getAllFromIndex('outboxOperations', 'status', 'SYNCING');
    if (syncing.length === 0) return;
    const transaction = db.transaction('outboxOperations', 'readwrite');
    for (const operation of syncing) {
      await transaction.store.put({ ...operation, status: 'PENDING', updatedAt: new Date(this.now()).toISOString() });
    }
    await transaction.done;
  }

  private async getEligibleOperations(db: MobileDatabase) {
    const all = await db.getAll('outboxOperations');
    const byId = new Map(all.map((operation) => [operation.clientOperationId, operation]));
    const now = this.now();
    return all
      .filter((operation) => operation.status === 'PENDING' || operation.status === 'FAILED_RETRYABLE')
      .filter((operation) => operation.nextAttemptAt === null || Date.parse(operation.nextAttemptAt) <= now)
      .filter((operation) => operation.dependencies.every((dependency) => byId.get(dependency)?.status === 'SYNCED'))
      .sort((left, right) => left.createdAtLocal.localeCompare(right.createdAtLocal));
  }

  private async markBatchSyncing(db: MobileDatabase, batch: OutboxRecord[]) {
    const transaction = db.transaction('outboxOperations', 'readwrite');
    const updatedAt = new Date(this.now()).toISOString();
    for (const operation of batch) {
      await transaction.store.put({ ...operation, status: 'SYNCING', updatedAt });
    }
    await transaction.done;
  }

  private async applyResults(
    db: MobileDatabase,
    batch: OutboxRecord[],
    results: SyncBatchResult[],
    summary: SyncSummary,
  ) {
    const transaction = db.transaction([
      'outboxOperations',
      'syncResults',
      'provisionalCustomers',
      'localSales',
      'localPayments',
      'localWastes',
      'localWasteEvidence',
      'localReturns',
    ], 'readwrite');
    const operations = new Map(batch.map((operation) => [operation.clientOperationId, operation]));
    const updatedAt = new Date(this.now()).toISOString();

    for (const result of results) {
      const operation = operations.get(result.clientOperationId);
      if (!operation) continue;
      const status = this.localStatus(result.status);
      const retryCount = status === 'FAILED_RETRYABLE' ? operation.retryCount + 1 : operation.retryCount;
      const nextAttemptAt = status === 'FAILED_RETRYABLE'
        ? new Date(this.now() + this.retryDelay(operation.retryCount)).toISOString()
        : null;
      const updatedOperation: OutboxRecord = {
        ...operation,
        status,
        retryCount,
        nextAttemptAt,
        lastErrorCode: result.errorCode ?? null,
        lastErrorMessage: result.message ?? null,
        updatedAt,
      };
      await transaction.objectStore('outboxOperations').put(updatedOperation);

      const storedResult: SyncResultRecord = {
        clientOperationId: result.clientOperationId,
        resultStatus: result.status,
        serverEntityId: result.serverEntityId ?? null,
        resultPayload: result.result,
        errorCode: result.errorCode ?? null,
        processedAtServer: result.processedAtServer ?? null,
        storedAtLocal: updatedAt,
      };
      await transaction.objectStore('syncResults').put(storedResult);
      await this.updateAggregate(transaction, updatedOperation, result.serverEntityId ?? null);

      if (status === 'SYNCED') summary.synced += 1;
      else if (status === 'CONFLICT') summary.conflicts += 1;
      else if (status === 'REJECTED') summary.rejected += 1;
      else if (status === 'FAILED_RETRYABLE') summary.retryable += 1;
    }
    await transaction.done;
  }

  private async updateAggregate(
    transaction: ResultTransaction,
    operation: OutboxRecord,
    serverEntityId: string | null,
  ) {
    const syncStatus = operation.status;
    if (operation.entityType === 'PROVISIONAL_CUSTOMER') {
      const store = transaction.objectStore('provisionalCustomers');
      const value = await store.get(operation.aggregateLocalId);
      if (value) await store.put({ ...value, syncStatus, serverCustomerId: serverEntityId ?? value.serverCustomerId });
    } else if (operation.entityType === 'SALE') {
      const store = transaction.objectStore('localSales');
      const value = await store.get(operation.aggregateLocalId);
      if (value) await store.put({ ...value, syncStatus, serverSaleId: serverEntityId ?? value.serverSaleId });
    } else if (operation.entityType === 'PAYMENT') {
      const store = transaction.objectStore('localPayments');
      const value = await store.get(operation.aggregateLocalId);
      if (value) await store.put({ ...value, syncStatus, serverPaymentId: serverEntityId ?? value.serverPaymentId });
    } else if (operation.entityType === 'WASTE') {
      const store = transaction.objectStore('localWastes');
      const value = await store.get(operation.aggregateLocalId);
      if (value) await store.put({ ...value, syncStatus, serverWasteId: serverEntityId ?? value.serverWasteId,
        status: syncStatus === 'SYNCED' ? 'PENDING_REVIEW' : value.status });
      const evidenceStore = transaction.objectStore('localWasteEvidence');
      const evidence = await evidenceStore.index('localWasteId').getAll(operation.aggregateLocalId);
      for (const item of evidence) await evidenceStore.put({ ...item, syncStatus });
    } else if (operation.entityType === 'RETURN') {
      const store = transaction.objectStore('localReturns');
      const value = await store.get(operation.aggregateLocalId);
      if (value) await store.put({ ...value, syncStatus, serverReturnId: serverEntityId ?? value.serverReturnId });
    }
  }

  private localStatus(resultStatus: SyncResultStatus): SyncStatus {
    if (resultStatus === 'ACCEPTED' || resultStatus === 'ALREADY_PROCESSED') return 'SYNCED';
    if (resultStatus === 'CONFLICT') return 'CONFLICT';
    if (resultStatus === 'REJECTED') return 'REJECTED';
    return 'FAILED_RETRYABLE';
  }

  private retryDelay(previousRetryCount: number) {
    const exponential = Math.min(this.retryBaseMs * 2 ** previousRetryCount, this.retryMaximumMs);
    return Math.round(exponential * (0.5 + this.random()));
  }

  private countUnfinished(db: MobileDatabase) {
    return db.getAll('outboxOperations').then((operations) => operations.filter((operation) => operation.status !== 'SYNCED').length);
  }

  private readonly toRequestOperation = (operation: OutboxRecord): SyncRequestOperation => ({
    clientOperationId: operation.clientOperationId,
    deviceId: operation.deviceId,
    entityType: operation.entityType,
    operationType: operation.operationType,
    aggregateLocalId: operation.aggregateLocalId,
    payload: operation.payload,
    dependencies: operation.dependencies,
    createdAtLocal: operation.createdAtLocal,
  });

  private publish(state: SyncEngineState, summary: SyncSummary) {
    this.snapshot = { state, summary: { ...summary }, lastRunAt: new Date(this.now()).toISOString() };
    this.listeners.forEach((listener) => listener(this.snapshot));
  }
}
