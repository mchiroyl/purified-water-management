# Contexto de continuidad — Sistema Agua Pura

Documento único para retomar el proyecto con otra IA. Actualizarlo al terminar cambios funcionales o de arquitectura.

## Estado y tecnología

- Sistema para una sola empresa purificadora de agua, configurable desde **Datos de la empresa**.
- Frontend: React + TypeScript + Vite PWA.
- Backend actual: Java 21 + Spring Boot + JDBC. **No está migrado a NestJS.**
- Base de datos: PostgreSQL con migraciones Flyway.
- Ejecución oficial: Docker Compose. Aplicación: `http://localhost:3000`.
- Servicios: `frontend`, `backend`, `postgres`; PostgreSQL del host en `127.0.0.1:15432`.
- Las credenciales y secretos se administran en `.env`; no deben copiarse a documentación ni código.

## Inicio y verificación

```powershell
docker compose up -d --build
docker compose ps
```

Los tres servicios deben estar `healthy`. Para detenerlos: `docker compose down`. No borrar volúmenes salvo que se solicite explícitamente reiniciar la base.

## Principios funcionales vigentes

- Códigos automáticos: cliente, vendedor, ruta, vehículo, producto y presentación.
- No se permiten duplicados lógicos de presentaciones ni de productos nuevos con la misma presentación.
- Empresa, logotipo, moneda, zona horaria y numeración se configuran en un único formulario y se usan en comprobantes/reportes.
- Reportes: Excel y PDF; los comprobantes usan identidad y logotipo configurados.
- Recarga: carga adicional para una ruta ya iniciada.
- Geolocalización: solo punto de inicio al recibir carga inicial y punto de cada venta confirmada; no seguimiento continuo.
- Seguridad de contraseñas: mantener un algoritmo de hash por instalación (Argon2 o BCrypt), sin mezclar ambos para la misma contraseña.

## Flujo operativo recomendado

1. Configurar datos y logotipo de la empresa.
2. Crear presentaciones.
3. Crear productos seleccionando una presentación existente.
4. Registrar usuarios/vendedores, vehículos, rutas y clientes.
5. Asignar vendedor y vehículo a la ruta.
6. Registrar inventario, carga inicial, ventas, recargas, devoluciones, mermas y liquidación.

## Catálogo: reglas de UI/UX actuales

### Presentaciones

- Ruta de alta: `/presentations`.
- Ruta de lista exclusiva: `/presentations/list`.
- El formulario contiene: **Tipo de envase** editable, contenido, unidad del contenido y factor.
- La unidad de inventario se reutiliza automáticamente desde el tipo de envase; no se captura dos veces.
- Código `PRE-xxxx` automático.
- La lista tiene columnas y acciones: Modificar (modal), Activar/Desactivar y Eliminar.
- El botón **Ver presentaciones** nunca debe mostrar el formulario de alta.

### Productos

- Ruta de alta: `/products`.
- Ruta de lista exclusiva: `/products/list`.
- Código `PRD-xxxx` automático.
- El usuario escribe en el campo de presentación; se muestran coincidencias en una lista corta y selecciona una.
- La unidad de inventario se deriva de la presentación seleccionada.
- La lista tiene Modificar (modal), Activar/Desactivar y Eliminar.
- La modificación de un registro existente debe funcionar aunque existan duplicados históricos; al crear uno nuevo se bloquea la duplicación lógica.

## Rutas y vehículos

- Rutas: alta en `/routes` y lista exclusiva en `/routes/list`.
- Vehículos: alta en `/vehicles` y lista exclusiva en `/vehicles/list`.
- Rutas y vehículos se crean con código automático; la placa es manual y única.
- Sus listas incluyen acciones para modificar y activar/desactivar.
- Se puede modificar o cambiar estado únicamente si no tienen una asignación vigente.
- El backend también valida esa regla, no solo la interfaz.
- La asignación de vendedor y vehículo se gestiona desde la lista de rutas.

## Menú

El menú está agrupado y es desplegable:

- Inicio.
- Catálogo y planificación: Presentaciones, Productos, Clientes, Rutas, Precios.
- Operación diaria: Inventario, Cargas, Ventas, Transferencias, Mermas, Devoluciones, Liquidaciones.
- Control y seguimiento: Control operativo, Anulaciones, Pendientes, Reportes, Auditoría.

En móvil se usa botón de menú y contenido desplazable; el cierre de sesión debe permanecer visible.

## Conectividad y PWA

- Endpoint de comprobación: `GET /api/connectivity`, respuesta `ONLINE`.
- La interfaz muestra el estado confirmado por servidor, no solo `navigator.onLine`.
- El gestor de conexión debe tolerar el montaje/desmontaje de React StrictMode: no reutilizar una comprobación abortada.
- La pantalla `/pending` sincroniza operaciones locales; no debe afirmar falta de conexión si `/api/connectivity` responde 200.
- Si se ve una versión anterior, actualizar la PWA o hacer recarga forzada del navegador.

## Backend: puntos de referencia

- Productos: `backend/src/main/java/gt/com/aguapura/application/services/ProductCatalogApplicationService.java`.
- Rutas/vehículos: `CustomerRouteApplicationService.java`, `CustomerRoutePort.java`, `JdbcCustomerRouteAdapter.java`, `RouteController.java`.
- PDF/comprobantes: `PdfBoxReceiptGenerator.java`.
- Migraciones: `backend/src/main/resources/db/migration`.
- Los cambios de datos estructurales requieren una nueva migración Flyway; no editar migraciones ya aplicadas.

