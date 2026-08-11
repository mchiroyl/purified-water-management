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

Estado: **completada**. Implementa catálogo configurable, evidencia fotográfica con SHA-256,
Outbox offline, revisión segregada y escalable, aprobación parcial, alertas de frecuencia e
indicadores. La prueba PostgreSQL confirma `PARTIALLY_APPROVED`, diferencia pendiente preservada,
movimiento exclusivo `WASTE_OUT`, rechazo HTTP 403 al vendedor y cero mutaciones en venta/pago.

### FASE 22 — Devoluciones

Entregables: devolución de cliente y recepción de producto bueno separadas de merma.  
Verificación: movimientos y estados correctos.

Estado: **completada**. Separa `UNSOLD_GOOD` de `CUSTOMER_RETURN`, admite captura offline y
recepción física total, parcial o rechazada por bodega/supervisión. El producto no vendido mueve
existencia de ruta a bodega mediante `RETURN_OUT`/`RETURN_IN`; la devolución del cliente solamente
ingresa a bodega con `RETURN_IN`. PostgreSQL temporal verificó migración 13, rechazo HTTP 403 al
vendedor, estados `PARTIALLY_RECEIVED` y `RECEIVED`, diferencia pendiente de 2 unidades, inventario
de ruta 100→92, bodega 0→13 y cero registros de merma.

### FASE 23 — Liquidaciones

Entregables: conciliación física/financiera, diferencias y cierre inmutable.  
Verificación: escenarios antifraude y bloqueo por operaciones offline.

Estado: **completada**. Calcula exclusivamente desde carga, correcciones, ventas, pagos,
devoluciones recibidas y mermas aprobadas del servidor. El Outbox local y los conflictos conocidos
se muestran como bloqueos; el cierre solo corresponde a administrador/supervisor y transforma la
carga a `SETTLED`. La prueba PostgreSQL confirmó 100−60−38−2=0 físicamente, Q600−Q400=Q200 de
diferencia monetaria aunque exista merma, cierre HTTP 409 con Outbox pendiente y rechazo de cambios
directos después del cierre.

### FASE 24 — Autorizaciones/Incidencias

Entregables: solicitudes, decisiones, expiración, incidencias y segregación.  
Verificación: permisos, vigencia y auditoría.

Estado: **completada**. Las autorizaciones validan existencia y propiedad del recurso, tienen
vigencia máxima de siete días, expiran automáticamente y no permiten decisión propia. Las
incidencias conservan contexto, severidad y estados de investigación/resolución con revisor
distinto. PostgreSQL temporal confirmó aprobación y resolución por revisor, vencimiento automático,
HTTP 403 para el vendedor en decisiones y cuatro eventos de auditoría.

### FASE 25 — Anulaciones

Entregables: solicitud/aprobación y transacciones compensatorias.  
Verificación: venta original permanece y efectos se revierten una sola vez.

Estado: **completada**. El vendedor solicita únicamente sobre sus ventas y nunca decide su propia
solicitud; administrador o supervisor aprueban o rechazan. La aprobación conserva venta y pago,
crea `payment_reversal`, devuelve existencias con `VOID_IN`, revierte crédito cuando corresponde y
excluye la venta anulada de la liquidación. PostgreSQL temporal confirmó migración 16, HTTP 403 para
autoaprobación, HTTP 409 para repetición o ruta liquidada, saldo 90→100 y un único efecto de cada tipo.

### FASE 26 — Comprobantes PDF + FEL opcional

Entregables: PDF con configuración empresarial; FEL bloqueado sin proveedor y puerto de adaptación.  
Verificación: comprobante interno no se presenta como DTE y no se filtran credenciales.

Estado: **completada**. Cada venta conserva la identidad empresarial histórica y genera como máximo
un `receipt_document` PDF inmutable, descargable por usuarios autorizados y protegido por propiedad
para el vendedor. El documento muestra empresa, venta, fecha en zona configurada, cliente, vendedor,
detalle, descuentos aplicados, pagos, totales y la leyenda visible `NO ES DTE FEL CERTIFICADO`.
FEL posee configuración y puerto independientes, no expone referencias secretas y devuelve HTTP 409
si se intenta activar sin adaptador real y credenciales validadas. PostgreSQL temporal confirmó
migración 17, generación idempotente, bloqueo BOLA 404 y cero documentos FEL simulados; el PDF fue
renderizado a PNG y revisado sin solapamientos ni recortes.

### FASE 27 — Compartir WhatsApp

Entregables: Web Share API, descarga y mensaje fallback.  
Verificación: móvil compatible comparte archivo; navegador alterno permite descarga.

Estado: **completada**. La PWA comparte el archivo PDF mediante Web Share API cuando el dispositivo
acepta archivos. El fallback descarga el comprobante y abre exclusivamente `https://wa.me/` con un
mensaje preparado que indica adjuntar el archivo, sin APIs privadas. El PDF oficial se guarda en
`fileCache` y `receiptCache` de IndexedDB; si no existe copia y no hay conexión, queda
`PENDING_DOWNLOAD` hasta que el usuario recupere Internet. Las pruebas cubren compartir nativo,
cancelación segura, descarga, enlace WhatsApp, hash SHA-256, caché y pendiente offline.

### FASE 28 — Dashboard

Entregables: indicadores operativos, diferencias y pendientes.  
Verificación: cifras derivan de datos oficiales y respetan permisos.

Estado: **completada**. El endpoint `GET /api/dashboard` calcula el día operativo con la zona
horaria de la configuración empresarial y obtiene ventas no anuladas, pagos, entregas de efectivo,
diferencias, mermas, rutas, clientes provisionales y operaciones pendientes directamente de
PostgreSQL. El vendedor queda limitado a sus rutas y operaciones; los demás roles autorizados ven
el ámbito operativo correspondiente. La interfaz reemplaza cifras simuladas por métricas oficiales,
pendientes y alertas. Las pruebas validan el corte horario; el endpoint real respondió con
`America/Guatemala` y `GTQ` sobre el despliegue saludable.

