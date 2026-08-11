import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  type IndexKey,
  type IndexNames,
  type StoreKey,
  type StoreNames,
  type StoreValue,
} from 'idb';

export const MOBILE_DB_NAME = 'agua-pura-mobile';
export const MOBILE_DB_VERSION = 2;

export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED_RETRYABLE' | 'CONFLICT' | 'REJECTED';
export type MetadataRecord = { key: string; value: unknown; updatedAt: string };
export type UserContextSnapshot = { userId: string; username: string; roles: string[]; deviceId: string; cachedAt: string };
export type CompanyConfigurationSnapshot = {
  id: string;
  commercialName: string;
  legalName: string;
  taxId: string;
  contact: Record<string, string>;
  logoCacheKey?: string | null;
  currencyCode: string;
  timezone: string;
  receiptPrefix: string;
  serverVersion: number;
  cachedAt: string;
};
export type RoutePackageSnapshot = {
  routeRunId: string;
  routeId: string;
  sellerId: string;
  vehicleId?: string | null;
  status: string;
  businessDate: string;
  packageVersion: string;
  downloadedAt: string;
  expiresAt: string;
};
export type CustomerSnapshot = {
  id: string;
  routeRunId: string;
  code: string;
  name: string;
  normalizedPhone: string;
  customerType: string;
  status: string;
  creditAllowed: boolean;
  creditAvailable: string;
  cachedAt: string;
};
export type ProductSnapshot = {
  id: string;
  code: string;
  name: string;
  baseUomId: string;
  active: boolean;
  activeIndex: 0 | 1;
  tracksInventory: boolean;
  serverVersion: number;
};
export type PresentationSnapshot = {
  id: string;
  productId: string;
  code: string;
  name: string;
  unitsPerPresentation: string;
  active: boolean;
  activeIndex: 0 | 1;
};
export type PriceVersionSnapshot = { id: string; priceListId: string; versionNumber: number; validFrom: string; validTo?: string | null; status: string };
export type PriceTierSnapshot = {
  id: string;
  priceVersionId: string;
  presentationId: string;
  minBaseUnits: string;
  maxBaseUnits?: string | null;
  unitPrice: string;
};
export type SpecialPriceSnapshot = {
  id: string;
  customerId: string;
  presentationId: string;
  unitPrice: string;
  validFrom: string;
  validTo?: string | null;
  status: string;
};
export type RouteLoadSnapshot = { id: string; routeRunId: string; status: string; sellerConfirmedAt?: string | null; serverVersion: string };
export type RouteLoadItemSnapshot = { id: string; routeLoadId: string; presentationId: string; presentationQuantity: string; quantityBaseUnits: string };
export type RouteInventoryRecord = {
  inventoryKey: string;
  routeRunId: string;
  productId: string;
  availableBaseUnits: string;
  pendingBaseUnits: string;
  serverVersion: number;
  updatedAt: string;
};
export type ProvisionalCustomerRecord = {
  localCustomerId: string;
  clientOperationId: string;
  routeRunId: string;
  sellerId: string;
  deviceId: string;
  name: string;
  normalizedPhone: string;
  whatsapp?: string | null;
  addressReference: string;
  syncStatus: SyncStatus;
  serverCustomerId?: string | null;
  createdAtLocal: string;
};
export type LocalSaleRecord = {
  localSaleId: string;
  serverSaleId?: string | null;
  routeRunId: string;
  sellerId: string;
  customerId?: string | null;
  provisionalCustomerId?: string | null;
  deviceId: string;
  clientOperationId: string;
  localReference: string;
  officialNumber?: string | null;
  currencyCode: string;
  subtotal: string;
  discountTotal: string;
  total: string;
  syncStatus: SyncStatus;
  occurredAtLocal: string;
};
export type LocalSaleItemRecord = {
  id: string;
  localSaleId: string;
  presentationId: string;
  priceVersionId: string;
  priceTierId?: string | null;
  specialPriceId?: string | null;
  quantityPresentations: string;
  quantityBaseUnits: string;
  unitPrice: string;
  subtotal: string;
};
export type LocalPaymentRecord = {
  localPaymentId: string;
  serverPaymentId?: string | null;
  localSaleId: string;
  routeRunId: string;
  clientOperationId: string;
  paymentMethod: 'CASH' | 'TRANSFER';
  amount: string;
  verificationStatus: string;
  transferReference?: string | null;
  evidenceCacheKey?: string | null;
  syncStatus: SyncStatus;
  paidAtLocal: string;
};
export type LocalWasteRecord = {
  localWasteId: string;
  serverWasteId?: string | null;
  routeRunId: string;
  sellerId: string;
  deviceId: string;
  clientOperationId: string;
  status: string;
  reason: string;
  syncStatus: SyncStatus;
  occurredAtLocal: string;
};
export type LocalWasteItemRecord = {
  id: string;
  localWasteId: string;
  wasteTypeId: string;
  presentationId: string;
  presentationQuantity: string;
  reportedBaseUnits: string;
  recoverableBaseUnits: string;
  approvedBaseUnits?: string | null;
};
export type LocalWasteEvidenceRecord = {
  id: string;
  localWasteId: string;
  blobCacheKey: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  syncStatus: SyncStatus;
  capturedAtLocal: string;
};
export type LocalReturnRecord = {
  localReturnId: string;
  serverReturnId?: string | null;
  routeRunId: string;
  sellerId: string;
  deviceId: string;
  returnType: 'UNSOLD_GOOD' | 'CUSTOMER_RETURN';
  customerId?: string | null;
  localSaleId?: string | null;
  clientOperationId: string;
  status: string;
  reason: string;
  syncStatus: SyncStatus;
  reportedAtLocal: string;
};
export type LocalReturnItemRecord = { id: string; localReturnId: string; presentationId: string; presentationQuantity: string; quantityBaseUnits: string; condition: string };
export type OutboxRecord = {
  clientOperationId: string;
  deviceId: string;
  entityType: string;
  operationType: string;
  aggregateLocalId: string;
  payload: unknown;
  dependencies: string[];
  status: SyncStatus;
  retryCount: number;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  nextAttemptAt: string | null;
  createdAtLocal: string;
  updatedAt: string;
};
export type SyncResultRecord = {
  clientOperationId: string;
  resultStatus: string;
  serverEntityId?: string | null;
  resultPayload?: unknown;
  errorCode?: string | null;
  processedAtServer?: string | null;
  storedAtLocal: string;
};
export type FileCacheRecord = { cacheKey: string; content: Blob; mediaType: string; sizeBytes: number; sha256: string; purpose: string; createdAt: string; expiresAt?: string | null };
export type ReceiptCacheRecord = { localSaleId: string; serverSaleId?: string | null; officialNumber?: string | null; fileCacheKey?: string | null; status: string; generatedAt?: string | null };

