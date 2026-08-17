# Registro de puntos de ruta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar de forma atómica el punto de inicio de cada ruta y el punto de cada venta confirmada, además de corregir el estado de conectividad del frontend.

**Architecture:** Un contrato validado de ubicación viajará desde React al backend Spring Boot existente y un adaptador JDBC persistirá los eventos en `route_tracking_point`. La recepción de carga inicial y la creación de venta invocarán el puerto de tracking dentro de sus transacciones actuales; las recargas no crearán inicios. El cliente capturará GPS bajo demanda y conservará el objeto `location` en cualquier payload offline existente.

**Tech Stack:** React 19 + TypeScript + Vitest + Testing Library; Spring Boot 4 + Java 21 + Bean Validation + JdbcClient + Flyway + PostgreSQL; Docker Compose.

## Global Constraints

- Registrar solamente dos eventos: `START` al recibir la carga inicial y `SALE` al confirmar una venta.
- No usar GPS continuo, ubicación en segundo plano, mapas ni coordenadas visibles para el vendedor.
- Latitud y longitud deben respetar sus rangos geográficos; la precisión puede ser nula, pero nunca negativa.
- Una operación sin ubicación válida no se confirma.
- La venta y su punto, y la recepción y su punto, deben persistirse en la misma transacción.
- No instalar librerías nuevas ni cambiar las rutas existentes; solo se agregan los cuerpos validados de ubicación a recepción y venta.
- Mantener los contratos de sesión, autorización, sincronización y comprobantes existentes.

---

### Task 1: Contrato de ubicación y tabla de tracking

**Files:**
- Create: `backend/src/main/java/gt/com/aguapura/application/dto/location/GeoLocationRequest.java`
- Create: `backend/src/main/java/gt/com/aguapura/application/ports/RouteTrackingPort.java`
- Create: `backend/src/main/java/gt/com/aguapura/infrastructure/database/adapters/JdbcRouteTrackingAdapter.java`
- Create: `backend/src/main/resources/db/migration/V20__route_tracking_points.sql`
- Test: `backend/src/test/java/gt/com/aguapura/application/dto/location/GeoLocationRequestTest.java`

**Interfaces:**
- `GeoLocationRequest(BigDecimal latitude, BigDecimal longitude, BigDecimal accuracyMeters, Instant capturedAt)` is a Bean Validation DTO with `@NotNull` latitude/longitude/capturedAt, decimal bounds `-90..90` and `-180..180`, and optional non-negative accuracy.
- `RouteTrackingPort` exposes `recordStart(UUID routeLoadId, UUID routeId, GeoLocation point, UUID actorId, UUID deviceId)` and `recordSale(UUID routeLoadId, UUID routeId, UUID saleId, GeoLocation point, UUID actorId, UUID deviceId)`; `GeoLocation` is a port record carrying the four location values.
- `JdbcRouteTrackingAdapter` inserts immutable rows into `route_tracking_point` using the current transaction.

- [ ] **Step 1: Write the failing validation test**

  Add tests that validate a normal point, reject latitude `91`, reject longitude `-181`, and reject negative accuracy. Use `jakarta.validation.Validation.buildDefaultValidatorFactory()` and assert the property paths.

- [ ] **Step 2: Run the DTO test to verify it fails**

  Run `mvn -f backend/pom.xml -Dtest=GeoLocationRequestTest test`.
  Expected: compilation/test failure because the DTO does not exist.

- [ ] **Step 3: Implement the DTO, port, adapter, and migration**

  Create the validated record and port. Create `route_tracking_point` with UUID primary key, `route_load_id` and `route_id` FKs, nullable `sale_id` FK, `point_type` check (`START|SALE`), numeric coordinate checks, `accuracy_meters`, `captured_at`, `persisted_at default now()`, actor/device FKs, a partial unique index for one `START` per route, a partial unique index for one point per sale, and indexes on `(route_id, captured_at)` and `(route_load_id, captured_at)`. Add a check requiring `sale_id IS NULL` for `START` and non-null for `SALE`.

- [ ] **Step 4: Run the DTO test to verify it passes**

  Run `mvn -f backend/pom.xml -Dtest=GeoLocationRequestTest test`.
  Expected: all location validation cases pass.

