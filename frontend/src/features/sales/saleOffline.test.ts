import { deleteDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openMobileDatabase } from '../../offline/mobileDatabase';
import { queueSale } from './saleOffline';

const databaseNames: string[] = [];

afterEach(async () => {
  for (const name of databaseNames.splice(0)) await deleteDB(name);
});

describe('queueSale', () => {
  it('guarda venta local, ítems, pagos y registro en Outbox atómicamente', async () => {
    const dbName = `test-sale-${crypto.randomUUID()}`;
    databaseNames.push(dbName);
    const db = await openMobileDatabase(dbName);
    const notify = vi.fn();

    const sale = await queueSale({
      routeId: 'route-1',
      sellerId: 'seller-1',
      deviceId: 'device-1',
      customerId: 'cust-1',
      items: [
        { presentationId: 'pres-1', quantity: 5, unitPrice: 20, quantityBaseUnits: 5 },
      ],
      payments: [
        { method: 'CASH', amount: 100 },
      ],
      location: {
        latitude: 14.6349,
        longitude: -90.5069,
        accuracyMeters: 5,
        capturedAt: '2026-10-20T10:00:00Z',
      },
    }, db, notify);

    expect(sale.localSaleId).toBeDefined();
    expect(sale.syncStatus).toBe('PENDING');
    expect(sale.total).toBe('100.00');
    expect(sale.localReference).toMatch(/^LOC-/);

    const storedSale = await db.get('localSales', sale.localSaleId);
    expect(storedSale).toBeDefined();
    expect(storedSale?.customerId).toBe('cust-1');

    const outbox = await db.get('outboxOperations', sale.clientOperationId);
    expect(outbox).toBeDefined();
    expect(outbox?.entityType).toBe('SALE');
    expect(outbox?.operationType).toBe('CREATE');
    expect(outbox?.aggregateLocalId).toBe(sale.localSaleId);
    expect(outbox?.payload).toMatchObject({
      routeId: 'route-1',
      customerId: 'cust-1',
      items: [{ presentationId: 'pres-1', quantity: 5 }],
      payments: [{ method: 'CASH', amount: 100 }],
    });

    const items = await db.getAllFromIndex('localSaleItems', 'localSaleId', sale.localSaleId);
    expect(items).toHaveLength(1);
    expect(items[0].presentationId).toBe('pres-1');
    expect(items[0].subtotal).toBe('100.00');

    const payments = await db.getAllFromIndex('localPayments', 'localSaleId', sale.localSaleId);
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe('100.00');
    expect(payments[0].paymentMethod).toBe('CASH');

    expect(notify).toHaveBeenCalledOnce();
    db.close();
  });

  it('descuenta inventario local del camión si está presente en routeInventory', async () => {
    const dbName = `test-sale-inv-${crypto.randomUUID()}`;
    databaseNames.push(dbName);
    const db = await openMobileDatabase(dbName);
    const notify = vi.fn();

    // Insert initial inventory
    await db.put('routeInventory', {
      inventoryKey: 'route-1:prod-1',
      routeRunId: 'route-1',
      productId: 'prod-1',
      availableBaseUnits: '50',
      pendingBaseUnits: '0',
      serverVersion: 1,
      updatedAt: '2026-10-20T08:00:00Z',
    });

    await queueSale({
      routeId: 'route-1',
      sellerId: 'seller-1',
      deviceId: 'device-1',
      customerId: 'cust-1',
      items: [
        { presentationId: 'pres-1', productId: 'prod-1', quantity: 10, unitPrice: 20, quantityBaseUnits: 10 },
      ],
      payments: [
        { method: 'CASH', amount: 200 },
      ],
      location: {
        latitude: 14.6349,
        longitude: -90.5069,
        accuracyMeters: 5,
        capturedAt: '2026-10-20T10:00:00Z',
      },
    }, db, notify);

    const inv = await db.get('routeInventory', 'route-1:prod-1');
    expect(inv?.availableBaseUnits).toBe('40');

    db.close();
  });
});