export interface MobileDatabaseSchema extends DBSchema {
  appMetadata: { key: string; value: MetadataRecord };
  userContext: { key: string; value: UserContextSnapshot; indexes: { deviceId: string } };
  companyConfiguration: { key: string; value: CompanyConfigurationSnapshot; indexes: { serverVersion: number } };
  routePackages: { key: string; value: RoutePackageSnapshot; indexes: { businessDate: string; sellerId: string; status: string } };
  customers: { key: string; value: CustomerSnapshot; indexes: { normalizedPhone: string; routeRunId: string; status: string } };
  products: { key: string; value: ProductSnapshot; indexes: { active: number; code: string } };
  presentations: { key: string; value: PresentationSnapshot; indexes: { active: number; code: string; productId: string } };
  priceVersions: { key: string; value: PriceVersionSnapshot; indexes: { priceListId: string; status: string; validFrom: string; validTo: string } };
  priceTiers: { key: string; value: PriceTierSnapshot; indexes: { presentationId: string; priceVersionId: string } };
  specialPrices: { key: string; value: SpecialPriceSnapshot; indexes: { customerId: string; presentationId: string; status: string } };
  routeLoads: { key: string; value: RouteLoadSnapshot; indexes: { routeRunId: string; status: string } };
  routeLoadItems: { key: string; value: RouteLoadItemSnapshot; indexes: { presentationId: string; routeLoadId: string } };
  routeInventory: { key: string; value: RouteInventoryRecord; indexes: { productId: string; routeAndProduct: [string, string] } };
  provisionalCustomers: { key: string; value: ProvisionalCustomerRecord; indexes: { normalizedPhone: string; routeRunId: string; serverCustomerId: string; syncStatus: SyncStatus } };
  localSales: { key: string; value: LocalSaleRecord; indexes: { clientOperationId: string; customerId: string; provisionalCustomerId: string; routeRunId: string; syncStatus: SyncStatus } };
  localSaleItems: { key: string; value: LocalSaleItemRecord; indexes: { localSaleId: string; presentationId: string } };
  localPayments: { key: string; value: LocalPaymentRecord; indexes: { clientOperationId: string; localSaleId: string; syncStatus: SyncStatus } };
  localWastes: { key: string; value: LocalWasteRecord; indexes: { clientOperationId: string; routeRunId: string; syncStatus: SyncStatus } };
  localWasteItems: { key: string; value: LocalWasteItemRecord; indexes: { localWasteId: string; presentationId: string } };
  localWasteEvidence: { key: string; value: LocalWasteEvidenceRecord; indexes: { localWasteId: string; sha256: string; syncStatus: SyncStatus } };
  localReturns: { key: string; value: LocalReturnRecord; indexes: { clientOperationId: string; routeRunId: string; syncStatus: SyncStatus } };
  localReturnItems: { key: string; value: LocalReturnItemRecord; indexes: { localReturnId: string; presentationId: string } };
  outboxOperations: { key: string; value: OutboxRecord; indexes: { aggregateLocalId: string; nextAttemptAt: string; status: SyncStatus; statusNextAttemptAt: [SyncStatus, string] } };
  syncResults: { key: string; value: SyncResultRecord; indexes: { resultStatus: string; serverEntityId: string } };
  fileCache: { key: string; value: FileCacheRecord; indexes: { expiresAt: string; purpose: string; sha256: string } };
  receiptCache: { key: string; value: ReceiptCacheRecord; indexes: { officialNumber: string; serverSaleId: string; status: string } };
}

