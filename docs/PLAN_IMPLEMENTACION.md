# Plan de implementación

Fecha: 2026-08-10  
Fuente canónica: `PROMPT_MAESTRO_SISTEMA_AGUA_PURA.md`  
Arquitectura: monolito modular Spring Boot + React PWA + PostgreSQL + IndexedDB

## 1. Objetivo

Ejecutar exactamente las fases 0 a 39 del prompt maestro y entregar un sistema funcional, probado, documentado y ejecutable mediante Docker Compose. No se crearán fases alternativas ni módulos duplicados.

## 2. Línea base tecnológica

| Componente | Línea base | Justificación |
|---|---|---|
| Java | 21 LTS | Runtime mantenido y compatible con Spring Boot seleccionado. |
| Spring Boot | 4.1.x | Versión estable mantenida; Java 17–26 compatible. |
| Maven | 3.9.x | Build reproducible mediante contenedor y Maven Wrapper. |
| PostgreSQL | 18.x | Rama estable soportada hasta 2030. |
| React | 19.2.x | Rama estable actual con correcciones de seguridad. |
| TypeScript | 5.x | Tipado estricto del frontend. |
| Vite | 8.2.x | Rama estable soportada para build PWA. |
| Node.js | 24.x | Runtime para desarrollo/build frontend. |
| Docker Compose | Compose Specification | Arranque local de PostgreSQL, backend y frontend. |

Referencias oficiales:

- https://docs.spring.io/spring-boot/system-requirements.html
- https://react.dev/versions
- https://main.vite.dev/releases
- https://www.postgresql.org/support/versioning/

Las versiones patch quedarán fijadas en archivos de build y lockfiles. Una actualización exige pruebas completas.

## 3. Estrategia transversal

- Backend organizado en `domain`, `application`, `infrastructure` y `presentation`, con submódulos por capacidad.
- PostgreSQL autoritativo y modificado exclusivamente por Flyway.
- Frontend organizado por funcionalidades, con formularios tipados y estado remoto centralizado.
- IndexedDB con esquema versionado, Outbox transaccional e idempotencia servidor.
- Pruebas unitarias, integración PostgreSQL, frontend y E2E añadidas en la fase de cada capacidad.
- Documentación, ERS/SRS y diagramas actualizados junto con cada cambio.
- Un commit verificable por fase o grupo inseparable de cambios.

## 4. Fases obligatorias

### FASE 0 — Análisis del repositorio

Entregables: `docs/ANALISIS_INICIAL.md`, inventario de herramientas y riesgos.  
Verificación: estado Git limpio, alcance y limitaciones documentados.

### FASE 1 — ERS/SRS, matriz de requisitos y reglas de negocio

Entregables: `docs/ERS_SRS.md`, `docs/REGLAS_NEGOCIO.md`, matriz de permisos y trazabilidad.  
Verificación: identificadores únicos, requisitos verificables y cobertura del prompt.

### FASE 2 — Diagramas iniciales + ERD PostgreSQL + ERD IndexedDB móvil

Entregables: diagramas de contexto, arquitectura, componentes, datos y flujos críticos.  
Verificación: referencias válidas y correspondencia con ERS/SRS.

### FASE 3 — Arquitectura monolítica modular y estructura

Entregables: proyectos backend/frontend, paquetes, convenciones y decisiones arquitectónicas.  
Verificación: builds mínimos reproducibles y regla de dependencias documentada.

### FASE 4 — Docker

Entregables: Dockerfiles, Compose, `.env.example`, healthchecks, red y volúmenes.  
Verificación: imágenes construyen y los contenedores alcanzan estado saludable.

### FASE 5 — Base de datos + Flyway

Entregables: migraciones iniciales, constraints, índices y configuración JPA de validación.  
Verificación: base vacía migra y ERD coincide con el esquema.

### FASE 6 — Seguridad/Auth

Entregables: login, JWT corto, refresh rotativo, cookies, revocación, Argon2id y protección CSRF/origen.  
Verificación: pruebas de login, expiración, rotación, reutilización y bloqueo.

### FASE 7 — Usuarios/Roles/Devices/Configuración empresarial

Entregables: RBAC, usuarios, vendedores, dispositivos y formulario único de empresa.  
Verificación: permisos, revocación y uso de configuración en interfaz/API.

