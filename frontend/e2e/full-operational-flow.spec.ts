import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';
import crypto from 'node:crypto';

type Auth = { accessToken: string; user: { id: string; deviceId: string; mustChangePassword: boolean } };
type Json = Record<string, any>;

const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'E2E-Admin-Password-2026!';
const sellerTemporaryPassword = 'E2E-Seller-Temp-2026!';
const sellerPassword = 'E2E-Seller-Final-2026!';

async function body<T>(response: APIResponse, label: string): Promise<T> {
  if (!response.ok()) throw new Error(`${label}: HTTP ${response.status()} ${await response.text()}`);
  return response.json() as Promise<T>;
}

async function login(request: APIRequestContext, username: string, password: string, deviceName: string): Promise<Auth> {
  return body<Auth>(await request.post('/api/auth/login', {
    data: { username, password, deviceName, appVersion: 'e2e-1.0' },
  }), `login ${username}`);
}

function authorized(token: string, data?: unknown) {
  return { headers: { Authorization: `Bearer ${token}` }, ...(data === undefined ? {} : { data }) };
}

test('flujo completo 1-28, offline, idempotencia, antifraude, PDF y FEL', async ({ request, page, context }) => {
  test.setTimeout(180_000);
  const suffix = Date.now().toString().slice(-7);

  // 1. Administrador inicia sesion y configura una sola identidad empresarial.
  const admin = await login(request, 'admin', adminPassword, `Admin E2E ${suffix}`);
  expect(admin.user.mustChangePassword).toBe(false);
  const company = await body<Json>(await request.put('/api/company-configuration', authorized(admin.accessToken, {
    commercialName: `Agua E2E ${suffix}`, legalName: `Purificadora E2E ${suffix}, S.A.`, taxId: `E2E-${suffix}`,
    address: 'Ciudad de Guatemala, Guatemala', phone: '55550101', whatsapp: '55550101',
    email: `e2e-${suffix}@example.invalid`, currencyCode: 'GTQ', timezone: 'America/Guatemala',
    receiptPrefix: 'E2E', nextReceiptNumber: 1, documentLegend: 'Comprobante interno no certificado como DTE',
  })), 'configurar empresa');

  // 2-4. Producto, presentacion y precio vigente.
  const product = await body<Json>(await request.post('/api/products', authorized(admin.accessToken, {
    code: `AGUA-${suffix}`, name: 'Agua pura E2E', description: 'Producto de aceptacion', baseUnitCode: 'BOTELLA',
    controlsInventory: true, presentations: [{ code: `BOT-${suffix}`, name: 'Botella', unitCode: 'BOTELLA', conversionFactor: 1 }],
  })), 'crear producto');
  const presentationId = product.presentations[0].id as string;
  const priceList = await body<Json>(await request.post('/api/pricing/lists', authorized(admin.accessToken, {
    code: `L-${suffix}`, name: 'Lista E2E', currencyCode: 'GTQ',
  })), 'crear lista');
  const versioned = await body<Json>(await request.post(`/api/pricing/lists/${priceList.id}/versions`, authorized(admin.accessToken, {
    validFrom: new Date(Date.now() - 60_000).toISOString(),
    tiers: [{ presentationId, minimumBaseUnits: 1, maximumBaseUnits: null, unitPrice: 2.5 }],
  })), 'crear version de precio');
  const priceVersionId = versioned.versions.at(-1).id as string;
  await body(await request.post(`/api/pricing/versions/${priceVersionId}/activate`, authorized(admin.accessToken)), 'activar precio');

  // 5-7. Vendedor, ruta, vehiculo, cliente y asignaciones historicas.
  const sellerUser = await body<Json>(await request.post('/api/administration/users', authorized(admin.accessToken, {
    username: `seller-${suffix}`, email: `seller-${suffix}@example.invalid`, password: sellerTemporaryPassword,
    roles: ['VENDEDOR'], sellerCode: `V-${suffix}`, sellerDisplayName: `Vendedor E2E ${suffix}`,
  })), 'crear vendedor');
  const route = await body<Json>(await request.post('/api/routes', authorized(admin.accessToken, {
    code: `R-${suffix}`, name: `Ruta E2E ${suffix}`, description: 'Ruta de aceptacion',
  })), 'crear ruta');
  const vehicle = await body<Json>(await request.post('/api/routes/vehicles', authorized(admin.accessToken, {
    code: `VH-${suffix}`, licensePlate: `P${suffix.slice(-5)}`, description: 'Vehiculo E2E',
  })), 'crear vehiculo');
  await body(await request.post(`/api/routes/${route.id}/assignment`, authorized(admin.accessToken, {
    sellerId: sellerUser.sellerId, vehicleId: vehicle.id, validFrom: new Date().toISOString().slice(0, 10),
  })), 'asignar ruta');
  const customer = await body<Json>(await request.post('/api/customers', authorized(admin.accessToken, {
    code: `C-${suffix}`, name: `Cliente E2E ${suffix}`, contactName: 'Encargado', phone: `55${suffix}`,
    whatsapp: `55${suffix}`, addressReference: 'Tienda de prueba', customerType: 'PERMANENT',
    creditAllowed: false, creditLimit: 0,
  })), 'crear cliente');
  await body(await request.post(`/api/customers/${customer.id}/route-assignment`, authorized(admin.accessToken, {
    routeId: route.id, validFrom: new Date().toISOString().slice(0, 10),
  })), 'asignar cliente');

  // 8. Bodega, inventario y carga de 100 unidades.
  const warehouse = await body<Json>(await request.post('/api/inventory/locations', authorized(admin.accessToken, {
    code: `B-${suffix}`, name: 'Bodega E2E', locationType: 'WAREHOUSE', routeId: null,
  })), 'crear bodega');
  await body(await request.post('/api/inventory/locations', authorized(admin.accessToken, {
    code: `IR-${suffix}`, name: 'Inventario ruta E2E', locationType: 'ROUTE', routeId: route.id,
  })), 'crear inventario de ruta');
  await body(await request.post('/api/inventory/adjustments', authorized(admin.accessToken, {
    locationId: warehouse.id, productId: product.id, quantityDelta: 100, reason: 'Existencia inicial E2E',
  })), 'ajustar existencia');
  const load = await body<Json>(await request.post('/api/loads', authorized(admin.accessToken, {
    routeId: route.id, sourceLocationId: warehouse.id, plannedDate: new Date().toISOString().slice(0, 10),
    notes: 'Carga E2E', items: [{ productId: product.id, quantityBaseUnits: 100 }],
  })), 'crear carga');
  await body(await request.post(`/api/loads/${load.id}/warehouse-confirmation`, authorized(admin.accessToken)), 'confirmar bodega');

  // 9-10. El vendedor cambia su clave temporal, recibe la carga e inicia ruta.
  const temporarySeller = await login(request, `seller-${suffix}`, sellerTemporaryPassword, `Telefono E2E ${suffix}`);
  expect(temporarySeller.user.mustChangePassword).toBe(true);
  const changed = await request.post('/api/auth/change-password', authorized(temporarySeller.accessToken, {
    currentPassword: sellerTemporaryPassword, newPassword: sellerPassword,
  }));
  expect(changed.status()).toBe(204);
  const seller = await login(request, `seller-${suffix}`, sellerPassword, `Telefono E2E ${suffix}`);
  await body(await request.post(`/api/loads/${load.id}/receipt`, authorized(seller.accessToken)), 'recibir carga');
  await body(await request.post(`/api/loads/${load.id}/start`, authorized(seller.accessToken)), 'iniciar ruta');

  // 11. Venta online.
  const onlineSale = await body<Json>(await request.post('/api/sales', authorized(seller.accessToken, {
    clientReference: crypto.randomUUID(), routeId: route.id, customerId: customer.id,
    items: [{ presentationId, quantity: 10 }], payments: [{ method: 'CASH', amount: null }],
  })), 'venta online');
  expect(Number(onlineSale.total)).toBe(25);
  expect(onlineSale.companyName).toBe(company.commercialName);

  // 12-18. Se preparan datos offline y se comprueba persistencia tras reabrir la PWA.
  await page.goto('/');
  await page.getByLabel('Usuario').fill(`seller-${suffix}`);
  await page.getByLabel('Contraseña').fill(sellerPassword);
  await page.getByLabel('Nombre del dispositivo').fill(`Telefono E2E ${suffix}`);
  const browserLoginPromise = page.waitForResponse(response => response.url().endsWith('/api/auth/login')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  const browserLogin = await browserLoginPromise;
  if (!browserLogin.ok()) throw new Error(`login navegador: HTTP ${browserLogin.status()} ${await browserLogin.text()}`);
  await expect(page.getByRole('heading', { name: 'Panel operativo' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const open = indexedDB.open('agua-pura-mobile', 2);
    const db = await new Promise<IDBDatabase>((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
    const tx = db.transaction('appMetadata', 'readwrite');
    tx.objectStore('appMetadata').put({ key: 'e2e-offline-marker', value: 'persisted', updatedAt: new Date().toISOString() });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  });
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.getByRole('button', { name: 'Sin conexión' })).toBeVisible();
  await page.reload();
  const persisted = await page.evaluate(async () => {
    const open = indexedDB.open('agua-pura-mobile', 2);
    const db = await new Promise<IDBDatabase>((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
    const tx = db.transaction('appMetadata', 'readonly');
    const get = tx.objectStore('appMetadata').get('e2e-offline-marker');
    const value = await new Promise<any>((resolve, reject) => { get.onsuccess = () => resolve(get.result?.value); get.onerror = () => reject(get.error); });
    db.close();
    return value;
  });
  expect(persisted).toBe('persisted');
  await context.setOffline(false);

  // 13-16 y 19-21. Cliente, venta y merma offline sincronizados cinco veces sin duplicarse.
  const wasteType = await body<Json>(await request.post('/api/wastes/types', authorized(admin.accessToken, {
    code: `ROT-${suffix}`, name: 'Rotura E2E', evidencePolicy: 'NONE', warehouseApprovalLimitBaseUnits: 100,
    supervisorApprovalLimitBaseUnits: 100, dailyAlertThreshold: 20, active: true,
  })), 'crear tipo de merma');
  const provisionalId = crypto.randomUUID();
  const provisionalOperation = crypto.randomUUID();
  const offlineSaleId = crypto.randomUUID();
  const offlineSaleOperation = crypto.randomUUID();
  const wasteId = crypto.randomUUID();
  const wasteOperation = crypto.randomUUID();
  const createdAtLocal = new Date().toISOString();
  const operations = [
    { clientOperationId: provisionalOperation, deviceId: seller.user.deviceId, entityType: 'PROVISIONAL_CUSTOMER', operationType: 'CREATE', aggregateLocalId: provisionalId,
      payload: { localCustomerId: provisionalId, routeId: route.id, name: `Cliente provisional ${suffix}`, phone: `44${suffix}`, whatsapp: '', addressReference: 'Creado sin Internet' }, dependencies: [], createdAtLocal },
    { clientOperationId: offlineSaleOperation, deviceId: seller.user.deviceId, entityType: 'SALE', operationType: 'CREATE', aggregateLocalId: offlineSaleId,
      payload: { clientReference: offlineSaleId, routeId: route.id, customerId: provisionalId, items: [{ presentationId, quantity: 5 }], payments: [{ method: 'CASH', amount: null }] }, dependencies: [provisionalOperation], createdAtLocal },
    { clientOperationId: wasteOperation, deviceId: seller.user.deviceId, entityType: 'WASTE', operationType: 'CREATE', aggregateLocalId: wasteId,
      payload: { clientReference: wasteId, routeId: route.id, reason: 'Rotura durante reparto', occurredAtLocal: createdAtLocal,
        items: [{ wasteTypeId: wasteType.id, presentationId, presentationQuantity: 2, reportedDamagedUnits: 2, recoverableUnits: 0 }], evidence: [] }, dependencies: [], createdAtLocal },
  ];
  const firstSync = await body<Json[]>(await request.post('/api/sync/batch', authorized(seller.accessToken, { operations })), 'sincronizar offline');
  expect(firstSync.map(item => item.status)).toEqual(['ACCEPTED', 'ACCEPTED', 'ACCEPTED']);
  for (let replay = 0; replay < 4; replay += 1) {
    const repeated = await body<Json[]>(await request.post('/api/sync/batch', authorized(seller.accessToken, { operations })), 'repetir sincronizacion');
    expect(repeated.every(item => item.status === 'ALREADY_PROCESSED')).toBe(true);
  }

  // 22-24. Revision humana del cliente/merma y devolucion fisica separada.
  const reviews = await body<Json[]>(await request.get('/api/customers/provisional-reviews', authorized(admin.accessToken)), 'listar provisionales');
  expect(reviews.some(item => item.customer.id === provisionalId)).toBe(true);
  await body(await request.post(`/api/customers/${provisionalId}/registration-decision`, authorized(admin.accessToken, {
    decision: 'APPROVED', targetCustomerId: null, reason: 'Identidad validada E2E',
  })), 'aprobar provisional');
  const wastes = await body<Json[]>(await request.get('/api/wastes', authorized(admin.accessToken)), 'listar mermas');
  const waste = wastes.find(item => item.clientReference === wasteId);
  expect(waste).toBeTruthy();
  await body(await request.post(`/api/wastes/${waste.id}/reviews`, authorized(admin.accessToken, {
    decision: 'APPROVE', items: waste.items.map((item: Json) => ({ itemId: item.id, approvedBaseUnits: 2 })), notes: 'Conteo E2E',
  })), 'aprobar merma');
  const returned = await body<Json>(await request.post('/api/returns', authorized(seller.accessToken, {
    clientReference: crypto.randomUUID(), returnType: 'UNSOLD_GOOD', routeId: route.id, customerId: null,
    saleId: null, reason: 'Producto no vendido', reportedAtLocal: new Date().toISOString(),
    items: [{ presentationId, presentationQuantity: 83 }],
  })), 'registrar devolucion');
  await body(await request.post(`/api/returns/${returned.id}/receipt`, authorized(admin.accessToken, {
    warehouseLocationId: warehouse.id, items: returned.items.map((item: Json) => ({ itemId: item.id, receivedBaseUnits: 83 })), notes: 'Recibido completo',
  })), 'recibir devolucion');

  // 25-26. Liquidacion sin diferencias fisicas y con entrega monetaria exacta.
  const calculated = await body<Json>(await request.post(`/api/settlements/${load.id}/calculate`, authorized(admin.accessToken, {
    pendingLocalOperations: 0,
  })), 'calcular liquidacion');
  expect(Number(calculated.physicalDifferenceTotal)).toBe(0);
  expect(Number(calculated.expectedCash)).toBe(37.5);
  await body(await request.post(`/api/settlements/${load.id}/cash-deliveries`, authorized(admin.accessToken, {
    amount: 37.5, notes: 'Entrega exacta E2E',
  })), 'entregar efectivo');
  const closed = await body<Json>(await request.post(`/api/settlements/${load.id}/close`, authorized(admin.accessToken, {
    pendingLocalOperations: 0, notes: 'Liquidacion E2E sin diferencias',
  })), 'cerrar liquidacion');
  expect(closed.status).toBe('CLOSED');
  expect(Number(closed.monetaryDifference)).toBe(0);

  // 27. PDF interno usa la misma empresa y nunca se presenta como DTE certificado.
  const receipt = await request.get(`/api/sales/${onlineSale.id}/receipt`, authorized(seller.accessToken));
  expect(receipt.ok()).toBe(true);
  expect(receipt.headers()['content-type']).toContain('application/pdf');
  expect(receipt.headers()['x-document-type']).toBe('INTERNAL_RECEIPT');
  expect((await receipt.body()).subarray(0, 4).toString()).toBe('%PDF');

  // FEL no se activa sin adaptador real ni credenciales.
  const fel = await body<Json>(await request.get('/api/fel-configuration', authorized(admin.accessToken)), 'leer FEL');
  const felAttempt = await request.put('/api/fel-configuration', authorized(admin.accessToken, {
    enabled: true, providerCode: 'NO-INSTALADO', environment: 'TEST', establishmentCode: '1', version: fel.version,
  }));
  expect(felAttempt.status()).toBe(409);
  expect((await felAttempt.json()).code).toBe('FEL_PROVIDER_UNAVAILABLE');

  // 28. La interfaz ofrece compartir el comprobante mediante Web Share.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Panel operativo' })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { (window as any).__sharedReceipt = true; } });
  });
  await page.locator('aside').getByRole('link', { name: 'Ventas' }).click();
  await expect(page.getByText(onlineSale.documentNumber)).toBeVisible();
  await page.getByRole('button', { name: 'Compartir / WhatsApp' }).first().click();
  await expect(page.getByText(/Comprobante compartido/i)).toBeVisible();
  expect(await page.evaluate(() => (window as any).__sharedReceipt)).toBe(true);

  const companyAfter = await body<Json>(await request.get('/api/company-configuration', authorized(admin.accessToken)), 'releer empresa');
  expect(companyAfter.id).toBe(company.id);
});

test('despliegue anonimo aplica cabeceras, limite JSON y rate limit', async ({ request, page }) => {
  const home = await request.get('/');
  expect(home.ok()).toBe(true);
  expect(home.headers()['x-content-type-options']).toBe('nosniff');
  expect(home.headers()['x-frame-options']).toBe('DENY');
  expect(home.headers()['content-security-policy']).toContain("frame-ancestors 'none'");

  await page.goto('/');
  const oversizedStatus = await page.evaluate(async () => (await fetch('/api/sales', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: 'x'.repeat(2_097_153) }),
  })).status);
  expect(oversizedStatus).toBe(413);

  const statuses: number[] = [];
  for (let attempt = 0; attempt < 16; attempt += 1) {
    statuses.push((await request.post('/api/auth/login', {
      data: { username: 'missing-e2e-user', password: 'Invalid-E2E-Password!', deviceName: 'rate-e2e', appVersion: 'e2e' },
    })).status());
  }
  expect(statuses).toContain(429);
});