export type MobileDatabase = IDBPDatabase<MobileDatabaseSchema>;
type MobileStoreName = StoreNames<MobileDatabaseSchema>;

function hasStore(db: MobileDatabase, name: MobileStoreName) {
  return db.objectStoreNames.contains(name);
}

function createVersionOneStores(db: MobileDatabase) {
  if (!hasStore(db, 'appMetadata')) db.createObjectStore('appMetadata', { keyPath: 'key' });
  if (!hasStore(db, 'userContext')) {
    const store = db.createObjectStore('userContext', { keyPath: 'userId' });
    store.createIndex('deviceId', 'deviceId');
  }
  if (!hasStore(db, 'companyConfiguration')) {
    const store = db.createObjectStore('companyConfiguration', { keyPath: 'id' });
    store.createIndex('serverVersion', 'serverVersion');
  }
  if (!hasStore(db, 'routePackages')) {
    const store = db.createObjectStore('routePackages', { keyPath: 'routeRunId' });
    store.createIndex('businessDate', 'businessDate');
    store.createIndex('sellerId', 'sellerId');
    store.createIndex('status', 'status');
  }
  if (!hasStore(db, 'customers')) {
    const store = db.createObjectStore('customers', { keyPath: 'id' });
    store.createIndex('normalizedPhone', 'normalizedPhone');
    store.createIndex('routeRunId', 'routeRunId');
    store.createIndex('status', 'status');
  }
  if (!hasStore(db, 'products')) {
    const store = db.createObjectStore('products', { keyPath: 'id' });
    store.createIndex('active', 'activeIndex');
    store.createIndex('code', 'code', { unique: true });
  }
  if (!hasStore(db, 'presentations')) {
    const store = db.createObjectStore('presentations', { keyPath: 'id' });
    store.createIndex('active', 'activeIndex');
    store.createIndex('code', 'code', { unique: true });
    store.createIndex('productId', 'productId');
  }
  if (!hasStore(db, 'priceVersions')) {
    const store = db.createObjectStore('priceVersions', { keyPath: 'id' });
    store.createIndex('priceListId', 'priceListId');
    store.createIndex('status', 'status');
    store.createIndex('validFrom', 'validFrom');
    store.createIndex('validTo', 'validTo');
  }
  if (!hasStore(db, 'priceTiers')) {
    const store = db.createObjectStore('priceTiers', { keyPath: 'id' });
    store.createIndex('presentationId', 'presentationId');
    store.createIndex('priceVersionId', 'priceVersionId');
  }
  if (!hasStore(db, 'specialPrices')) {
    const store = db.createObjectStore('specialPrices', { keyPath: 'id' });
    store.createIndex('customerId', 'customerId');
    store.createIndex('presentationId', 'presentationId');
    store.createIndex('status', 'status');
  }
  if (!hasStore(db, 'routeLoads')) {
    const store = db.createObjectStore('routeLoads', { keyPath: 'id' });
    store.createIndex('routeRunId', 'routeRunId');
    store.createIndex('status', 'status');
  }
  if (!hasStore(db, 'routeLoadItems')) {
    const store = db.createObjectStore('routeLoadItems', { keyPath: 'id' });
    store.createIndex('presentationId', 'presentationId');
    store.createIndex('routeLoadId', 'routeLoadId');
  }
  if (!hasStore(db, 'routeInventory')) {
    const store = db.createObjectStore('routeInventory', { keyPath: 'inventoryKey' });
    store.createIndex('productId', 'productId');
    store.createIndex('routeAndProduct', ['routeRunId', 'productId'], { unique: true });
  }
}