### FASE 8 — Productos/Presentaciones

Entregables: unidades, productos, presentaciones, conversiones y activación lógica.  
Verificación: validaciones y conversiones a unidad base.

### FASE 9 — Precios/Mayoreo

Entregables: listas, versiones, tramos, precios especiales y descuentos autorizados.  
Verificación: cálculo backend, historia y manipulación de precio rechazada.

### FASE 10 — Clientes/Rutas

Entregables: clientes, rutas, vehículos, asignaciones históricas y detección de duplicados.  
Verificación: aislamiento por ruta y conservación de historial.

### FASE 11 — Inventario

Entregables: ubicaciones, balances y libro inmutable de movimientos.  
Verificación: concurrencia y prevención de stock negativo.

### FASE 12 — Carga de ruta

Entregables: carga, ítems, doble confirmación e inicio de recorrido.  
Verificación: actores/dispositivos registrados y corrección compensatoria.

### FASE 13 — Ventas online

Entregables: venta transaccional, ítems, precio servidor, inventario y numeración.  
Verificación: rollback completo, inmutabilidad y propiedad del recurso.

### FASE 14 — Pagos/Transferencias/Crédito

Entregables: medios de pago, verificación independiente y cuenta de crédito.  
Verificación: límites, estados y segregación de funciones.

### FASE 15 — PWA

Entregables: manifiesto, Service Worker, shell offline, instalación y actualización segura.  
Verificación: aplicación instalable y navegación base sin red.

### FASE 16 — IndexedDB

Entregables: object stores, índices, repositorios y migraciones del esquema móvil.  
Verificación: upgrade desde versiones soportadas y persistencia tras reinicio.

### FASE 17 — ConnectionManager

Entregables: estados, endpoint de conectividad, timeout y eventos de ciclo de vida.  
Verificación: ONLINE/OFFLINE/DEGRADED sin polling excesivo.

### FASE 18 — SyncEngine

Entregables: Outbox, dependencias, batches, estados y backoff con jitter.  
Verificación: resultados parciales, reintentos y conflictos visibles.

### FASE 19 — Idempotencia

Entregables: unicidad dispositivo/operación y almacenamiento de resultado.  
Verificación: cinco reenvíos producen un único efecto.

### FASE 20 — Cliente ocasional/provisional

Entregables: creación offline, revisión, fusión y restricciones comerciales.  
Verificación: venta preservada y dependencias de sincronización correctas.

### FASE 21 — Mermas

Entregables: catálogo, evidencia, revisión total/parcial, políticas y alertas.  
Verificación: vendedor no aprueba y merma no altera dinero.

### FASE 22 — Devoluciones

Entregables: devolución de cliente y recepción de producto bueno separadas de merma.  
Verificación: movimientos y estados correctos.

### FASE 23 — Liquidaciones

Entregables: conciliación física/financiera, diferencias y cierre inmutable.  
Verificación: escenarios antifraude y bloqueo por operaciones offline.

### FASE 24 — Autorizaciones/Incidencias

Entregables: solicitudes, decisiones, expiración, incidencias y segregación.  
Verificación: permisos, vigencia y auditoría.

### FASE 25 — Anulaciones

Entregables: solicitud/aprobación y transacciones compensatorias.  
Verificación: venta original permanece y efectos se revierten una sola vez.

### FASE 26 — Comprobantes PDF + FEL opcional

Entregables: PDF con configuración empresarial; FEL bloqueado sin proveedor y puerto de adaptación.  
Verificación: comprobante interno no se presenta como DTE y no se filtran credenciales.

### FASE 27 — Compartir WhatsApp

Entregables: Web Share API, descarga y mensaje fallback.  
Verificación: móvil compatible comparte archivo; navegador alterno permite descarga.

### FASE 28 — Dashboard

Entregables: indicadores operativos, diferencias y pendientes.  
Verificación: cifras derivan de datos oficiales y respetan permisos.

### FASE 29 — Reportes

Entregables: filtros, paginación y exportaciones autorizadas.  
Verificación: resultados por vendedor, ruta, fecha, producto, pago y diferencia.

### FASE 30 — Auditoría

Entregables: eventos requeridos, before/after seguro y correlationId.  
Verificación: cobertura de acciones críticas y ausencia de secretos.