- [ ] **Step 5: Commit the bounded data-layer change**

  Run `git add backend/src/main/java/gt/com/aguapura/application/dto/location backend/src/main/java/gt/com/aguapura/application/ports/RouteTrackingPort.java backend/src/main/java/gt/com/aguapura/infrastructure/database/adapters/JdbcRouteTrackingAdapter.java backend/src/main/resources/db/migration/V20__route_tracking_points.sql backend/src/test/java/gt/com/aguapura/application/dto/location/GeoLocationRequestTest.java` and commit with `feat: add route tracking point persistence`.

### Task 2: Capture the route-start point during load receipt

**Files:**
- Create: `backend/src/main/java/gt/com/aguapura/application/dto/loading/ConfirmRouteLoadReceiptRequest.java`
- Modify: `backend/src/main/java/gt/com/aguapura/application/services/RouteLoadApplicationService.java`
- Modify: `backend/src/main/java/gt/com/aguapura/presentation/controllers/RouteLoadController.java`
- Modify: `frontend/e2e/full-operational-flow.spec.ts`
- Test: `backend/src/test/java/gt/com/aguapura/application/services/RouteLoadApplicationServiceTest.java`

**Interfaces:**
- `ConfirmRouteLoadReceiptRequest` contains `@NotNull @Valid GeoLocationRequest location`.
- Controller endpoint remains `POST /api/loads/{id}/receipt`, now accepting the request body.
- Service signature becomes `confirmReceipt(UUID id, ConfirmRouteLoadReceiptRequest request, UUID actorId, UUID deviceId, boolean restrictedToSeller)`.

- [ ] **Step 1: Write failing service tests**

  Add a Mockito-based service test with a `WAREHOUSE_CONFIRMED` initial load fixture and assert `tracking.recordStart(...)` receives the load/route IDs, actor/device IDs, and converted location after the transition. Add a replenishment fixture and assert no `recordStart` call is made.

- [ ] **Step 2: Run the service test to verify it fails**

  Run `mvn -f backend/pom.xml -Dtest=RouteLoadApplicationServiceTest test`.
  Expected: compilation failure because the request type and tracking dependency are absent.

- [ ] **Step 3: Implement receipt DTO/controller/service wiring**

  Inject `RouteTrackingPort` into `RouteLoadApplicationService`, convert `GeoLocationRequest` into `RouteTrackingPort.GeoLocation`, and call `recordStart` only when `load.loadType()` is `INITIAL`, after inventory transfer and the `confirmReceipt` persistence call. Keep the call inside the existing `@Transactional` method. Update controller validation and audit call without exposing the location.

- [ ] **Step 4: Update operational E2E payloads**

  In `frontend/e2e/full-operational-flow.spec.ts`, send a deterministic `location` object in the receipt request and assert the response remains `RECEIVED`; no test should inspect a coordinate in the seller UI.

- [ ] **Step 5: Run the service and E2E-focused tests**

  Run `mvn -f backend/pom.xml -Dtest=RouteLoadApplicationServiceTest test` and `npm --prefix frontend test -- src/features/loading/RouteLoadsPage.test.tsx`.
  Expected: service tests pass and existing load UI tests remain green after the endpoint body change.

- [ ] **Step 6: Commit**

  Commit with `feat: record route start location on receipt`.

### Task 3: Capture a point atomically with each confirmed sale

**Files:**
- Modify: `backend/src/main/java/gt/com/aguapura/application/dto/sales/CreateSaleRequest.java`
- Modify: `backend/src/main/java/gt/com/aguapura/application/ports/SalesPort.java`
- Modify: `backend/src/main/java/gt/com/aguapura/application/services/SalesApplicationService.java`
- Modify: `backend/src/main/java/gt/com/aguapura/infrastructure/database/adapters/JdbcSalesAdapter.java`
- Test: `backend/src/test/java/gt/com/aguapura/application/services/SalesApplicationServiceTest.java`
- Test: `backend/src/test/java/gt/com/aguapura/application/services/OfflineSaleSyncHandlerTest.java`

**Interfaces:**
- `CreateSaleRequest` gains `@NotNull @Valid GeoLocationRequest location`.
- `SalesPort.SaleContext` gains `UUID routeLoadId`, selected from the active `STARTED` load for the route.
- The tracking call is `recordSale(routeLoadId, request.routeId(), saleId, location, actorId, deviceId)`.