function createVersionTwoStores(db: MobileDatabase) {
  if (!hasStore(db, 'provisionalCustomers')) {
    const store = db.createObjectStore('provisionalCustomers', { keyPath: 'localCustomerId' });
    store.createIndex('normalizedPhone', 'normalizedPhone');
    store.createIndex('routeRunId', 'routeRunId');
    store.createIndex('serverCustomerId', 'serverCustomerId');
    store.createIndex('syncStatus', 'syncStatus');
  }
  if (!hasStore(db, 'localSales')) {
    const store = db.createObjectStore('localSales', { keyPath: 'localSaleId' });
    store.createIndex('clientOperationId', 'clientOperationId', { unique: true });
    store.createIndex('customerId', 'customerId');
    store.createIndex('provisionalCustomerId', 'provisionalCustomerId');
    store.createIndex('routeRunId', 'routeRunId');
    store.createIndex('syncStatus', 'syncStatus');
  }
  if (!hasStore(db, 'localSaleItems')) {
    const store = db.createObjectStore('localSaleItems', { keyPath: 'id' });
    store.createIndex('localSaleId', 'localSaleId');
    store.createIndex('presentationId', 'presentationId');
  }
  if (!hasStore(db, 'localPayments')) {
    const store = db.createObjectStore('localPayments', { keyPath: 'localPaymentId' });
    store.createIndex('clientOperationId', 'clientOperationId', { unique: true });
    store.createIndex('localSaleId', 'localSaleId');
    store.createIndex('syncStatus', 'syncStatus');
  }
  if (!hasStore(db, 'localWastes')) {
    const store = db.createObjectStore('localWastes', { keyPath: 'localWasteId' });
    store.createIndex('clientOperationId', 'clientOperationId', { unique: true });
    store.createIndex('routeRunId', 'routeRunId');
    store.createIndex('syncStatus', 'syncStatus');
  }
  if (!hasStore(db, 'localWasteItems')) {
    const store = db.createObjectStore('localWasteItems', { keyPath: 'id' });
    store.createIndex('localWasteId', 'localWasteId');
    store.createIndex('presentationId', 'presentationId');
  }
  if (!hasStore(db, 'localWasteEvidence')) {
    const store = db.createObjectStore('localWasteEvidence', { keyPath: 'id' });
    store.createIndex('localWasteId', 'localWasteId');
    store.createIndex('sha256', 'sha256');
    store.createIndex('syncStatus', 'syncStatus');
  }
  if (!hasStore(db, 'localReturns')) {
    const store = db.createObjectStore('localReturns', { keyPath: 'localReturnId' });
    store.createIndex('clientOperationId', 'clientOperationId', { unique: true });
    store.createIndex('routeRunId', 'routeRunId');
    store.createIndex('syncStatus', 'syncStatus');
  }
  if (!hasStore(db, 'localReturnItems')) {
    const store = db.createObjectStore('localReturnItems', { keyPath: 'id' });
    store.createIndex('localReturnId', 'localReturnId');
    store.createIndex('presentationId', 'presentationId');
  }
  if (!hasStore(db, 'outboxOperations')) {
    const store = db.createObjectStore('outboxOperations', { keyPath: 'clientOperationId' });
    store.createIndex('aggregateLocalId', 'aggregateLocalId');
    store.createIndex('nextAttemptAt', 'nextAttemptAt');
    store.createIndex('status', 'status');
    store.createIndex('statusNextAttemptAt', ['status', 'nextAttemptAt']);
  }
  if (!hasStore(db, 'syncResults')) {
    const store = db.createObjectStore('syncResults', { keyPath: 'clientOperationId' });
    store.createIndex('resultStatus', 'resultStatus');
    store.createIndex('serverEntityId', 'serverEntityId');
  }
  if (!hasStore(db, 'fileCache')) {
    const store = db.createObjectStore('fileCache', { keyPath: 'cacheKey' });
    store.createIndex('expiresAt', 'expiresAt');
    store.createIndex('purpose', 'purpose');
    store.createIndex('sha256', 'sha256');
  }
  if (!hasStore(db, 'receiptCache')) {
    const store = db.createObjectStore('receiptCache', { keyPath: 'localSaleId' });
    store.createIndex('officialNumber', 'officialNumber');
    store.createIndex('serverSaleId', 'serverSaleId');
    store.createIndex('status', 'status');
  }
}

