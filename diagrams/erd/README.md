# Modelos de datos

Esta carpeta contiene los dos modelos obligatorios del sistema:

- `postgresql-erd.mmd`: ERD físico/lógico de la base oficial del backend.
- `mobile-indexeddb-erd.mmd`: ERD lógico de los object stores utilizados por la PWA.

## PostgreSQL

PostgreSQL es la fuente oficial y autoritativa. El diagrama incluye entidades, claves primarias, claves foráneas, cardinalidades y campos que determinan integridad. Durante la implementación, Flyway será la fuente ejecutable del esquema; cualquier migración deberá actualizar el ERD en la misma fase.

## IndexedDB móvil

IndexedDB no es una base relacional y no aplica claves foráneas. El diagrama usa relaciones visuales para indicar referencias lógicas por UUID o clave local. La integridad de esas referencias se implementará en la capa de almacenamiento y el Sync Engine.

### Object stores e índices mínimos

| Object store | keyPath | Índices mínimos | Origen |
|---|---|---|---|
| `appMetadata` | `key` | ninguno | local/sistema |
| `userContext` | `userId` | `deviceId` | servidor |
| `companyConfiguration` | `id` | `serverVersion` | servidor |
| `routePackages` | `routeRunId` | `sellerId`, `status`, `businessDate` | servidor |
| `customers` | `id` | `routeRunId`, `normalizedPhone`, `status` | servidor |
| `provisionalCustomers` | `localCustomerId` | `routeRunId`, `normalizedPhone`, `syncStatus`, `serverCustomerId` | local |
| `products` | `id` | `code`, `active` | servidor |
| `presentations` | `id` | `productId`, `code`, `active` | servidor |
| `priceVersions` | `id` | `priceListId`, `status`, `validFrom`, `validTo` | servidor |
| `priceTiers` | `id` | `priceVersionId`, `presentationId` | servidor |
| `specialPrices` | `id` | `customerId`, `presentationId`, `status` | servidor |
| `routeLoads` | `id` | `routeRunId`, `status` | servidor |
| `routeLoadItems` | `id` | `routeLoadId`, `presentationId` | servidor |
| `routeInventory` | `inventoryKey` | `[routeRunId, productId]`, `productId` | servidor/local derivado |
| `localSales` | `localSaleId` | `clientOperationId`, `routeRunId`, `customerId`, `provisionalCustomerId`, `syncStatus` | local |
| `localSaleItems` | `id` | `localSaleId`, `presentationId` | local |
| `localPayments` | `localPaymentId` | `clientOperationId`, `localSaleId`, `syncStatus` | local |
| `localWastes` | `localWasteId` | `clientOperationId`, `routeRunId`, `syncStatus` | local |
| `localWasteItems` | `id` | `localWasteId`, `presentationId` | local |
| `localWasteEvidence` | `id` | `localWasteId`, `syncStatus`, `sha256` | local |
| `localReturns` | `localReturnId` | `clientOperationId`, `routeRunId`, `syncStatus` | local |
| `localReturnItems` | `id` | `localReturnId`, `presentationId` | local |
| `outboxOperations` | `clientOperationId` | `status`, `nextAttemptAt`, `aggregateLocalId`, `[status, nextAttemptAt]` | local |
| `syncResults` | `clientOperationId` | `resultStatus`, `serverEntityId` | servidor/local |
| `fileCache` | `cacheKey` | `purpose`, `sha256`, `expiresAt` | local |
| `receiptCache` | `localSaleId` | `serverSaleId`, `officialNumber`, `status` | servidor/local |

Los nombres anteriores serán los nombres canónicos de object stores. Los nombres `IDB_*` del diagrama son etiquetas visuales equivalentes.

## Transacción local obligatoria

Al confirmar una operación offline, su agregado local, detalles, cambio de inventario local y entrada `outboxOperations` deben guardarse en una sola transacción IndexedDB. Si cualquier escritura falla, ninguna parte queda confirmada.

## Dependencias de sincronización

`outboxOperations.dependencies` contiene UUID de operaciones previas. El orden mínimo es:

```text
CREATE_PROVISIONAL_CUSTOMER
  → CREATE_SALE
    → CREATE_PAYMENT
```

Mermas y devoluciones dependen del recorrido y, cuando corresponda, de venta o archivos locales. El Sync Engine solo envía una operación cuando todas sus dependencias están `SYNCED` o fueron reconocidas como `ALREADY_PROCESSED`.

## Versionado y migraciones

- La versión de IndexedDB aumenta únicamente cuando cambia estructura, keyPath o índices.
- Cada `upgrade` crea o transforma stores de forma determinista.
- Nunca se elimina un store con operaciones no sincronizadas.
- Antes de una migración destructiva se exportan o transforman registros pendientes dentro de la transacción de upgrade.
- Un fallo de migración conserva la versión anterior y muestra recuperación segura.
- Las pruebas abren bases desde cada versión soportada y verifican que Outbox y agregados locales sobrevivan.

## Datos prohibidos en IndexedDB

- Contraseñas.
- Refresh tokens.
- Claves privadas o credenciales FEL.
- Datos administrativos o de otras rutas que el vendedor no necesita.
- Secretos de infraestructura.
