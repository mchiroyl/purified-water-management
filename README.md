# Sistema Agua Pura

Sistema operativo completo para empresa purificadora y distribuidora de agua: configuración empresarial, catálogo de productos, precios por tramos y especiales, vendedores, rutas, vehículos, clientes, bodega, cargas, ventas, pagos, mermas, devoluciones, liquidaciones, comprobantes PDF, reportes exportables y auditoría trazable.

La PWA permite operación móvil **offline** con sincronización idempotente mediante Outbox + IndexedDB.  
El **Historial Geográfico de Rutas** traza el recorrido real del vendedor en un mapa interactivo (Leaflet + OpenStreetMap + OSRM) sin costo ni API keys externas.

## Tecnologías

| Capa | Stack |
|---|---|
| Frontend | React 18 · TypeScript · Vite · TanStack Query · Leaflet · OpenStreetMap |
| Backend | Spring Boot 4 · Java 21 · JDBC · Flyway |
| Base de datos | PostgreSQL 18.4 |
| Empaquetado | Docker Compose · Nginx |
| Pruebas | Vitest (frontend) · JUnit / Mockito (backend) · Playwright (E2E) |

## Inicio rápido

Requisitos: Docker Desktop con Compose v2, PowerShell y 4 GB de RAM.

```powershell
Set-Location 'D:\UMG\Purificadora'
powershell -ExecutionPolicy Bypass -File scripts/initialize-local-env.ps1
docker compose config --quiet
docker compose up -d --build
```

Abra `http://localhost:3000`, ingrese como `admin` con la contraseña elegida en el inicializador y cámbiela cuando se solicite.  
Consulte [la guía de instalación](docs/INSTALACION_LOCAL_PRIMERA_VEZ.md) para cambiar puerto, resolver problemas y configurar HTTPS productivo.

## Funcionalidades principales

- **Gestión de empresa:** logotipo, NIT, zona horaria, numeración interna.
- **Catálogo y precios:** productos, presentaciones, listas de precios versionadas, precios especiales y descuentos con aprobación segregada.
- **Rutas y clientes:** asignación de vendedores y vehículos con vigencia, clientes permanentes, ocasionales y provisionales con flujo de revisión.
- **Operación de ruta:** carga inicial + recargas, ventas con crédito, mermas, devoluciones, entrega de efectivo y liquidación.
- **Control de garrafones:** registro y seguimiento de envases prestados (`LENT`), devoluciones (`RETURNED`) y cobro por pérdida o deterioro; saldos asociados al cliente y a la ruta para evitar pérdidas ante rotación de vendedores.
- **Créditos y abonos:** gestión estructurada de cuentas por cobrar, abonos en efectivo o transferencias bancarias verificadas con segregación de funciones, estados de cuenta y comprobantes PDF compartibles directamente por WhatsApp.
- **Visita sin compra:** el vendedor registra GPS + motivo ético (`"Cliente no estaba"` / `"No necesitaba"`) cuando visita a un cliente sin venta. Trazable en el mapa.
- **Historial geográfico:** mapa interactivo con marcadores diferenciados por tipo (Inicio, Venta, Visita sin compra), polilínea vial vía OSRM y lista cronológica de paradas.
- **Comprobantes y reportes:** PDF del comprobante interno, exportación a Excel y PDF de ventas, mermas y liquidaciones.
- **Offline-first:** SyncEngine + Outbox garantiza idempotencia; el vendedor opera sin internet y sincroniza cuando regresa la conexión.
- **Seguridad:** JWT rotativo HttpOnly, Argon2id, rate limiting, autorización a nivel de recurso, CSP estricta en Nginx.

## Documentación

- [Manual de usuario](docs/MANUAL_USUARIO.md)
- [Manual técnico](docs/MANUAL_TECNICO.md)
- [Instalación local y producción](docs/INSTALACION_LOCAL_PRIMERA_VEZ.md)
- [Respaldo y restauración](docs/RESPALDO_RESTAURACION.md)
- [API REST](docs/API.md)
- [Guía de desarrollo](docs/DEVELOPER_GUIDE.md)
- [ERS/SRS](docs/ERS_SRS.md) · [Reglas de negocio](docs/REGLAS_NEGOCIO.md)
- [Matriz de permisos](docs/MATRIZ_PERMISOS.md) · [Trazabilidad](docs/MATRIZ_TRAZABILIDAD.md)
- [Arquitectura](docs/ARQUITECTURA.md) · [Diagramas y ERD](diagrams/erd/README.md)
- [Política de seguridad](SECURITY.md)

## Desarrollo y pruebas

Backend:

```powershell
docker run --rm -v aguapura_m2:/root/.m2 -v "${PWD}:/workspace" `
  -w /workspace/backend maven:3.9.11-eclipse-temurin-21-alpine mvn -q test
```

Frontend:

```powershell
Set-Location frontend
npm ci
npm test -- --run --pool=threads
npm run build
```

Pruebas E2E completas con Compose aislado:

```powershell
powershell -ExecutionPolicy Bypass -File frontend/scripts/run-e2e.ps1
```

## Estado del proyecto

Todas las fases del sistema están implementadas, verificadas y documentadas:

- ✅ Autenticación, dispositivos, roles y auditoría
- ✅ Configuración empresarial, catálogo, precios y clientes
- ✅ Rutas, cargas (inicial + recarga), ventas, pagos, mermas y devoluciones
- ✅ Liquidaciones, comprobantes PDF, reportes Excel/PDF y dashboard
- ✅ Sincronización offline-first con idempotencia (Outbox + IndexedDB)
- ✅ Historial geográfico de rutas con Leaflet/OSM/OSRM (sin Google Maps)
- ✅ Registro ético de visita sin compra (GPS + motivo predefinido)

## Seguridad

Consulte [SECURITY.md](SECURITY.md) para reportar vulnerabilidades de forma responsable.