export function openMobileDatabase(name = MOBILE_DB_NAME) {
  let openedDatabase: MobileDatabase | undefined;
  return openDB<MobileDatabaseSchema>(name, MOBILE_DB_VERSION, {
    upgrade(db) {
      createVersionOneStores(db);
      createVersionTwoStores(db);
    },
    blocked() {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('agua-pura:database-blocked'));
    },
    blocking() {
      openedDatabase?.close();
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('agua-pura:database-upgrade-required'));
    },
    terminated() {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('agua-pura:database-terminated'));
    },
  }).then((database) => {
    openedDatabase = database;
    return database;
  });
}

export class MobileRepository<StoreName extends MobileStoreName> {
  constructor(private readonly db: MobileDatabase, private readonly storeName: StoreName) {}
  get(key: StoreKey<MobileDatabaseSchema, StoreName>) { return this.db.get(this.storeName, key); }
  getAll() { return this.db.getAll(this.storeName); }
  getAllByIndex<IndexName extends IndexNames<MobileDatabaseSchema, StoreName>>(
    indexName: IndexName,
    query?: IndexKey<MobileDatabaseSchema, StoreName, IndexName> | IDBKeyRange,
  ) { return this.db.getAllFromIndex(this.storeName, indexName, query); }
  put(value: StoreValue<MobileDatabaseSchema, StoreName>) { return this.db.put(this.storeName, value); }
  add(value: StoreValue<MobileDatabaseSchema, StoreName>) { return this.db.add(this.storeName, value); }
  delete(key: StoreKey<MobileDatabaseSchema, StoreName>) { return this.db.delete(this.storeName, key); }
  clear() { return this.db.clear(this.storeName); }
}

