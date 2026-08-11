import { afterEach, describe, expect, it } from 'vitest';
import { openMobileDatabase } from '../../offline/mobileDatabase';
import { cacheReceipt, findCachedReceipt, markReceiptPending } from './receiptOffline';

const names: string[] = [];
afterEach(() => {
  for (const name of names.splice(0)) indexedDB.deleteDatabase(name);
});

describe('receiptOffline', () => {
  it('stores the PDF and receipt metadata in one mobile transaction', async () => {
    const name = `receipt-${crypto.randomUUID()}`;
    names.push(name);
    const db = await openMobileDatabase(name);
    const blob = new Blob(['%PDF cached'], { type: 'application/pdf' });

    await cacheReceipt(db, 'sale-1', 'V-42', blob);

    const cached = await findCachedReceipt(db, 'sale-1');
    expect(cached?.receipt.status).toBe('READY');
    expect(cached?.file.sizeBytes).toBe(blob.size);
    expect(cached?.file.sha256).toMatch(/^[a-f0-9]{64}$/);
    db.close();
  });

  it('marks a receipt pending without overwriting an already ready file', async () => {
    const name = `receipt-${crypto.randomUUID()}`;
    names.push(name);
    const db = await openMobileDatabase(name);
    await markReceiptPending(db, 'sale-2', 'V-43');
    expect((await db.get('receiptCache', 'sale-2'))?.status).toBe('PENDING_DOWNLOAD');
    await cacheReceipt(db, 'sale-2', 'V-43', new Blob(['%PDF'], { type: 'application/pdf' }));
    await markReceiptPending(db, 'sale-2', 'V-43');
    expect((await db.get('receiptCache', 'sale-2'))?.status).toBe('READY');
    db.close();
  });
});
