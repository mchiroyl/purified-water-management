import { getMobileDatabase, notifyOutboxChanged } from '../../offline/SyncContext';
import {
  createMobileRepositories,
  type MobileDatabase,
  type OutboxRecord,
  type ProvisionalCustomerRecord,
} from '../../offline/mobileDatabase';

export type ProvisionalCustomerInput = {
  routeId: string;
  sellerId: string;
  deviceId: string;
  name: string;
  phone: string;
  whatsapp: string;
  addressReference: string;
};

export async function queueProvisionalCustomer(
  input: ProvisionalCustomerInput,
  database?: MobileDatabase,
  notify: () => void = notifyOutboxChanged,
) {
  const db = database ?? await getMobileDatabase();
  const repositories = createMobileRepositories(db);
  const localCustomerId = crypto.randomUUID();
  const clientOperationId = crypto.randomUUID();
  const createdAtLocal = new Date().toISOString();
  const customer: ProvisionalCustomerRecord = {
    localCustomerId,
    clientOperationId,
    routeRunId: input.routeId,
    sellerId: input.sellerId,
    deviceId: input.deviceId,
    name: input.name.trim(),
    normalizedPhone: input.phone.replace(/\D/g, ''),
    whatsapp: input.whatsapp.trim() || null,
    addressReference: input.addressReference.trim(),
    syncStatus: 'PENDING',
    serverCustomerId: null,
    createdAtLocal,
  };
  const outbox: OutboxRecord = {
    clientOperationId,
    deviceId: input.deviceId,
    entityType: 'PROVISIONAL_CUSTOMER',
    operationType: 'CREATE',
    aggregateLocalId: localCustomerId,
    payload: {
      localCustomerId,
      routeId: input.routeId,
      name: customer.name,
      phone: input.phone.trim(),
      whatsapp: input.whatsapp.trim(),
      addressReference: customer.addressReference,
    },
    dependencies: [],
    status: 'PENDING',
    retryCount: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
    nextAttemptAt: null,
    createdAtLocal,
    updatedAt: createdAtLocal,
  };
  await repositories.localOperations.saveProvisionalCustomerWithOutbox(customer, outbox);
  notify();
  return customer;
}
