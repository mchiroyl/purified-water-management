# Mejoras operativas de Agua Pura Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar códigos automáticos, reportes Excel/PDF, recargas de ruta, renovación automática de sesión y manuales actualizados sin perder compatibilidad con los datos actuales.

**Architecture:** Mantener el monolito modular y el libro de inventario existente. Las secuencias y el tipo de carga se agregan mediante Flyway; los casos de uso y adaptadores JDBC conservan la autoridad del servidor. El frontend centraliza refresh/reintento en `apiClient`, reutiliza los filtros actuales para los dos formatos y añade la recarga al flujo de cargas existente.

**Tech Stack:** Java 21, Spring Boot 4.1, PostgreSQL 18.4, Flyway, JDBC, Apache PDFBox 3.0.8, Apache POI OOXML 5.4.1, React 19.2, TypeScript 7, TanStack Query 5, Vitest, JUnit, Testcontainers y Playwright.

## Global Constraints

- Los códigos nuevos serán `CLI-000001`, `VND-000001`, `RUT-000001` y `VEH-000001`; los códigos existentes no se renumeran.
- La placa del vehículo continúa siendo un dato manual distinto del código interno.
- La exportación visible será Excel `.xlsx` y PDF; no se mostrará CSV al usuario.
- Las recargas usan el flujo y libro de inventario de cargas existentes, con estados `PREPARED → WAREHOUSE_CONFIRMED → RECEIVED`.
- Una recarga no inicia un segundo recorrido, no crea una segunda liquidación y no se admite después del cierre de la liquidación de ruta.
- Un `401` debe renovar una sola vez con la cookie HttpOnly, reintentar la solicitud original y cerrar sesión solo cuando el refresh falle.
- No se guardan refresh tokens, contraseñas ni secretos en localStorage o IndexedDB.
- Toda mutación nueva conserva RBAC, alcance por ruta, auditoría, idempotencia e inventario no negativo.
- Cada tarea termina con pruebas enfocadas y una comprobación de regresión antes de continuar.

---

### Task 1: Generación server-side de códigos

**Files:**
- Create: `backend/src/main/resources/db/migration/V19__automatic_codes_and_replenishments.sql`
- Modify: `backend/src/main/java/gt/com/aguapura/application/dto/route/CreateCustomerRequest.java`
- Modify: `backend/src/main/java/gt/com/aguapura/application/dto/route/CreateRouteRequest.java`
- Modify: `backend/src/main/java/gt/com/aguapura/application/dto/route/CreateVehicleRequest.java`
- Modify: `backend/src/main/java/gt/com/aguapura/application/dto/identity/CreateUserRequest.java`
- Modify: `backend/src/main/java/gt/com/aguapura/application/services/CustomerRouteApplicationService.java`
- Modify: `backend/src/main/java/gt/com/aguapura/application/services/IdentityAdministrationApplicationService.java`
- Modify: `backend/src/main/java/gt/com/aguapura/infrastructure/database/adapters/JdbcCustomerRouteAdapter.java`
- Modify: `backend/src/main/java/gt/com/aguapura/infrastructure/database/adapters/JdbcIdentityAdministrationAdapter.java`
- Test: `backend/src/test/java/gt/com/aguapura/application/services/CustomerRouteApplicationServiceTest.java`
- Test: `backend/src/test/java/gt/com/aguapura/application/services/IdentityAdministrationApplicationServiceTest.java`
- Create: `backend/src/test/java/gt/com/aguapura/infrastructure/database/adapters/JdbcCustomerRouteAdapterTest.java`

**Interfaces:**
- `CreateCustomerRequest`, `CreateRouteRequest` y `CreateVehicleRequest` aceptan `code` opcional solo para compatibilidad de clientes antiguos; los servicios no lo usan.
- `CreateUserRequest.sellerCode` pasa a ser opcional y el adaptador genera el código cuando existe el rol `VENDEDOR`.
- Los adaptadores devuelven las respuestas con el código reservado dentro de la transacción de inserción.

- [ ] **Step 1: Write the failing tests**

  Agregar pruebas que envíen códigos omitidos y códigos manuales como `MANUAL-999`, y verifiquen que la respuesta usa el prefijo reservado. Agregar una prueba de dos creaciones consecutivas que devuelva números distintos.

