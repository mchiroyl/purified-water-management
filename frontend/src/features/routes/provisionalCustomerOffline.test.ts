import { deleteDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openMobileDatabase } from '../../offline/mobileDatabase';
import { queueProvisionalCustomer } from './provisionalCustomerOffline';

const databaseNames: string[] = [];

afterEach(async () => {
  for (const name of databaseNames.splice(0)) await deleteDB(name);
});

describe('queueProvisionalCustomer', () => {
  it('guarda cliente local y Outbox en una sola operación con el UUID estable', async () => {
    const name = `provisional-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const database = await openMobileDatabase(name);
    const notify = vi.fn();

    const customer = await queueProvisionalCustomer({
      routeId: '65f3dd47-02e8-41e1-a4f9-01cb35e8c1e5',
      sellerId: '1fecc80c-71fa-4013-8fbd-dc8ac61931d1',
      deviceId: 'f31c3ca9-440f-4e8c-87b0-ef13b1e2b2cc',
      name: 'Tienda Nueva',
      phone: '+502 5555-0101',
      whatsapp: '5555 0101',
      addressReference: 'Frente al mercado',
    }, database, notify);

    const stored = await database.get('provisionalCustomers', customer.localCustomerId);
    const outbox = await database.get('outboxOperations', customer.clientOperationId);
    expect(stored).toEqual(customer);
    expect(outbox).toMatchObject({
      deviceId: customer.deviceId,
      entityType: 'PROVISIONAL_CUSTOMER',
      operationType: 'CREATE',
      aggregateLocalId: customer.localCustomerId,
      dependencies: [],
      status: 'PENDING',
      payload: { localCustomerId: customer.localCustomerId, routeId: customer.routeRunId },
    });
    expect(customer.normalizedPhone).toBe('50255550101');
    expect(notify).toHaveBeenCalledOnce();
    database.close();
  });
});