### FASE 31 — Hardening seguridad

Entregables: rate limiting, headers, CORS, límites, sanitización, logs y perfiles productivos.  
Verificación: batería SQLi, XSS, BOLA, Mass Assignment, JWT y requests grandes.

### FASE 32 — Pruebas E2E

Entregables: escenarios Playwright online/offline y antifraude.  
Verificación: flujo 1–28 y criterios finales automatizados.

### FASE 33 — Diagramas finales actualizados, incluidos ambos ERD

Entregables: todos los diagramas sincronizados con código y migraciones.  
Verificación: entidades, stores, estados y componentes reales.

### FASE 34 — Manual de usuario

Entregables: `docs/MANUAL_USUARIO.md`, capturas y versión PDF cuando sea práctico.  
Verificación: recorrido por rol entendible para usuario no técnico.

### FASE 35 — Manual técnico

Entregables: `docs/MANUAL_TECNICO.md`.  
Verificación: arquitectura, seguridad, datos, sync, Docker y troubleshooting completos.

### FASE 36 — Manual de instalación local

Entregables: `docs/INSTALACION_LOCAL_PRIMERA_VEZ.md`.  
Verificación: comandos ejecutados desde entorno limpio compatible.

### FASE 37 — Backup/Restore

Entregables: `docs/BACKUP_RESTORE.md` y scripts seguros.  
Verificación: backup restaurado en base limpia y datos comprobados.

### FASE 38 — Documentación final

Entregables: README, API, Developer Guide, Security y trazabilidad final.  
Verificación: enlaces, comandos, ejemplos y variables correctos.

### FASE 39 — Verificación completa

Entregables: informe de ejecución final.  
Verificación: tests backend/frontend/integración/E2E, Docker build, Compose, healthchecks, migraciones y escenarios de aceptación.

## 5. Registro de avance

| Fase | Estado | Evidencia |
|---|---|---|
| 0 | Completada | `docs/ANALISIS_INICIAL.md` y verificación de herramientas. |
| 1 | Completada | ERS/SRS, reglas, permisos y trazabilidad creados y validados. |
| 2 | Completada | Diagramas iniciales y ambos ERD creados y validados estructuralmente. |
| 3 | Completada | Monolito modular con dependencias dirigidas: `domain`/`application` usan puertos y los adaptadores JPA/JWT quedan en infraestructura. |
| 4 | Completada | Dockerfiles y Compose verificados con PostgreSQL, backend y frontend saludables. |
| 5 | Completada | Flyway V1–V2 aplicado y esquema validado por Hibernate sobre PostgreSQL 18. |
| 6 | Completada | Login, JWT, Argon2id, refresh rotativo, revocación, cookie y control de origen verificados. |
| 7 | Completada | Administración de usuarios, perfiles de vendedor, dispositivos, RBAC y formulario único de empresa con logotipo y numeración verificados. |
| 8 | Completada | Productos, presentaciones, unidades y conversiones versionadas con API, interfaz, activación lógica y pruebas. |
| 9 | Completada | Listas y versiones inmutables, tramos de mayoreo, precios especiales y descuentos autorizados; cálculo del servidor verificado con PostgreSQL y UI. |
| 10 | Completada | Clientes, rutas, vehículos y asignaciones históricas con aislamiento de vendedor, API, interfaz y prueba transaccional. |
| 11 | Completada | Ubicaciones de bodega/ruta, saldos por producto y libro inmutable; concurrencia, stock negativo e inmutabilidad verificados en PostgreSQL temporal. |
| 12 | Completada | Carga e ítems inmutables, confirmación separada bodega/vendedor con dispositivos, transferencia física, inicio y corrección compensatoria verificados. |
| 13 | Completada | Venta online transaccional con precio, numeración y totales de servidor; rollback, propiedad, inventario e inmutabilidad verificados. |
| 14 | Completada | Efectivo, transferencia y crédito integrados a la venta; límite concurrente, segregación de revisión, rollback y libros inmutables verificados. |
| 15 | Completada | PWA instalable con manifiesto, icono, precaché, fallback de navegación, aviso offline y actualización segura; pruebas, build, cabeceras HTTP y despliegue verificados. |
| 16–39 | Planificadas | Se ejecutarán en orden y se actualizará esta tabla sin duplicar fases ni funciones. |
