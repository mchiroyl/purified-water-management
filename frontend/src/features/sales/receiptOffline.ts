import type { MobileDatabase } from '../../offline/mobileDatabase';

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes))
  .map(value => value.toString(16).padStart(2, '0')).join('');

export async function cacheReceipt(db: MobileDatabase, saleId: string, documentNumber: string, content: Blob) {
  const contentBytes = await content.arrayBuffer();
  const sha256 = hex(await crypto.subtle.digest('SHA-256', contentBytes));
  const cacheKey = `receipt:${saleId}:${sha256}`;
  const now = new Date().toISOString();
  const transaction = db.transaction(['fileCache', 'receiptCache'], 'readwrite');
  try {
    await transaction.objectStore('fileCache').put({
      cacheKey,
      content,
      mediaType: 'application/pdf',
      sizeBytes: content.size,
      sha256,
      purpose: 'INTERNAL_RECEIPT',
      createdAt: now
    });
    await transaction.objectStore('receiptCache').put({
      localSaleId: saleId,
      serverSaleId: saleId,
      officialNumber: documentNumber,
      fileCacheKey: cacheKey,
      status: 'READY',
      generatedAt: now
    });
    await transaction.done;
  } catch (error) {
    transaction.abort();
    throw error;
  }
}

export async function findCachedReceipt(db: MobileDatabase, saleId: string) {
  const receipt = await db.get('receiptCache', saleId);
  if (!receipt || receipt.status !== 'READY' || !receipt.fileCacheKey) return undefined;
  const file = await db.get('fileCache', receipt.fileCacheKey);
  return file ? { receipt, file } : undefined;
}

export async function markReceiptPending(db: MobileDatabase, saleId: string, documentNumber: string) {
  const current = await db.get('receiptCache', saleId);
  if (current?.status === 'READY') return;
  await db.put('receiptCache', {
    localSaleId: saleId,
    serverSaleId: saleId,
    officialNumber: documentNumber,
    status: 'PENDING_DOWNLOAD'
  });
}
