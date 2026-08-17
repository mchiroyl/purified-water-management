# Modelos de datos

Esta carpeta contiene los dos modelos obligatorios del sistema:

- `postgresql-erd.mmd`: ERD físico/lógico de la base oficial del backend.
- `mobile-indexeddb-erd.mmd`: ERD lógico de los object stores utilizados por la PWA.

## PostgreSQL

PostgreSQL es la fuente oficial y autoritativa. El diagrama incluye las 54 tablas creadas por Flyway V1–V18, sus claves primarias, claves foráneas, cardinalidades y los campos que determinan integridad. Flyway es la fuente ejecutable del esquema; cualquier migración nueva debe actualizar el ERD en el mismo cambio.

### Inventario ejecutable por migración

| Migración | Alcance principal |
|---|---|
| V1–V2 | Seguridad, usuarios, empresa única, archivos, FEL y auditoría |
| V3 | Productos, presentaciones, unidades y conversiones |
| V4 | Clientes, rutas, vendedores, vehículos y asignaciones históricas |
| V5 | Listas/versiones de precios, tramos, precios especiales y descuentos |
| V6 | Ubicaciones, saldos y libro inmutable de inventario |
| V7 | Cargas de ruta, detalle y correcciones compensatorias |
| V8–V9 | Ventas, detalles, pagos y cuenta corriente de crédito |
| V10 | Idempotencia de sincronización por dispositivo y operación |
| V11 | Revisión y fusión de clientes provisionales |
| V12 | Mermas, evidencias, revisiones y alertas |
| V13 | Devoluciones y recepción en bodega |
| V14 | Entrega de efectivo y liquidación física/financiera |
| V15 | Autorizaciones e incidencias |
| V16 | Anulación segregada y reversos de pago |
| V17 | Comprobantes internos y bloqueo FEL sin certificador |
| V18 | Ampliación de auditoría correlacionada |

## IndexedDB móvil

IndexedDB no es una base relacional y no aplica claves foráneas. El diagrama usa relaciones visuales para indicar referencias lógicas por UUID o clave local. La integridad de esas referencias está implementada en la capa de almacenamiento y el Sync Engine.

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
| `routeLoads` | `id` | `routeRunId`, `loadType`, `status` | servidor; `INITIAL` o `REPLENISHMENT` |
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

### Implementación vigente

La fuente ejecutable es `frontend/src/offline/mobileDatabase.ts`. La base `agua-pura-mobile` está en versión 2 y crea los 26 object stores canónicos de esta tabla.

- Versión 1: contexto autorizado, configuración empresarial, paquete de ruta, clientes, catálogo, precios, carga e inventario.
- Versión 2: agregados locales, Outbox, resultados de sincronización, archivos y comprobantes.
- Los índices booleanos `active` usan internamente `activeIndex` (`0`/`1`) porque los booleanos no son claves válidas de IndexedDB.
- Los importes y cantidades se conservan como texto decimal para evitar pérdida de precisión binaria.
- La migración v1→v2, la persistencia tras reapertura y el rollback multi-store están cubiertos por pruebas automatizadas.

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
