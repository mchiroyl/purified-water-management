import { deleteDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openMobileDatabase } from '../../offline/mobileDatabase';
import { queueReturn } from './returnOffline';

const databaseNames: string[] = [];

afterEach(async () => {
  for (const name of databaseNames.splice(0)) await deleteDB(name);
});

describe('queueReturn', () => {
  it('guarda producto no vendido y Outbox atómicamente sin convertirlo en merma', async () => {
    const name = `return-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const database = await openMobileDatabase(name);
    const notify = vi.fn();

    const item = await queueReturn({
      returnType: 'UNSOLD_GOOD',
      routeId: '65f3dd47-02e8-41e1-a4f9-01cb35e8c1e5',
      sellerId: '1fecc80c-71fa-4013-8fbd-dc8ac61931d1',
      deviceId: 'f31c3ca9-440f-4e8c-87b0-ef13b1e2b2cc',
      presentationId: '2cc6218b-2465-4d1c-91e4-ffbf9fd1144a',
      presentationQuantity: 2,
      quantityBaseUnits: 48,
      reason: 'Producto que regresó de la ruta',
    }, database, notify);

    const detail = (await database.getAllFromIndex('localReturnItems', 'localReturnId', item.localReturnId))[0];
    const outbox = await database.get('outboxOperations', item.clientOperationId);
    expect(item).toMatchObject({ returnType: 'UNSOLD_GOOD', status: 'LOCAL_PENDING', customerId: null });
    expect(detail).toMatchObject({ presentationQuantity: '2', quantityBaseUnits: '48', condition: 'GOOD' });
    expect(outbox).toMatchObject({
      entityType: 'RETURN', operationType: 'CREATE', aggregateLocalId: item.localReturnId,
      payload: { clientReference: item.localReturnId, returnType: 'UNSOLD_GOOD' },
    });
    expect(outbox?.payload).not.toHaveProperty('wasteTypeId');
    expect(notify).toHaveBeenCalledOnce();
    database.close();
  });
});