- [ ] **Step 2: Run the focused tests to verify they fail**

  Run: `mvn -q -Dtest=CustomerRouteApplicationServiceTest,IdentityAdministrationApplicationServiceTest test` desde `backend`.
  Expected: FAIL porque los servicios todavía exigen y conservan el código recibido.

- [ ] **Step 3: Add the migration and server generation**

  Crear cuatro secuencias (`customer_code_seq`, `seller_code_seq`, `route_code_seq`, `vehicle_code_seq`) y establecerlas después de cualquier código histórico que ya coincida con el prefijo. Cambiar las validaciones DTO para permitir ausencia de código, generar mediante `nextval` en los adaptadores y mantener los índices `UNIQUE` existentes. El código generado debe usar `format('CLI-%06d', nextval('customer_code_seq'))`, y equivalentes `VND`, `RUT` y `VEH`.

- [ ] **Step 4: Run focused tests and migration tests**

  Run: `mvn -q -Dtest=CustomerRouteApplicationServiceTest,IdentityAdministrationApplicationServiceTest,JdbcCustomerRouteAdapterTest test`.
  Expected: PASS, incluyendo inserciones concurrentes sin duplicar códigos.

- [ ] **Step 5: Commit**

  Run: `git add backend/src/main backend/src/test && git commit -m "feat: generate operational codes automatically"`.

### Task 2: Formularios sin captura manual de códigos

**Files:**
- Modify: `frontend/src/features/routes/CustomersPage.tsx`
- Modify: `frontend/src/features/routes/RoutesPage.tsx`
- Modify: `frontend/src/features/administration/AdministrationPage.tsx`
- Modify: `frontend/src/features/routes/types.ts`
- Test: `frontend/src/features/routes/CustomersPage.test.tsx`
- Test: `frontend/src/features/routes/RoutesPage.test.tsx`
- Test: `frontend/src/features/administration/AdministrationPage.test.tsx`

**Interfaces:**
- Los payloads de creación no incluirán `code` ni `sellerCode`.
- Las respuestas seguirán mostrando el código asignado en tarjetas/listados.

- [ ] **Step 1: Write the failing component tests**

  Verificar que los formularios no renderizan campos “Código” para cliente/ruta/vehículo ni “Código de vendedor”, que muestran “Código asignado automáticamente” y que los payloads enviados no contienen esas propiedades.

- [ ] **Step 2: Run focused frontend tests to verify failure**

  Run: `npm test -- --run src/features/routes/CustomersPage.test.tsx src/features/routes/RoutesPage.test.tsx src/features/administration/AdministrationPage.test.tsx` desde `frontend`.
  Expected: FAIL porque los campos y propiedades todavía existen.

- [ ] **Step 3: Implement the minimal UI change**

  Eliminar campos y estado de código, agregar texto informativo, conservar placa y nombre visible del vendedor, y dejar que la tarjeta de respuesta muestre el código generado.

- [ ] **Step 4: Run focused tests and build**

  Run: `npm test -- --run src/features/routes/CustomersPage.test.tsx src/features/routes/RoutesPage.test.tsx src/features/administration/AdministrationPage.test.tsx` y `npm run build`.
  Expected: PASS y compilación sin TypeScript errors.

- [ ] **Step 5: Commit**

  Run: `git add frontend/src/features && git commit -m "feat: hide manually editable operational codes"`.

### Task 3: Renovación automática de sesión y estado de conectividad

**Files:**
- Modify: `frontend/src/services/apiClient.ts`
- Modify: `frontend/src/features/auth/SessionContext.tsx`
- Modify: `frontend/src/features/connectivity/ConnectionManager.ts`
- Modify: `frontend/src/features/connectivity/ConnectionIndicator.tsx`
- Create: `frontend/src/services/apiClient.test.ts`
- Test: `frontend/src/features/auth/SessionContext.test.tsx`
- Test: `frontend/src/features/connectivity/ConnectionManager.test.ts`
- Test: `frontend/src/features/connectivity/ConnectionIndicator.test.tsx`

**Interfaces:**
- `apiRequest` y `apiFile` usarán un ejecutor común que recibe `retryOnUnauthorized = true` por defecto.
- El ejecutor mantiene `let refreshInFlight: Promise<AuthResponse> | null` para compartir la renovación entre solicitudes concurrentes.
- `SessionProvider` manejará los eventos `agua-pura:session-refreshed` y `agua-pura:session-expired` para actualizar usuario o limpiar sesión.

