import { getMobileDatabase, notifyOutboxChanged } from '../../offline/SyncContext';
import {
  createMobileRepositories,
  type GeoLocationSnapshot,
  type LocalPaymentRecord,
  type LocalSaleItemRecord,
  type LocalSaleRecord,
  type MobileDatabase,
  type OutboxRecord,
  type RouteInventoryRecord,
} from '../../offline/mobileDatabase';

export type SaleOfflineItemInput = {
  presentationId: string;
  quantity: number;
  productId?: string;
  quantityBaseUnits?: number;
  unitPrice?: number;
  priceVersionId?: string;
  priceTierId?: string | null;
  specialPriceId?: string | null;
};

export type SaleOfflinePaymentInput = {
  method: 'CASH' | 'TRANSFER' | 'CREDIT';
  amount: number;
  reference?: string | null;
  bank?: string | null;
  evidenceReference?: string | null;
};

export type QueueSaleInput = {
  routeId: string;
  sellerId: string;
  deviceId: string;
  customerId: string;
  items: SaleOfflineItemInput[];
  payments: SaleOfflinePaymentInput[];
  location: GeoLocationSnapshot;
  currencyCode?: string;
  subtotal?: number;
  total?: number;
  customerName?: string;
  customerCode?: string;
};

export async function queueSale(
  input: QueueSaleInput,
  database?: MobileDatabase,
  notify: () => void = notifyOutboxChanged,
): Promise<LocalSaleRecord> {
  const db = database ?? (await getMobileDatabase());
  const repositories = createMobileRepositories(db);
  const localSaleId = crypto.randomUUID();
  const clientOperationId = crypto.randomUUID();
  const occurredAtLocal = new Date().toISOString();

  const calculatedTotal = input.total ?? input.items.reduce((acc, it) => acc + (it.quantity * (it.unitPrice ?? 0)), 0);
  const calculatedSubtotal = input.subtotal ?? calculatedTotal;

  const saleRecord: LocalSaleRecord = {
    localSaleId,
    serverSaleId: null,
    routeRunId: input.routeId,
    sellerId: input.sellerId,
    customerId: input.customerId,
    provisionalCustomerId: null,
    deviceId: input.deviceId,
    clientOperationId,
    localReference: `LOC-${localSaleId.slice(0, 8).toUpperCase()}`,
    officialNumber: null,
    currencyCode: input.currencyCode ?? 'GTQ',
    subtotal: calculatedSubtotal.toFixed(2),
    discountTotal: '0.00',
    total: calculatedTotal.toFixed(2),
    location: input.location,
    syncStatus: 'PENDING',
    occurredAtLocal,
  };

  const saleItems: LocalSaleItemRecord[] = input.items.map((it) => {
    const qty = Number(it.quantity) || 1;
    const baseUnits = it.quantityBaseUnits ?? qty;
    const price = it.unitPrice ?? 0;
    return {
      id: crypto.randomUUID(),
      localSaleId,
      presentationId: it.presentationId,
      priceVersionId: it.priceVersionId ?? crypto.randomUUID(),
      priceTierId: it.priceTierId ?? null,
      specialPriceId: it.specialPriceId ?? null,
      quantityPresentations: String(qty),
      quantityBaseUnits: String(baseUnits),
      unitPrice: price.toFixed(2),
      subtotal: (qty * price).toFixed(2),
    };
  });

  const paymentRecords: LocalPaymentRecord[] = input.payments.map((p) => {
    let amt = Number(p.amount) || 0;
    if (input.payments.length === 1 && amt === 0 && calculatedTotal > 0) {
      amt = calculatedTotal;
    }
    return {
      localPaymentId: crypto.randomUUID(),
      serverPaymentId: null,
      localSaleId,
      routeRunId: input.routeId,
      clientOperationId,
      paymentMethod: p.method === 'TRANSFER' ? 'TRANSFER' : 'CASH',
      amount: amt.toFixed(2),
      verificationStatus: 'CONFIRMED',
      transferReference: p.reference ?? null,
      evidenceCacheKey: p.evidenceReference ?? null,
      syncStatus: 'PENDING',
      paidAtLocal: occurredAtLocal,
    };
  });

  // Actualizar inventario local del camión de forma inmediata si existe en IndexedDB
  const currentInventory = await db.getAll('routeInventory');
  const inventoryToUpdate: RouteInventoryRecord[] = [];
  for (const it of input.items) {
    if (!it.productId) continue;
    const match = currentInventory.find(
      (inv) => inv.productId === it.productId && inv.routeRunId === input.routeId,
    );
    if (match) {
      const soldUnits = it.quantityBaseUnits ?? it.quantity;
      const currentAvailable = Number(match.availableBaseUnits) || 0;
      const newAvailable = Math.max(0, currentAvailable - soldUnits);
      inventoryToUpdate.push({
        ...match,
        availableBaseUnits: String(newAvailable),
        updatedAt: occurredAtLocal,
      });
    }
  }

  // Prepara el payload exactamente como lo exige CreateSaleRequest en el servidor
  const outbox: OutboxRecord = {
    clientOperationId,
    deviceId: input.deviceId,
    entityType: 'SALE',
    operationType: 'CREATE',
    aggregateLocalId: localSaleId,
    payload: {
      clientReference: localSaleId,
      routeId: input.routeId,
      customerId: input.customerId,
      items: input.items.map((it) => ({
        presentationId: it.presentationId,
        quantity: it.quantity,
      })),
      payments: input.payments.map((p) => ({
        method: p.method,
        amount: Number(p.amount) || 0,
        reference: p.reference ?? null,
        bank: p.bank ?? null,
        evidenceReference: p.evidenceReference ?? null,
      })),
      location: {
        latitude: input.location.latitude,
        longitude: input.location.longitude,
        accuracyMeters: input.location.accuracyMeters,
        capturedAt: input.location.capturedAt,
      },
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

  await repositories.localOperations.saveSaleWithOutbox(
    saleRecord,
    outbox,
    saleItems,
    paymentRecords,
    inventoryToUpdate,
  );

  notify();
  return saleRecord;
}