export type RoutePackage = {
  metadata: MetadataRecord;
  userContext: UserContextSnapshot;
  companyConfiguration: CompanyConfigurationSnapshot;
  routePackage: RoutePackageSnapshot;
  customers: CustomerSnapshot[];
  products: ProductSnapshot[];
  presentations: PresentationSnapshot[];
  priceVersions: PriceVersionSnapshot[];
  priceTiers: PriceTierSnapshot[];
  specialPrices: SpecialPriceSnapshot[];
  routeLoads: RouteLoadSnapshot[];
  routeLoadItems: RouteLoadItemSnapshot[];
  routeInventory: RouteInventoryRecord[];
};

async function abortAndRethrow(
  transaction: IDBPTransaction<MobileDatabaseSchema, MobileStoreName[], 'readwrite'>,
  error: unknown,
): Promise<never> {
  await transaction.done.catch(() => undefined);
  throw error;
}

export function createMobileRepositories(db: MobileDatabase) {
  const localOperations = {
    async saveSaleWithOutbox(
      sale: LocalSaleRecord,
      outbox: OutboxRecord,
      items: LocalSaleItemRecord[] = [],
      payments: LocalPaymentRecord[] = [],
      inventory: RouteInventoryRecord[] = [],
    ) {
      const transaction = db.transaction(['localSales', 'localSaleItems', 'localPayments', 'routeInventory', 'outboxOperations'], 'readwrite');
      try {
        await transaction.objectStore('localSales').put(sale);
        for (const item of items) await transaction.objectStore('localSaleItems').put(item);
        for (const payment of payments) await transaction.objectStore('localPayments').put(payment);
        for (const balance of inventory) await transaction.objectStore('routeInventory').put(balance);
        await transaction.objectStore('outboxOperations').add(outbox);
        await transaction.done;
      } catch (error) {
        return abortAndRethrow(transaction, error);
      }
    },
    async saveProvisionalCustomerWithOutbox(customer: ProvisionalCustomerRecord, outbox: OutboxRecord) {
      const transaction = db.transaction(['provisionalCustomers', 'outboxOperations'], 'readwrite');
      try {
        await transaction.objectStore('provisionalCustomers').put(customer);
        await transaction.objectStore('outboxOperations').add(outbox);
        await transaction.done;
      } catch (error) {
        return abortAndRethrow(transaction, error);
      }
    },
    async saveWasteWithOutbox(
      waste: LocalWasteRecord,
      items: LocalWasteItemRecord[],
      evidence: LocalWasteEvidenceRecord[],
      files: FileCacheRecord[],
      outbox: OutboxRecord,
    ) {
      const transaction = db.transaction([
        'localWastes', 'localWasteItems', 'localWasteEvidence', 'fileCache', 'outboxOperations',
      ], 'readwrite');
      try {
        await transaction.objectStore('localWastes').put(waste);
        for (const item of items) await transaction.objectStore('localWasteItems').put(item);
        for (const item of evidence) await transaction.objectStore('localWasteEvidence').put(item);
        for (const file of files) await transaction.objectStore('fileCache').put(file);
        await transaction.objectStore('outboxOperations').add(outbox);
        await transaction.done;
      } catch (error) {
        return abortAndRethrow(transaction, error);
      }
    },
    async saveReturnWithOutbox(
      item: LocalReturnRecord,
      items: LocalReturnItemRecord[],
      outbox: OutboxRecord,
    ) {
      const transaction = db.transaction(['localReturns', 'localReturnItems', 'outboxOperations'], 'readwrite');
      try {
        await transaction.objectStore('localReturns').put(item);
        for (const detail of items) await transaction.objectStore('localReturnItems').put(detail);
        await transaction.objectStore('outboxOperations').add(outbox);
        await transaction.done;
      } catch (error) {
        return abortAndRethrow(transaction, error);
      }
    },
  };

  return {
    appMetadata: new MobileRepository(db, 'appMetadata'), userContext: new MobileRepository(db, 'userContext'),
    companyConfiguration: new MobileRepository(db, 'companyConfiguration'), routePackages: new MobileRepository(db, 'routePackages'),
    customers: new MobileRepository(db, 'customers'), products: new MobileRepository(db, 'products'),
    presentations: new MobileRepository(db, 'presentations'), priceVersions: new MobileRepository(db, 'priceVersions'),
    priceTiers: new MobileRepository(db, 'priceTiers'), specialPrices: new MobileRepository(db, 'specialPrices'),
    routeLoads: new MobileRepository(db, 'routeLoads'), routeLoadItems: new MobileRepository(db, 'routeLoadItems'),
    routeInventory: new MobileRepository(db, 'routeInventory'), provisionalCustomers: new MobileRepository(db, 'provisionalCustomers'),
    localSales: new MobileRepository(db, 'localSales'), localSaleItems: new MobileRepository(db, 'localSaleItems'),
    localPayments: new MobileRepository(db, 'localPayments'), localWastes: new MobileRepository(db, 'localWastes'),
    localWasteItems: new MobileRepository(db, 'localWasteItems'), localWasteEvidence: new MobileRepository(db, 'localWasteEvidence'),
    localReturns: new MobileRepository(db, 'localReturns'), localReturnItems: new MobileRepository(db, 'localReturnItems'),
    outboxOperations: new MobileRepository(db, 'outboxOperations'), syncResults: new MobileRepository(db, 'syncResults'),
    fileCache: new MobileRepository(db, 'fileCache'), receiptCache: new MobileRepository(db, 'receiptCache'), localOperations,
  };
}