### FASE 29 — Reportes

Entregables: filtros, paginación y exportaciones autorizadas.  
Verificación: resultados por vendedor, ruta, fecha, producto, pago y diferencia.

Estado: **completada**. El módulo de reportes ofrece ventas por ítem, mermas y liquidaciones con
rango inclusivo según la zona horaria empresarial, paginación, filtros textuales parametrizados y
filtros específicos de forma de pago y diferencias. Los tres reportes se exportan como CSV UTF-8
con límite explícito y protección contra inyección de fórmulas de hoja de cálculo. La interfaz
adaptable permite filtrar, paginar y descargar. El servidor aplica el alcance del vendedor antes de
consultar y exportar. Las consultas reales de los tres reportes y la descarga CSV respondieron HTTP
200 aun usando una cadena de prueba SQLi como filtro, sin alterar la consulta.

### FASE 30 — Auditoría

Entregables: eventos requeridos, before/after seguro y correlationId.  
Verificación: cobertura de acciones críticas y ausencia de secretos.

Estado: **completada**. `audit_log` ahora es inmutable mediante trigger, posee índices por acción y
correlación y solo admite códigos normalizados. El servicio central elimina recursivamente campos de
contraseña, token, secreto, credencial, autorización y cookie antes de escribir; la misma protección
se aplica al leer historia previa. Login exitoso/fallido, logout, usuarios/roles/dispositivos, precios,
cargas, ventas online u offline, mermas online u offline, cierres, fusiones y configuración registran
los eventos obligatorios. Los adaptadores históricos usan el `X-Correlation-Id` real y la IP de la
solicitud. Administrador y supervisor disponen de búsqueda paginada; consultar auditoría genera
`AUDIT_VIEW`. El despliegue aplicó Flyway 18 y confirmó correlación HTTP exacta, `LOGIN_FAILED` sin
secretos y rechazo de UPDATE por PostgreSQL.

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
| 16 | Completada | IndexedDB móvil v2 con 26 stores canónicos, índices, repositorios, transacciones multi-store, migración v1→v2, persistencia tras reinicio y ERD lógico verificados. |
| 17 | Completada | ConnectionManager con UNKNOWN/CHECKING/OFFLINE/DEGRADED/ONLINE, timeout, cooldown, deduplicación, lifecycle, backoff, comprobación manual y endpoint `no-store`; frontend, backend y despliegue verificados. |
| 18 | Completada | SyncEngine independiente con Outbox IndexedDB, dependencias, batches, resultados parciales, estados visibles, recuperación, backoff+jitter, lifecycle, botón manual y Background Sync progresivo verificados. |
| 19 | Completada | Idempotencia por dispositivo/operación, hash canónico, resultados persistidos, dependencias, reintentos transaccionales y lote HTTP; cinco reenvíos producen una sola fila y un solo efecto. |
| 20 | Completada | Cliente ocasional y provisional offline con UUID estable, Outbox, revisión humana, detección de duplicados, aprobación/rechazo/fusión inmutable y restricciones de crédito/precio; venta histórica preservada en PostgreSQL temporal. |
| 21 | Completada | Merma offline, revisión segregada/parcial, alertas, movimiento `WASTE_OUT` y prueba PostgreSQL antifraude. |
| 22 | Completada | Producto no vendido y devolución de cliente separados de merma; recepción física, movimientos y diferencia verificados en PostgreSQL. |
| 23 | Completada | Conciliación física/financiera oficial, efectivo inmutable, bloqueo offline, cierre y carga `SETTLED` verificados. |
| 24 | Completada | Solicitudes con vigencia, decisiones segregadas, incidencias, permisos por recurso y auditoría verificados. |
| 25 | Completada | Anulación segregada con reversos compensatorios exactos y venta original inmutable. |
| 26 | Completada | PDF interno inmutable, identidad histórica, descarga autorizada y FEL protegido sin proveedor real. |
| 27 | Completada | Web Share, fallback WhatsApp y caché/pendiente de comprobante en IndexedDB verificados. |
| 28 | Completada | Dashboard oficial por zona empresarial, alcance por rol, pendientes y alertas verificados en API y UI. |
| 29 | Completada | Reportes paginados/exportables de ventas, mermas y liquidaciones con filtros y alcance por rol. |
| 30 | Completada | Auditoría inmutable, filtrable, correlacionada y sanitizada con cobertura de eventos críticos. |
| 31 | Completada | Escaneo de seguridad y remediación: secretos obligatorios/rotados, puertos internos no publicados, rate limiting, límites JSON, cambio obligatorio de contraseña, revocación JWT inmediata, refresh serializado, aislamiento IndexedDB, TLS productivo y auditoría ampliada; pruebas y contenedores saludables. |
| 32 | Completada | Playwright ejecuta en Docker y base aislada los 28 pasos: configuración, catálogo, precios, vendedor, ruta, carga, venta online/offline, persistencia PWA, sincronización idempotente, revisiones, devolución, liquidación sin diferencias, PDF interno, Web Share, bloqueo FEL y controles HTTP. |
| 33 | Completada | Diagramas de contexto, arquitectura, componentes, casos de uso, operación, seguridad y sincronización actualizados; ERD PostgreSQL reconciliado 1:1 con las 54 tablas Flyway V1–V18 y ERD IndexedDB con sus 26 stores v2. |
| 34–39 | Planificadas | Se ejecutarán en orden y se actualizará esta tabla sin duplicar fases ni funciones. |