- [ ] **Step 1: Write the failing 401 tests**

  Agregar pruebas con `fetch` que devuelvan `401`, luego `200` para `/auth/refresh` y finalmente `200` para la solicitud original; verificar un solo refresh y dos respuestas correctas cuando dos solicitudes vencen juntas. Agregar caso donde refresh devuelve `401` y se emite expiración. Agregar prueba de `ConnectionManager` que mantenga conectividad online cuando solo una llamada protegida devuelve `401`.

- [ ] **Step 2: Run focused tests to verify failure**

  Run: `npm test -- --run src/services/apiClient.test.ts src/features/auth/SessionContext.test.tsx src/features/connectivity/ConnectionManager.test.ts src/features/connectivity/ConnectionIndicator.test.tsx`.
  Expected: FAIL porque el cliente actualmente propaga el `401` sin renovar.

- [ ] **Step 3: Implement one-refresh retry**

  Extraer `requestFile`, excluir `/auth/login`, `/auth/refresh` y `/auth/logout` del retry, crear la promesa compartida con `credentials: 'include'`, actualizar `accessToken`, disparar el evento de sesión refrescada y repetir la solicitud una sola vez. En refresh fallido, limpiar token y emitir expiración. No enviar refresh token por JavaScript.

- [ ] **Step 4: Run focused tests and regression suite**

  Run: `npm test -- --run src/services/apiClient.test.ts src/features/auth/SessionContext.test.tsx src/features/connectivity/ConnectionManager.test.ts src/features/connectivity/ConnectionIndicator.test.tsx` y luego `npm test -- --run --pool=threads --maxWorkers=1`.
  Expected: PASS sin errores no controlados.

- [ ] **Step 5: Commit**

  Run: `git add frontend/src/services frontend/src/features/auth frontend/src/features/connectivity && git commit -m "fix: refresh expired access sessions automatically"`.

### Task 4: Exportación de reportes Excel y PDF en backend

**Files:**
- Modify: `backend/pom.xml`
- Create: `backend/src/main/java/gt/com/aguapura/application/ports/ReportDocumentGenerator.java`
- Create: `backend/src/main/java/gt/com/aguapura/infrastructure/documents/ReportDocumentGeneratorAdapter.java`
- Modify: `backend/src/main/java/gt/com/aguapura/application/services/ReportApplicationService.java`
- Modify: `backend/src/main/java/gt/com/aguapura/presentation/controllers/ReportController.java`
- Create: `backend/src/test/java/gt/com/aguapura/infrastructure/documents/ReportDocumentGeneratorAdapterTest.java`
- Create: `backend/src/test/java/gt/com/aguapura/application/services/ReportApplicationServiceTest.java`

