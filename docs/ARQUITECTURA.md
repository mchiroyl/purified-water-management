# Arquitectura del Sistema

## Estilo

Monolito modular Spring Boot y PWA React. El backend es una sola unidad de despliegue, pero cada capacidad mantiene límites internos y dependencias dirigidas hacia el dominio.

## Capas backend

- `domain`: entidades, valores, reglas, contratos y excepciones sin dependencias web/JPA.
- `application`: casos de uso, comandos, consultas y DTO internos.
- `infrastructure`: JPA, seguridad, storage, PDF, sincronización y configuración.
  - Los comprobantes internos se generan con Apache PDFBox y se conservan como archivos inmutables mediante `file_object` y `receipt_document`.
  - Los puntos GPS de rastreo se persisten en `route_tracking_point` mediante `JdbcRouteTrackingAdapter`.
- `presentation`: controladores REST, validación de entrada y manejo de errores.

## Componentes frontend

- `app`: composición, rutas, proveedores y sesión.
- `features`: módulos por capacidad:
  - `routes/RouteMapPanel.tsx`: mapa interactivo con Leaflet + OpenStreetMap + OSRM, sin API keys externas.
  - `routes/RouteHistoryPage.tsx`: historial geográfico con filtros por vendedor, fecha local y accesos rápidos.
  - `sales/SalesPage.tsx`: panel de ventas y registro ético de visita sin compra (GPS + motivo).
  - `loading/RouteLoadsPage.tsx`: cargas de ruta con botón "Ver mi ruta" en jornadas activas.
- `offline`: repositorios IndexedDB, Outbox, SyncEngine y reintentos.
- `pwa`: Service Worker, manifiesto y actualización.
- `services`: cliente HTTP, geolocalización y contratos API.

## Rastreo geográfico

El rastreo no es continuo ni en segundo plano. Se captura una coordenada GPS puntual en tres eventos:

1. **START** — al confirmar recepción de la carga de ruta.
2. **SALE** — al confirmar cada venta.
3. **NO_PURCHASE_VISIT** — al registrar visita sin compra (GPS + motivo ético obligatorio).

Los puntos se persisten inmutablemente en `route_tracking_point` (PostgreSQL) y se consultan para renderizar el mapa. La visualización usa **Leaflet** con tiles de **OpenStreetMap** y rutas viales calculadas por **OSRM** — todos gratuitos y sin API keys ni billing.

## Persistencia

PostgreSQL es autoritativo y transaccional. IndexedDB conserva únicamente el paquete autorizado de ruta y operaciones offline. Los archivos usan una abstracción separada con volumen local en desarrollo.

Las migraciones Flyway (V1–V35) aplican automáticamente al iniciar el backend:
- **V34**: agrega `customer_id` y `visit_note` a `route_tracking_point`.
- **V35**: expande `point_type` a `VARCHAR(30)` para soportar `NO_PURCHASE_VISIT`.

## Seguridad

JWT corto en memoria y refresh opaco rotativo en cookie segura. RBAC se combina con autorización por recurso. El backend deriva campos protegidos. Auditoría y `correlationId` atraviesan operaciones críticas.

La CSP de Nginx permite explícitamente:
- Tiles de `*.tile.openstreetmap.org` para el mapa.
- Conexiones a `router.project-osrm.org` para cálculo de rutas viales.

## Despliegue local

Docker Compose ejecuta PostgreSQL, backend y frontend Nginx. Flyway migra al iniciar backend. Los healthchecks gobiernan dependencias sin asumir que un proceso iniciado está listo.

Diagramas de referencia: [arquitectura](../diagrams/architecture/), [componentes](../diagrams/components/), [flujos](../diagrams/flows/), [ERD](../diagrams/erd/).