- [ ] **Step 1: Write failing sale tests**

  Add a service test that creates a valid sale fixture and verifies `recordSale` is called with the generated sale ID and location. Add a missing/out-of-range location validation test. Add a sync-handler test whose JSON payload includes `location` and verifies the service receives it unchanged.

- [ ] **Step 2: Run the tests to verify they fail**

  Run `mvn -f backend/pom.xml -Dtest=SalesApplicationServiceTest,OfflineSaleSyncHandlerTest test`.
  Expected: compilation or assertion failures because the request/context do not yet carry location.

- [ ] **Step 3: Implement the sale contract and data flow**

  Add the nested validated location to `CreateSaleRequest`. Extend the sale-context SQL with the active started `route_load.id` and update its mapper. Inject `RouteTrackingPort` into `SalesApplicationService`; call `recordSale` immediately after `createSale` succeeds and before inventory consumption/audit so any tracking failure rolls back the sale transaction. Do not add location fields to `SaleResponse`.

- [ ] **Step 4: Run the focused sale tests**

  Run `mvn -f backend/pom.xml -Dtest=SalesApplicationServiceTest,OfflineSaleSyncHandlerTest test`.
  Expected: all sale and offline payload tests pass.

- [ ] **Step 5: Commit**

  Commit with `feat: persist location for confirmed sales`.

### Task 4: Capture GPS only at receipt and sale confirmation in React

**Files:**
- Create: `frontend/src/services/geolocation.ts`
- Modify: `frontend/src/features/loading/RouteLoadsPage.tsx`
- Modify: `frontend/src/features/sales/SalesPage.tsx`
- Test: `frontend/src/services/geolocation.test.ts`
- Test: `frontend/src/features/loading/RouteLoadsPage.test.tsx`
- Test: `frontend/src/features/sales/SalesPage.test.tsx`

**Interfaces:**
- `captureCurrentLocation(label: string): Promise<{ latitude: number; longitude: number; accuracyMeters: number | null; capturedAt: string }>` resolves from `navigator.geolocation.getCurrentPosition` and rejects with a Spanish actionable error; it never starts a watcher.
- The receipt mutation sends `{ location }` only for `receipt`; warehouse confirmation, route start, corrections, and recargas remain unchanged.
- The sale mutation sends `{ ..., location }` and blocks submission while the one-shot capture is pending.

- [ ] **Step 1: Write failing geolocation and component tests**

  Test a successful one-shot position, a permission denial, a receipt button request body containing `location`, and a sale confirmation request body containing `location`. Assert a denied position leaves the mutation uncalled and renders the actionable error. Use a stub for `navigator.geolocation.getCurrentPosition` rather than a browser watcher.

- [ ] **Step 2: Run the frontend tests to verify they fail**

  Run `npm --prefix frontend test -- src/services/geolocation.test.ts src/features/loading/RouteLoadsPage.test.tsx src/features/sales/SalesPage.test.tsx`.
  Expected: missing helper/body assertions fail.

- [ ] **Step 3: Implement the one-shot geolocation helper and UI wiring**

  Add the helper with `enableHighAccuracy: true`, a bounded timeout, and no `watchPosition`. In `RouteLoadsPage`, capture only before `transition.mutate({ action: 'receipt', body: { location } })`; keep a local error message and pending state. In `SalesPage`, capture before `create.mutate`, include the location in the JSON payload, and keep coordinates out of rendered JSX and sale response types.

- [ ] **Step 4: Preserve the existing offline payload contract**

  Add a reusable `GeoLocationSnapshot` type to `frontend/src/offline/mobileDatabase.ts` and include an optional `location` field in `LocalSaleRecord`. Ensure `SyncEngine.toRequestOperation` passes the outbox payload unchanged; add a regression assertion that a SALE outbox payload containing `location` reaches the transport unchanged. No new background or periodic location capture is introduced.

- [ ] **Step 5: Run frontend focused tests and build**

  Run `npm --prefix frontend test -- src/services/geolocation.test.ts src/features/loading/RouteLoadsPage.test.tsx src/features/sales/SalesPage.test.tsx src/offline/SyncEngine.test.ts` followed by `npm --prefix frontend run build`.
  Expected: all focused tests pass and TypeScript/Vite build exits with code 0.

