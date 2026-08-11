import { deleteDB } from 'idb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openMobileDatabase } from '../../offline/mobileDatabase';
import { queueWaste } from './wasteOffline';

const databaseNames: string[] = [];

afterEach(async () => {
  for (const name of databaseNames.splice(0)) await deleteDB(name);
});

describe('queueWaste', () => {
  it('guarda merma, unidades dañadas, fotografía y Outbox atómicamente', async () => {
    const name = `waste-${crypto.randomUUID()}`;
    databaseNames.push(name);
    const database = await openMobileDatabase(name);
    const notify = vi.fn();
    const photo = new File([new Uint8Array([1, 2, 3, 4])], 'rotura.jpg', { type: 'image/jpeg' });

    const waste = await queueWaste({
      routeId: '65f3dd47-02e8-41e1-a4f9-01cb35e8c1e5',
      sellerId: '1fecc80c-71fa-4013-8fbd-dc8ac61931d1',
      deviceId: 'f31c3ca9-440f-4e8c-87b0-ef13b1e2b2cc',
      wasteTypeId: '0bea8155-b7fd-440f-8aec-3e51bed540a3',
      presentationId: '2cc6218b-2465-4d1c-91e4-ffbf9fd1144a',
      presentationQuantity: 1,
      reportedDamagedUnits: 3,
      recoverableUnits: 21,
      reason: 'Fardo roto',
      photo,
    }, database, notify);

    const item = (await database.getAllFromIndex('localWasteItems', 'localWasteId', waste.localWasteId))[0];
    const evidence = (await database.getAllFromIndex('localWasteEvidence', 'localWasteId', waste.localWasteId))[0];
    const cachedPhoto = await database.get('fileCache', evidence.blobCacheKey);
    const outbox = await database.get('outboxOperations', waste.clientOperationId);
    expect(waste.status).toBe('LOCAL_PENDING');
    expect(item).toMatchObject({ reportedBaseUnits: '3', recoverableBaseUnits: '21' });
    expect(cachedPhoto).toMatchObject({ sizeBytes: 4, mediaType: 'image/jpeg', purpose: 'WASTE_EVIDENCE' });
    expect(cachedPhoto?.content).toBeDefined();
    expect(evidence.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(outbox).toMatchObject({
      entityType: 'WASTE', operationType: 'CREATE', aggregateLocalId: waste.localWasteId,
      status: 'PENDING', payload: { clientReference: waste.localWasteId },
    });
    expect(notify).toHaveBeenCalledOnce();
    database.close();
  });
});