**Interfaces:**
- `ReportDocumentGenerator.generateExcel(ReportType, ReportPageResponse<?>, CompanySnapshot)` devuelve `byte[]` con MIME `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- `ReportDocumentGenerator.generatePdf(ReportType, ReportPageResponse<?>, CompanySnapshot, ReportFilterSummary)` devuelve `byte[]` con MIME `application/pdf`.
- `GET /api/reports/{type}.xlsx` y `GET /api/reports/{type}.pdf` reutilizan `ReportApplicationService.Filter` y `EXPORT_LIMIT=20_000`.

- [ ] **Step 1: Add failing generator tests**

  Crear datos de ventas, mermas y liquidaciones en memoria y verificar que el XLSX se abre con `XSSFWorkbook`, contiene encabezados y celdas monetarias, y que el PDF comienza con `%PDF` y contiene nombre de empresa, filtros y encabezado del reporte.

- [ ] **Step 2: Run focused tests to verify failure**

  Run: `mvn -q -Dtest=ReportDocumentGeneratorAdapterTest,ReportApplicationServiceTest test`.
  Expected: FAIL porque no existe el generador ni los endpoints nuevos.

- [ ] **Step 3: Add Apache POI and document generation**

  Añadir `org.apache.poi:poi-ooxml:5.4.1`; crear estilos con encabezado congelado, autofiltro, anchos, fecha y moneda. Implementar PDFBox con A4 horizontal cuando el reporte tenga muchas columnas, datos de empresa y filtros; limitar exportación a 20,000 filas antes de generar.

- [ ] **Step 4: Expose secure endpoints**

  Agregar endpoints `.xlsx` y `.pdf`, `Content-Disposition` con nombre seguro y `X-Content-Type-Options: nosniff`. Mantener `.csv` solo como compatibilidad interna no enlazada por UI durante esta transición.

- [ ] **Step 5: Run focused tests and backend regression**

  Run: `mvn -q -Dtest=ReportDocumentGeneratorAdapterTest,ReportApplicationServiceTest test` y `mvn -q test`.
  Expected: PASS y archivos con contenido válido.

- [ ] **Step 6: Commit**

  Run: `git add backend/pom.xml backend/src/main backend/src/test && git commit -m "feat: export reports as Excel and PDF"`.

### Task 5: Controles de Excel/PDF en la interfaz

**Files:**
- Modify: `frontend/src/features/reports/ReportsPage.tsx`
- Modify: `frontend/src/features/reports/ReportsPage.test.tsx`
- Modify: `frontend/src/services/apiClient.ts` (solo si el helper de descarga requiere nombre MIME)
- Modify: `docs/assets/manual/11-reportes.png` (regenerar después de validar visualmente)

**Interfaces:**
- `downloadReport(format: 'xlsx' | 'pdf')` construye el mismo query string de filtros y descarga el nombre `${type}.${format}`.

- [ ] **Step 1: Write failing UI tests**

  Verificar botones “Exportar Excel” y “Imprimir PDF”, que no exista botón CSV y que cada botón solicite `/reports/{type}.xlsx` o `/reports/{type}.pdf` con los filtros actuales.

- [ ] **Step 2: Run the focused test to verify failure**

  Run: `npm test -- --run src/features/reports/ReportsPage.test.tsx`.
  Expected: FAIL porque solo existe la acción CSV.

- [ ] **Step 3: Implement downloads**

  Reutilizar `apiFile`, fijar los `Accept` correctos, asignar nombre seguro y liberar el `ObjectURL` en `setTimeout` después de `link.click()`.

- [ ] **Step 4: Run test and build**

  Run: `npm test -- --run src/features/reports/ReportsPage.test.tsx` y `npm run build`.
  Expected: PASS y compilación limpia.

- [ ] **Step 5: Commit**

  Run: `git add frontend/src/features/reports && git commit -m "feat: add Excel and printable PDF report actions"`.

### Task 6: Recargas de ruta en backend

**Files:**
- Modify: `backend/src/main/resources/db/migration/V19__automatic_codes_and_replenishments.sql`
- Modify: `backend/src/main/java/gt/com/aguapura/application/dto/loading/CreateRouteLoadRequest.java`
- Create: `backend/src/main/java/gt/com/aguapura/application/dto/loading/CreateReplenishmentRequest.java`
- Modify: `backend/src/main/java/gt/com/aguapura/application/dto/loading/RouteLoadResponse.java`
- Modify: `backend/src/main/java/gt/com/aguapura/application/services/RouteLoadApplicationService.java`
- Modify: `backend/src/main/java/gt/com/aguapura/infrastructure/database/adapters/JdbcRouteLoadAdapter.java`
- Modify: `backend/src/main/java/gt/com/aguapura/presentation/controllers/RouteLoadController.java`
- Modify: `backend/src/main/java/gt/com/aguapura/application/ports/RouteLoadPort.java`
- Modify: `backend/src/main/java/gt/com/aguapura/application/services/SettlementApplicationService.java`
- Modify: `backend/src/main/java/gt/com/aguapura/infrastructure/database/adapters/JdbcSettlementAdapter.java`
- Test: `backend/src/test/java/gt/com/aguapura/domain/loading/RouteLoadWorkflowTest.java`
- Create: `backend/src/test/java/gt/com/aguapura/application/services/RouteLoadApplicationServiceTest.java`
- Create: `backend/src/test/java/gt/com/aguapura/application/services/SettlementApplicationServiceTest.java`

**Interfaces:**
- `route_load.load_type` is `INITIAL` by default or `REPLENISHMENT`; response exposes `loadType`.
- `POST /api/loads/replenishments` accepts `{ routeId, sourceLocationId, plannedDate, notes, items }` and returns a prepared `RouteLoadResponse`.
- Existing transition endpoints accept a replenishment only for warehouse confirmation and seller receipt; `start` rejects it with `REPLENISHMENT_CANNOT_START`.

- [ ] **Step 1: Write failing domain/service tests**

  Agregar pruebas de creación solo sobre ruta `STARTED`, rechazo para ruta sin recorrido o liquidada, confirmación de bodega y recepción con movimiento exacto, rechazo de `start`, y suma de unidades recibidas en la liquidación.

- [ ] **Step 2: Run focused backend tests to verify failure**

  Run: `mvn -q -Dtest=RouteLoadWorkflowTest,RouteLoadApplicationServiceTest,SettlementApplicationServiceTest test`.
  Expected: FAIL porque no existe el tipo de carga ni el endpoint de recarga.

- [ ] **Step 3: Add schema and request validation**

  En V19 agregar `load_type VARCHAR(20) NOT NULL DEFAULT 'INITIAL'` y constraint `INITIAL|REPLENISHMENT`; mantener cargas históricas como `INITIAL`. Validar producto activo, bodega, stock, ruta asignada y que no exista liquidación `CLOSED` para la ruta.

- [ ] **Step 4: Implement workflow and inventory transfer**

  Reutilizar `RouteLoadWorkflow.confirmWarehouse/confirmReceipt`, añadir regla `canStart(loadType)`, persistir `loadType`, y ejecutar `inventory.transfer` con referencias `REPLENISHMENT_OUT`/`REPLENISHMENT_IN`. Hacer la operación transaccional e idempotente mediante el estado y la actualización condicionada.

- [ ] **Step 5: Include replenishments in settlement**

  Ajustar las consultas de `JdbcSettlementAdapter` para sumar los ítems de recargas recibidas de la misma ruta desde `started_at` hasta el cierre y excluir las recargas como liquidaciones independientes. Mostrar `loadType` en la respuesta de cargas y reportes cuando corresponda.

- [ ] **Step 6: Run focused tests, integration tests and migration validation**

  Run: `mvn -q -Dtest=RouteLoadWorkflowTest,RouteLoadApplicationServiceTest,SettlementApplicationServiceTest test`, luego `mvn -q test`.
  Expected: PASS con inventario no negativo y sin doble transferencia al repetir una transición.

- [ ] **Step 7: Commit**

  Run: `git add backend/src/main backend/src/test && git commit -m "feat: support route replenishments"`.

### Task 7: Recargas en la interfaz web y móvil

**Files:**
- Modify: `frontend/src/features/loading/RouteLoadsPage.tsx`
- Modify: `frontend/src/features/loading/RouteLoadsPage.test.tsx`
- Modify: `frontend/src/app/AppShell.tsx` (solo etiqueta si se separa visualmente la opción)
- Modify: `frontend/src/app/App.tsx` (solo permisos si se agrega ruta dedicada)
- Modify: `frontend/src/styles.css`

**Interfaces:**
- `RouteLoad` añade `loadType: 'INITIAL' | 'REPLENISHMENT'`.
- El formulario “Nueva recarga” usa `POST /loads/replenishments`; el vendedor usa el endpoint existente `/loads/{id}/receipt`.

- [ ] **Step 1: Write failing component tests**

  Verificar que administrador/bodega ve el formulario de recarga solo cuando hay cargas iniciadas, que puede seleccionar cualquier producto activo, que el vendedor ve “Confirmar recepción de recarga”, y que no aparece “Iniciar recorrido” para recargas.

- [ ] **Step 2: Run focused test to verify failure**

  Run: `npm test -- --run src/features/loading/RouteLoadsPage.test.tsx`.
  Expected: FAIL porque la página solo conoce cargas normales y correcciones.

- [ ] **Step 3: Implement recarga UI**

  Añadir estado/formulario separado, etiquetas de tipo, validación de cantidad/motivo, invalidación de cargas e inventario después de cada transición, y mensajes de error de API visibles.

- [ ] **Step 4: Run focused tests, responsive build and E2E smoke**

  Run: `npm test -- --run src/features/loading/RouteLoadsPage.test.tsx`, `npm run build` y el escenario Playwright de recarga.
  Expected: PASS en escritorio y vista móvil.

- [ ] **Step 5: Commit**

  Run: `git add frontend/src/features/loading frontend/src/app frontend/src/styles.css && git commit -m "feat: add replenishment workflow to route loads"`.

### Task 8: Manuales, API, ERD y trazabilidad

**Files:**
- Modify: `docs/MANUAL_USUARIO.md`
- Regenerate: `docs/MANUAL_USUARIO.pdf`
- Modify: `docs/MANUAL_TECNICO.md`
- Modify: `docs/API.md`
- Modify: `diagrams/erd/postgresql-erd.mmd`
- Modify: `diagrams/erd/README.md`
- Modify: `docs/MATRIZ_TRAZABILIDAD.md`
- Create: `scripts/verify_manual.ps1`
- Modify: `scripts/generate_user_manual_pdf.py` only if the new manual content needs parser support

**Interfaces:**
- El manual debe explicar cada opción del menú: Inicio, Productos, Clientes, Rutas, Precios, Inventario, Cargas, Ventas, Transferencias, Mermas, Devoluciones, Liquidaciones, Control operativo, Anulaciones, Pendientes, Reportes, Auditoría, Usuarios, Datos de empresa y FEL opcional.
- API documenta `/api/loads/replenishments`, `loadType`, `.xlsx`, `.pdf` y comportamiento 401/refresh.

- [ ] **Step 1: Add documentation tests/checks**

  Crear un script PowerShell de validación que compruebe en Markdown los encabezados de las 20 opciones, `CLI-`, `VND-`, `RUT-`, `VEH-`, “Recarga”, “Excel”, “PDF” y “401”, además de los endpoints nuevos en `docs/API.md`.

- [ ] **Step 2: Run the documentation check to verify failure**

  Run: `powershell -File scripts/verify_manual.ps1`.
  Expected: FAIL porque el manual actual no contiene los cambios nuevos.

- [ ] **Step 3: Update manuals and diagrams**

  Añadir instrucciones paso a paso, permisos, estados, ejemplos, solución de sesión expirada y recarga; actualizar ERD con `load_type` y secuencias; actualizar trazabilidad con requisitos y pruebas.

- [ ] **Step 4: Regenerate and visually verify PDF**

  Run: `python scripts/generate_user_manual_pdf.py`, comprobar que `docs/MANUAL_USUARIO.pdf` se actualiza y renderizar/inspeccionar sus páginas con el flujo del skill de documentos.

- [ ] **Step 5: Run documentation check and commit**

  Run: `powershell -File scripts/verify_manual.ps1`.
  Expected: PASS.
  Then: `git add docs scripts/generate_user_manual_pdf.py && git commit -m "docs: document codes reports replenishments and session recovery"`.

### Task 9: Integración, datos de demostración y validación oficial

**Files:**
- Modify: `frontend/e2e/full-operational-flow.spec.ts`
- Modify: `frontend/playwright.config.ts` only if the new E2E route needs a stable timeout
- Create: `frontend/e2e/operational-improvements.spec.ts`
- Modify: `docs/INFORME_VERIFICACION_FINAL.md`

**Interfaces:**
- El E2E de mejoras crea recursos sin enviar códigos manuales, genera una recarga, verifica Excel/PDF y fuerza un `401` controlado seguido de refresh.

- [ ] **Step 1: Write failing acceptance scenarios**

  Añadir escenarios para crear cliente/vendedor/ruta/vehículo con payloads sin código, confirmar una recarga, descargar formatos y mantener la sesión después de una respuesta 401 simulada en el servidor de prueba.

- [ ] **Step 2: Run the scenarios to verify failure**

  Run: `$env:E2E_BASE_URL='http://localhost:3000'; npm run test:e2e -- e2e/operational-improvements.spec.ts` desde `frontend`.
  Expected: FAIL hasta que backend y frontend estén implementados.

- [ ] **Step 3: Run official builds and tests**

  Run: `mvn -q test` desde `backend`; `npm test -- --run --pool=threads --maxWorkers=1`; `npm run build`; y `npm run test:e2e -- e2e/operational-improvements.spec.ts`.
  Expected: PASS sin errores no controlados.

- [ ] **Step 4: Rebuild official Docker services**

  Run: `docker compose build backend frontend` y `docker compose up -d`.
  Expected: backend, frontend y postgres healthy; `/healthz`, `/api/connectivity` y readiness HTTP 200.

- [ ] **Step 5: Validate official data without test cleanup**

  Consultar por API autenticada los códigos generados, cargas `INITIAL/REPLENISHMENT`, inventarios, ventas, reportes y auditoría. Confirmar que no se hayan creado volúmenes o contenedores alternos y que `git status --short` solo muestre cambios esperados antes del commit final.

- [ ] **Step 6: Update final verification report and commit**

  Documentar comandos, resultados y límites conocidos en `docs/INFORME_VERIFICACION_FINAL.md`; ejecutar `git add frontend/e2e docs/INFORME_VERIFICACION_FINAL.md && git commit -m "test: verify operational improvements end to end"`.