- [ ] **Step 6: Commit**

  Commit with `feat: capture route event coordinates in frontend`.

### Task 5: Fix stale “Sin conexión” status from successful API responses

**Files:**
- Modify: `frontend/src/features/connectivity/ConnectionManager.ts`
- Modify: `frontend/src/services/apiClient.ts`
- Test: `frontend/src/features/connectivity/ConnectionManager.test.ts`
- Test: `frontend/src/services/apiClient.test.ts`

**Interfaces:**
- Add `REQUEST_SUCCESS` to `ConnectionCheckReason` and listen for `agua-pura:request-success`.
- A response with status `< 500`, including `401`, `400`, and `204`, marks the manager `ONLINE`, clears the retry timer, and resets retry count. Transport errors and `5xx` continue to publish `agua-pura:request-failure`.

- [ ] **Step 1: Write the failing connectivity tests**

  Add a manager test that dispatches `agua-pura:request-success` while the snapshot is `OFFLINE` and expects `ONLINE` with `reason: 'REQUEST_SUCCESS'` and no pending retry. Add an API client test that observes the event for a `401` response before the refresh path and for a normal `204`; retain the existing 5xx failure assertion.

- [ ] **Step 2: Run the tests to verify they fail**

  Run `npm --prefix frontend test -- src/features/connectivity/ConnectionManager.test.ts src/services/apiClient.test.ts`.
  Expected: the new event tests fail because no success event exists.

- [ ] **Step 3: Implement the event bridge**

  Add a `handleRequestSuccess` listener that publishes an `ONLINE` snapshot with the current timestamp and clears retry state. In `fetchWithRefresh`, publish `agua-pura:request-success` for every received response with status below 500, including the initial 401 and the retried response. Leave 5xx/network error behavior unchanged.

- [ ] **Step 4: Run the focused connectivity tests**

  Run `npm --prefix frontend test -- src/features/connectivity/ConnectionManager.test.ts src/services/apiClient.test.ts`.
  Expected: all tests pass without altering token refresh behavior.

- [ ] **Step 5: Commit**

  Commit with `fix: mark connectivity online after backend responses`.

### Task 6: Documentation, migration verification, and full regression

**Files:**
- Modify: `docs/API.md`
- Modify: `docs/MANUAL_TECNICO.md`
- Modify: `docs/MANUAL_USUARIO.md`
- Modify: `docs/ERS_SRS.md`
- Modify: `diagrams/erd/postgresql-erd.mmd`
- Modify: `diagrams/erd/mobile-indexeddb-erd.mmd`
- Modify: `frontend/e2e/full-operational-flow.spec.ts`

- [ ] **Step 1: Document the operator behavior**

  Document that “Confirmar recepción” requests one GPS position for the route start, “Confirmar venta” requests one GPS position for that sale, denied permission prevents confirmation, and no continuous tracking occurs. Document the `location` request object and the `route_tracking_point` table without exposing coordinates in receipts.

- [ ] **Step 2: Update ERD and offline schema notes**

  Add `route_tracking_point` and its cardinalities to the PostgreSQL ERD. Add the optional `location` snapshot field to the mobile IndexedDB ERD/notes; do not add a location watcher or background store.

- [ ] **Step 3: Run migration and backend regression**

  Start the official stack with `docker compose up -d --build`, then run `mvn -f backend/pom.xml test` and verify Flyway reports migration `V20` successfully. Query PostgreSQL to confirm the table, both partial unique indexes, and coordinate checks exist.

- [ ] **Step 4: Run frontend regression and E2E**

  Run `npm --prefix frontend test`, `npm --prefix frontend run build`, and `npm --prefix frontend run test:e2e`. Confirm `/api/connectivity` returns `200`, the UI badge becomes “En línea” after a successful API request, and a test sale/load creates exactly one corresponding tracking point.

- [ ] **Step 5: Regenerate manuals if their source workflow requires it and inspect the Git diff**

  Run the existing manual verification script, inspect that no coordinates were added to user-facing receipt/report templates, and review `git diff --check` plus `git status --short` before the final report.

- [ ] **Step 6: Commit documentation and verification updates**

  Commit with `docs: document route event location capture`.
