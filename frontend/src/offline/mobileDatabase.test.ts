import { deleteDB, openDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MOBILE_DB_VERSION,
  createMobileRepositories,
  openMobileDatabase,
  type LocalSaleRecord,
  type OutboxRecord,
} from './mobileDatabase';

const openedDatabases: string[] = [];

function databaseName(label: string) {
  const name = `agua-pura-test-${label}-${crypto.randomUUID()}`;
  openedDatabases.push(name);
  return name;
}

afterEach(async () => {
  await Promise.all(openedDatabases.splice(0).map((name) => deleteDB(name)));
});

describe('mobileDatabase', () => {
  it('crea los object stores e índices de la versión móvil vigente', async () => {
    const db = await openMobileDatabase(databaseName('schema'));

    expect(db.version).toBe(MOBILE_DB_VERSION);
    expect(Array.from(db.objectStoreNames)).toEqual([
      'appMetadata',
      'companyConfiguration',
      'customers',
      'fileCache',
      'localPayments',
      'localReturnItems',
      'localReturns',
      'localSaleItems',
      'localSales',
      'localWasteEvidence',
      'localWasteItems',
      'localWastes',
      'outboxOperations',
      'presentations',
      'priceTiers',
      'priceVersions',
      'products',
      'provisionalCustomers',
      'receiptCache',
      'routeInventory',
      'routeLoadItems',
      'routeLoads',
      'routePackages',
      'specialPrices',
      'syncResults',
      'userContext',
    ]);

    const customerTx = db.transaction('customers');
    expect(Array.from(customerTx.store.indexNames)).toEqual([
      'normalizedPhone',
      'routeRunId',
      'status',
    ]);
    await customerTx.done;

    const outboxTx = db.transaction('outboxOperations');
    expect(Array.from(outboxTx.store.indexNames)).toEqual([
      'aggregateLocalId',
      'nextAttemptAt',
      'status',
      'statusNextAttemptAt',
    ]);
    await outboxTx.done;
    db.close();
  });

  it('conserva los datos al cerrar y reabrir la base', async () => {
    const name = databaseName('restart');
    const firstDb = await openMobileDatabase(name);
    const firstRepositories = createMobileRepositories(firstDb);
    await firstRepositories.customers.put({
      id: 'customer-1',
      routeRunId: 'route-1',
      code: 'C-001',
      name: 'Tienda Central',
      normalizedPhone: '55550101',
      customerType: 'PERMANENT',
      status: 'ACTIVE',
      creditAllowed: false,
      creditAvailable: '0.00',
      cachedAt: '2026-08-10T20:00:00Z',
    });
    firstDb.close();

    const reopenedDb = await openMobileDatabase(name);
    const reopenedRepositories = createMobileRepositories(reopenedDb);
    expect(await reopenedRepositories.customers.get('customer-1')).toMatchObject({
      code: 'C-001',
      routeRunId: 'route-1',
    });
    expect(await reopenedRepositories.customers.getAllByIndex('routeRunId', 'route-1')).toHaveLength(1);
    reopenedDb.close();
  });

  it('migra una base versión 1 sin perder el paquete de ruta existente', async () => {
    const name = databaseName('upgrade');
    const legacyDb = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('appMetadata', { keyPath: 'key' });
        const customers = db.createObjectStore('customers', { keyPath: 'id' });
        customers.createIndex('routeRunId', 'routeRunId');
      },
    });
    await legacyDb.put('customers', {
      id: 'legacy-customer',
      routeRunId: 'route-legacy',
      code: 'LEG-01',
      name: 'Cliente conservado',
    });
    legacyDb.close();

    const upgradedDb = await openMobileDatabase(name);
    expect(upgradedDb.version).toBe(MOBILE_DB_VERSION);
    expect(await upgradedDb.get('customers', 'legacy-customer')).toMatchObject({ code: 'LEG-01' });
    expect(Array.from(upgradedDb.objectStoreNames)).toContain('outboxOperations');
    expect(Array.from(upgradedDb.objectStoreNames)).toContain('localSales');
    upgradedDb.close();
  });

  it('guarda la venta local y Outbox en una sola transacción, con rollback completo', async () => {
    const db = await openMobileDatabase(databaseName('atomic'));
    const repositories = createMobileRepositories(db);
    const operationId = crypto.randomUUID();
    const outbox: OutboxRecord = {
      clientOperationId: operationId,
      deviceId: 'device-1',
      entityType: 'SALE',
      operationType: 'CREATE',
      aggregateLocalId: operationId,
      payload: { total: '25.00' },
      createdAtLocal: '2026-08-10T20:05:00-06:00',
      status: 'PENDING',
      retryCount: 0,
      lastErrorCode: null,
      lastErrorMessage: null,
      dependencies: [],
      nextAttemptAt: null,
      updatedAt: '2026-08-10T20:05:00-06:00',
    };
    await repositories.outboxOperations.add(outbox);

    const localSale: LocalSaleRecord = {
      localSaleId: operationId,
      clientOperationId: operationId,
      deviceId: 'device-1',
      routeRunId: 'run-1',
      sellerId: 'seller-1',
      customerId: 'customer-1',
      provisionalCustomerId: null,
      localReference: 'LOCAL-001',
      currencyCode: 'GTQ',
      subtotal: '25.00',
      discountTotal: '0.00',
      total: '25.00',
      syncStatus: 'PENDING',
      occurredAtLocal: '2026-08-10T20:05:00-06:00',
    };

    await expect(repositories.localOperations.saveSaleWithOutbox(localSale, outbox)).rejects.toBeDefined();
    expect(await repositories.localSales.get(operationId)).toBeUndefined();
    expect(await repositories.outboxOperations.get(operationId)).toEqual(outbox);
    db.close();
  });
});
