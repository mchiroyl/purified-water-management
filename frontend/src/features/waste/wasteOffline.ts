import { getMobileDatabase, notifyOutboxChanged } from '../../offline/SyncContext';
import {
  createMobileRepositories,
  type FileCacheRecord,
  type LocalWasteEvidenceRecord,
  type LocalWasteItemRecord,
  type LocalWasteRecord,
  type MobileDatabase,
  type OutboxRecord,
} from '../../offline/mobileDatabase';

export type WasteOfflineInput = {
  routeId: string;
  sellerId: string;
  deviceId: string;
  wasteTypeId: string;
  presentationId: string;
  presentationQuantity: number;
  reportedDamagedUnits: number;
  recoverableUnits: number;
  reason: string;
  photo?: File | null;
};

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export async function queueWaste(
  input: WasteOfflineInput,
  database?: MobileDatabase,
  notify: () => void = notifyOutboxChanged,
) {
  const db = database ?? await getMobileDatabase();
  const repositories = createMobileRepositories(db);
  const localWasteId = crypto.randomUUID();
  const clientOperationId = crypto.randomUUID();
  const itemId = crypto.randomUUID();
  const occurredAtLocal = new Date().toISOString();
  const waste: LocalWasteRecord = {
    localWasteId,
    serverWasteId: null,
    routeRunId: input.routeId,
    sellerId: input.sellerId,
    deviceId: input.deviceId,
    clientOperationId,
    status: 'LOCAL_PENDING',
    reason: input.reason.trim(),
    syncStatus: 'PENDING',
    occurredAtLocal,
  };
  const items: LocalWasteItemRecord[] = [{
    id: itemId,
    localWasteId,
    wasteTypeId: input.wasteTypeId,
    presentationId: input.presentationId,
    presentationQuantity: String(input.presentationQuantity),
    reportedBaseUnits: String(input.reportedDamagedUnits),
    recoverableBaseUnits: String(input.recoverableUnits),
    approvedBaseUnits: null,
  }];
  const evidence: LocalWasteEvidenceRecord[] = [];
  const files: FileCacheRecord[] = [];
  const payloadEvidence: Array<Record<string, unknown>> = [];
  if (input.photo) {
    const cacheKey = `waste:${localWasteId}:${crypto.randomUUID()}`;
    const photoBytes = await input.photo.arrayBuffer();
    const sha256 = hex(await crypto.subtle.digest('SHA-256', photoBytes));
    const evidenceId = crypto.randomUUID();
    evidence.push({
      id: evidenceId,
      localWasteId,
      blobCacheKey: cacheKey,
      mediaType: input.photo.type,
      sizeBytes: input.photo.size,
      sha256,
      syncStatus: 'PENDING',
      capturedAtLocal: occurredAtLocal,
    });
    files.push({
      cacheKey,
      content: new Blob([photoBytes], { type: input.photo.type }),
      mediaType: input.photo.type,
      sizeBytes: input.photo.size,
      sha256,
      purpose: 'WASTE_EVIDENCE',
      createdAt: occurredAtLocal,
    });
    payloadEvidence.push({ storageReference: `offline:${cacheKey}`, mediaType: input.photo.type,
      sha256, capturedAtLocal: occurredAtLocal });
  }
  const outbox: OutboxRecord = {
    clientOperationId,
    deviceId: input.deviceId,
    entityType: 'WASTE',
    operationType: 'CREATE',
    aggregateLocalId: localWasteId,
    payload: {
      clientReference: localWasteId,
      routeId: input.routeId,
      reason: waste.reason,
      occurredAtLocal,
      items: [{ wasteTypeId: input.wasteTypeId, presentationId: input.presentationId,
        presentationQuantity: input.presentationQuantity, reportedDamagedUnits: input.reportedDamagedUnits,
        recoverableUnits: input.recoverableUnits }],
      evidence: payloadEvidence,
    },
    dependencies: [],
    status: 'PENDING',
    retryCount: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
    nextAttemptAt: null,
    createdAtLocal: occurredAtLocal,
    updatedAt: occurredAtLocal,
  };
  await repositories.localOperations.saveWasteWithOutbox(waste, items, evidence, files, outbox);
  notify();
  return waste;
}
