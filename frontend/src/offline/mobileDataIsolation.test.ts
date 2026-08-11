import { deleteDB } from 'idb';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearMobileData,
  createMobileRepositories,
  openMobileDatabase,
  prepareMobileDataForSession,
} from './mobileDatabase';

const openedDatabases: string[] = [];

function databaseName(label: string) {
  const name = `agua-pura-isolation-${label}-${crypto.randomUUID()}`;
  openedDatabases.push(name);
  return name;
}

afterEach(async () => {
  await Promise.all(openedDatabases.splice(0).map((name) => deleteDB(name)));
});

describe('aislamiento de datos moviles', () => {
  it('elimina todos los datos al cerrar sesion', async () => {
    const db = await openMobileDatabase(databaseName('clear-session'));
    const repositories = createMobileRepositories(db);
    await repositories.customers.put(customer());

    await clearMobileData(db);

    expect(await repositories.customers.getAll()).toEqual([]);
    db.close();
  });

  it('limpia la informacion cuando cambia el usuario o dispositivo', async () => {
    const db = await openMobileDatabase(databaseName('identity-boundary'));
    const repositories = createMobileRepositories(db);
    await prepareMobileDataForSession('user-1', 'device-1', db);
    await repositories.customers.put(customer());

    await prepareMobileDataForSession('user-2', 'device-2', db);

    expect(await repositories.customers.getAll()).toEqual([]);
    db.close();
  });
});

function customer() {
  return {
    id: 'customer-private', routeRunId: 'route-1', code: 'C-PRIVATE', name: 'Privado',
    normalizedPhone: '55550101', customerType: 'PERMANENT', status: 'ACTIVE',
    creditAllowed: false, creditAvailable: '0.00', cachedAt: new Date().toISOString(),
  };
}