export async function replaceRoutePackage(db: MobileDatabase, routePackage: RoutePackage) {
  const names = ['appMetadata', 'userContext', 'companyConfiguration', 'routePackages', 'customers', 'products', 'presentations', 'priceVersions', 'priceTiers', 'specialPrices', 'routeLoads', 'routeLoadItems', 'routeInventory'] as const;
  const transaction = db.transaction([...names], 'readwrite');
  for (const name of names) await transaction.objectStore(name).clear();
  await transaction.objectStore('appMetadata').put(routePackage.metadata);
  await transaction.objectStore('userContext').put(routePackage.userContext);
  await transaction.objectStore('companyConfiguration').put(routePackage.companyConfiguration);
  await transaction.objectStore('routePackages').put(routePackage.routePackage);
  for (const value of routePackage.customers) await transaction.objectStore('customers').put(value);
  for (const value of routePackage.products) await transaction.objectStore('products').put(value);
  for (const value of routePackage.presentations) await transaction.objectStore('presentations').put(value);
  for (const value of routePackage.priceVersions) await transaction.objectStore('priceVersions').put(value);
  for (const value of routePackage.priceTiers) await transaction.objectStore('priceTiers').put(value);
  for (const value of routePackage.specialPrices) await transaction.objectStore('specialPrices').put(value);
  for (const value of routePackage.routeLoads) await transaction.objectStore('routeLoads').put(value);
  for (const value of routePackage.routeLoadItems) await transaction.objectStore('routeLoadItems').put(value);
  for (const value of routePackage.routeInventory) await transaction.objectStore('routeInventory').put(value);
  await transaction.done;
}
