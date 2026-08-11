import { getMobileDatabase, notifyOutboxChanged } from '../../offline/SyncContext';
import {
  createMobileRepositories,
  type LocalReturnItemRecord,
  type LocalReturnRecord,
  type MobileDatabase,
  type OutboxRecord,
} from '../../offline/mobileDatabase';

export type ReturnOfflineInput = {
  returnType: 'UNSOLD_GOOD' | 'CUSTOMER_RETURN';
  routeId: string;
  sellerId: string;
  deviceId: string;
  customerId?: string | null;
  saleId?: string | null;
  presentationId: string;
  presentationQuantity: number;
  quantityBaseUnits: number;
  reason: string;
};

export async function queueReturn(
  input: ReturnOfflineInput,
  database?: MobileDatabase,
  notify: () => void = notifyOutboxChanged,
) {
  const db = database ?? await getMobileDatabase();
  const repositories = createMobileRepositories(db);
  const localReturnId = crypto.randomUUID();
  const clientOperationId = crypto.randomUUID();
  const reportedAtLocal = new Date().toISOString();
  const item: LocalReturnRecord = {
    localReturnId,
    serverReturnId: null,
    routeRunId: input.routeId,
    sellerId: input.sellerId,
    deviceId: input.deviceId,
    returnType: input.returnType,
    customerId: input.returnType === 'CUSTOMER_RETURN' ? input.customerId ?? null : null,
    localSaleId: input.returnType === 'CUSTOMER_RETURN' ? input.saleId ?? null : null,
    clientOperationId,
    status: 'LOCAL_PENDING',
    reason: input.reason.trim(),
    syncStatus: 'PENDING',
    reportedAtLocal,
  };
  const details: LocalReturnItemRecord[] = [{
    id: crypto.randomUUID(),
    localReturnId,
    presentationId: input.presentationId,
    presentationQuantity: String(input.presentationQuantity),
    quantityBaseUnits: String(input.quantityBaseUnits),
    condition: 'GOOD',
  }];
  const outbox: OutboxRecord = {
    clientOperationId,
    deviceId: input.deviceId,
    entityType: 'RETURN',
    operationType: 'CREATE',
    aggregateLocalId: localReturnId,
    payload: {
      clientReference: localReturnId,
      returnType: input.returnType,
      routeId: input.routeId,
      customerId: item.customerId,
      saleId: item.localSaleId,
      reason: item.reason,
      reportedAtLocal,
      items: [{ presentationId: input.presentationId, presentationQuantity: input.presentationQuantity }],
    },
    dependencies: [],
    status: 'PENDING',
    retryCount: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
    nextAttemptAt: null,
    createdAtLocal: reportedAtLocal,
    updatedAt: reportedAtLocal,
  };
  await repositories.localOperations.saveReturnWithOutbox(item, details, outbox);
  notify();
  return item;
}