## Frontend: puntos de referencia

- Productos: `frontend/src/features/catalog/ProductCatalogPage.tsx`.
- Presentaciones: `frontend/src/features/catalog/PresentationCatalogPage.tsx`.
- Rutas: `frontend/src/features/routes/RoutesPage.tsx`.
- Vehículos: `frontend/src/features/routes/VehiclesPage.tsx`.
- Conectividad: `frontend/src/features/connectivity/ConnectionManager.ts`.
- Menú y rutas: `frontend/src/app/AppShell.tsx`, `frontend/src/app/App.tsx`.
- Estilos globales: `frontend/src/styles.css`.

## Documentación relacionada

- Requisitos: `docs/ERS_SRS.md`.
- Modelo de datos: `diagrams/erd/README.md`.
- API: `docs/API.md`.
- Manual usuario: `docs/MANUAL_USUARIO.md`.
- Manual técnico: `docs/MANUAL_TECNICO.md`.
- Arquitectura: `docs/ARQUITECTURA.md`.
- Reglas de negocio: `docs/REGLAS_NEGOCIO.md`.
- Prompt inicial: `PROMPT_MAESTRO_SISTEMA_AGUA_PURA.md`.

## Reglas para la siguiente IA

- No inventar endpoints, módulos ni requisitos.
- Antes de una modificación, revisar el código y la documentación relacionada.
- Preservar autenticación, sesiones, permisos, operaciones offline y migraciones.
- Usar `apply_patch` para editar archivos.
- No ejecutar `git reset --hard` ni borrar datos/volúmenes sin orden explícita.
- Tras cambios: compilar con `docker compose up -d --build`, verificar `docker compose ps` y `http://localhost:3000`.
- Actualizar este archivo y el manual pertinente cuando se agregue o cambie comportamiento funcional.

## Registro de sesiones

### 2026-09-10 — Verificación y arranque de entorno

**Hecho:**
- Entorno Docker reconstruido desde cero (`docker compose up -d --build`).
- Backend compiló con Java 21 + Spring Boot 4.1.0 (266 archivos fuente).
- Flyway V1–V33 aplicado automáticamente al arrancar el backend.
- Los tres contenedores alcanzaron estado `healthy`: `postgres`, `backend`, `frontend`.
- **Código de lista de precios automático**: campo eliminado del formulario; el servidor genera `LST-xxxx` (migración V32 + secuencia `price_list_code_seq`).
- **GPS de alta precisión en ventas**: `watchPosition` espera hasta ≤20 m o 30 s; migración V33 aumenta columnas a `NUMERIC(12,8)`; mensaje "Refinando precisión GPS…" en UI.
- **Coordenadas visibles solo para admin/supervisor**: endpoint `GET /api/sales/{id}/location` restringido con `@PreAuthorize`; botón "Ver ubicación" oculto al vendedor; panel con lat/lon/precisión y enlace Google Maps.
### 2026-09-18 — Control de Garrafones y Gestión de Créditos/Abonos (V36–V37)

**Hecho:**
- **Regla de oro cumplida:** Desarrollo 100% aditivo. Ningún endpoint, modelo, trigger ni lógica existente fue roto ni alterado.
- **Control de Garrafones (Migración V36 + `/api/jugs` + UI `/jugs`):**
  - Control de envases prestados (`LENT`), devueltos (`RETURNED`) y cobro por pérdida/daño (`CHARGED_LOSS`, `CHARGED_DAMAGE`) completamente independiente del inventario de productos.
  - Tabla inmutable `jug_loan_event` protegida por trigger + vista `customer_jug_balance`.
  - Saldos persistentes vinculados a `customer_id` y `route_id`, heredados automáticamente ante rotación de vendedores.
  - Alta del rol `ADMINISTRADOR_CREDITO`.
- **Gestión de Créditos y Abonos (Migración V37 + `/api/credit` + UI `/credit`):**
  - Tabla `credit_payment` con soporte para abonos en efectivo (`CASH` con reducción inmediata de saldo) y transferencias bancarias (`TRANSFER` con estado `PENDING_VERIFICATION`).
  - Extensión aditiva de `credit_account_entry` para aceptar `CREDIT_PAYMENT` preservando filas históricas de `SALE_CHARGE` y `SALE_VOID`.
  - Segregación obligatoria de funciones: el usuario que cobró la transferencia no puede verificarla o aprobarla por sí mismo.
  - Generación de comprobante oficial de abono en PDF bajo demanda (`CreditPaymentVoucherPdfPort` + `PdfBoxCreditVoucherGenerator`), sin consumir almacenamiento estático innecesario.
  - Descarga y compartición directa de comprobantes de abono por WhatsApp (`shareCreditVoucherFile` / `downloadCreditVoucherFile`).
  - Consulta de estados de cuenta completos con detalle cronológico y cartera deudora por ruta.
  - Botones de acceso rápido *🧴 Garrafones* y *💳 Crédito* incorporados en la tabla de clientes.
- **Pruebas y Verificación:**
  - Tests unitarios de aplicación backend (`JugLoanApplicationServiceTest`, `CreditPaymentApplicationServiceTest`).
  - Tests unitarios y de componentes frontend (`CreditPage.test.tsx`, `JugsPage.test.tsx`, `creditVoucherSharing.test.ts`).
  - Suite de Vitest frontend: 39 suites y 86 pruebas pasando al 100%. Build de Vite sin errores.
  - Documentación, diagramas (ERD, casos de uso) y matrices actualizados integralmente.
