# ERS/SRS — Sistema de control para distribuidora de agua pura

Versión: 1.0  
Fecha: 2026-08-10  
Estado: línea base inicial  
Fuente de alcance: `PROMPT_MAESTRO_SISTEMA_AGUA_PURA.md`

## 1. Propósito

Esta Especificación de Requisitos de Software define de forma verificable el comportamiento, restricciones, seguridad, datos e interfaces del sistema para una empresa purificadora de agua. Sus identificadores se utilizarán en casos de uso, código, API, migraciones, diagramas y pruebas.

Este es el único ERS/SRS del proyecto. Otros documentos deben referenciar sus identificadores y no crear requisitos funcionales paralelos.

## 2. Alcance

El producto será una aplicación web empresarial PWA, Mobile First y offline-first para administrar una única empresa dedicada a distribuir agua pura. Controlará la operación desde la preparación de una carga hasta la liquidación, separando la conciliación física de la financiera.

La solución incluirá un backend Spring Boot, un frontend React/TypeScript, PostgreSQL, IndexedDB, generación de comprobantes PDF y despliegue local mediante Docker Compose.

No se implementará multitenencia. FEL será una integración opcional que permanecerá desactivada mientras no exista un proveedor autorizado configurado.

## 3. Partes interesadas y actores

| Actor | Interés principal |
|---|---|
| Propietario/Administrador | Control financiero, inventario, configuración, seguridad y auditoría. |
| Bodega | Preparar y recibir cargas, verificar devoluciones y revisar mermas. |
| Vendedor | Operar su ruta y registrar ventas aun sin conexión. |
| Supervisor | Revisar excepciones, autorizaciones, alertas y liquidaciones. |
| Cliente | Recibir producto y comprobante digital. |
| Operaciones/Soporte | Instalar, respaldar, restaurar y monitorear el sistema. |
| Certificador FEL | Certificar DTE únicamente cuando exista integración habilitada. |

## 4. Definiciones y abreviaturas

| Término | Definición |
|---|---|
| PWA | Aplicación web progresiva instalable. |
| DTE | Documento Tributario Electrónico del régimen FEL de Guatemala. |
| FEL | Factura Electrónica en Línea. |
| Outbox | Cola durable de operaciones locales por sincronizar. |
| Idempotencia | Repetir una solicitud sin duplicar sus efectos. |
| Merma | Pérdida física de producto; no representa dinero. |
| Carga | Producto entregado por bodega a un vendedor para una ruta. |
| Recarga | Carga adicional entregada durante un recorrido ya iniciado; no crea otra ruta ni otra liquidación. |
| Liquidación | Cierre que compara carga, ventas, devoluciones, mermas y pagos. |
| Cliente provisional | Cliente creado offline y sujeto a revisión posterior. |
| Unidad base | Unidad mínima utilizada para contabilizar inventario. |
| Código operativo | Identificador asignado exclusivamente por el servidor para cliente, vendedor, ruta o vehículo. |

## 5. Contexto y límites

La PWA se comunica con una API REST. PostgreSQL conserva la información oficial y auditable. IndexedDB conserva el paquete de ruta autorizado, operaciones offline y resultados de sincronización. El Service Worker mantiene disponible el shell de la aplicación. Los archivos utilizan una abstracción de almacenamiento.

El servidor es autoritativo. La PWA puede calcular valores para informar al usuario, pero el backend recalcula precios, totales, crédito, permisos e inventario.

## 6. Supuestos y restricciones

- La empresa opera inicialmente como una sola organización.
- La moneda y zona horaria se definen en la configuración empresarial.
- El vendedor utiliza principalmente un teléfono, aunque la PWA funciona también en tablet y computadora.
- Una primera autenticación y la preparación del paquete de ruta requieren conexión.
- Las operaciones permitidas offline se limitan a reglas previamente descargadas.
- PostgreSQL es la base oficial; IndexedDB es almacenamiento local sincronizable.
- Todo importe usa decimal exacto.
- Toda modificación de PostgreSQL usa Flyway.
- La certificación FEL real exige un proveedor autorizado, credenciales válidas y su contrato técnico oficial.

## 7. Requisitos funcionales

### 7.1 Configuración empresarial

| ID | Requisito verificable | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-CFG-001 | El sistema administrará exactamente una configuración empresarial. | Alta | La API rechaza crear un segundo registro y no existe selector de empresa. |
| RF-CFG-002 | Administración podrá editar nombre comercial, razón social, NIT, dirección, teléfonos, WhatsApp, correo, logotipo, moneda, zona horaria, prefijos, numeraciones y texto autorizado. | Alta | Los campos se guardan desde un único formulario con validación y auditoría. |
| RF-CFG-003 | La interfaz y los comprobantes consumirán la misma configuración empresarial. | Alta | Un cambio autorizado se refleja sin duplicar datos en otro formulario. |
| RF-CFG-004 | Los cambios de identidad y numeración serán auditados. | Alta | Auditoría contiene actor, fecha y valores permitidos antes/después. |
| RF-CFG-005 | Políticas operativas, seguridad, sincronización y FEL tendrán configuraciones separadas de la identidad empresarial. | Media | Cada apartado aplica permisos propios sin copiar datos corporativos. |

### 7.2 Identidad, acceso y dispositivos

| ID | Requisito verificable | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-IAM-001 | El sistema autenticará usuarios activos mediante credenciales válidas. | Alta | Credenciales válidas crean sesión; inválidas no revelan qué dato falló. |
| RF-IAM-002 | Se implementarán los roles Administrador, Bodega, Vendedor y Supervisor. | Alta | La matriz de permisos cubre todos los casos de uso protegidos. |
| RF-IAM-003 | Administración podrá crear, desactivar y asignar roles sin modificar historial. | Alta | Un usuario desactivado no inicia ni renueva sesión. |
| RF-IAM-004 | Cada recurso verificará rol y propiedad/asignación. | Alta | Vendedor A recibe 403 al solicitar una venta de Vendedor B. |
| RF-IAM-005 | Los dispositivos se registrarán con UUID, usuario, nombre, primera/última actividad, versión y estado. | Alta | Un dispositivo nuevo queda registrado y trazable. |
| RF-IAM-006 | Administración podrá revocar un dispositivo. | Alta | Sus sesiones se revocan y no puede sincronizar. |
| RF-IAM-007 | La renovación rotará el refresh token y detectará reutilización. | Alta | Reutilizar un token revocado invalida la familia de sesión. |
| RF-IAM-008 | El administrador inicial se creará mediante bootstrap controlado. | Alta | No existe contraseña universal y se exige cambio cuando corresponda. |

### 7.3 Catálogo, presentaciones y precios

| ID | Requisito verificable | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-CAT-001 | Administración gestionará productos activos/inactivos sin borrar historial. | Alta | Desactivar impide nuevas operaciones y conserva ventas previas. |
| RF-CAT-002 | Cada producto utilizará unidad base, presentaciones y conversiones. | Alta | Venta, carga, devolución y merma se expresan correctamente en unidad base. |
| RF-PRI-001 | Usuarios autorizados gestionarán listas, versiones y tramos de precio. | Alta | Una modificación crea nueva versión y no cambia ventas anteriores. |
| RF-PRI-002 | El sistema resolverá precio por producto, presentación, cantidad, vigencia y cliente. | Alta | Los límites de tramo producen el precio esperado. |
| RF-PRI-003 | El backend recalculará el precio y total de toda venta. | Alta | Precio manipulado desde cliente es ignorado o rechazado. |
| RF-PRI-004 | Los precios especiales solo serán creados por roles autorizados. | Alta | El vendedor no puede enviar ni modificar un precio especial. |
| RF-PRI-005 | Los descuentos extraordinarios seguirán REQUESTED, APPROVED, REJECTED o EXPIRED. | Media | La venta solo consume una autorización vigente y aplicable. |
| RF-PRI-006 | No se solicitarán nuevos descuentos extraordinarios offline. | Alta | La PWA bloquea la acción y el backend rechaza intentos manipulados. |

### 7.4 Clientes, rutas y vehículos

| ID | Requisito verificable | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-CUS-001 | Administración gestionará clientes permanentes, estado, ruta y crédito. | Alta | Cambios válidos se persisten y auditan. |
| RF-CUS-002 | El vendedor registrará ventas a cliente ocasional con datos mínimos. | Alta | No se crea cliente permanente y no se concede crédito ni precio especial. |
| RF-CUS-003 | El vendedor podrá crear cliente provisional offline con UUID local. | Alta | El cliente persiste al cerrar la PWA y puede referenciarse en una venta. |
| RF-CUS-004 | El provisional seguirá PROVISIONAL_LOCAL, PENDING_SYNC, PENDING_REVIEW y una decisión final. | Alta | La venta permanece aunque el registro permanente sea rechazado o fusionado. |
| RF-CUS-005 | El sistema detectará posibles duplicados sin fusionarlos automáticamente. | Media | Coincidencias generan revisión y la fusión queda auditada. |
| RF-CUS-006 | El servidor asignará automáticamente el código de cada cliente con prefijo `CLI-` y numeración única. | Alta | Crear un cliente sin código devuelve un código `CLI-000001` (o el siguiente correlativo), sin aceptar uno impuesto desde el cliente. |
| RF-RTE-001 | Administración gestionará rutas sin borrar su historial. | Alta | Una ruta inactiva conserva asignaciones y recorridos previos. |
| RF-RTE-002 | Las asignaciones de vendedor, cliente y vehículo tendrán vigencia histórica. | Alta | Cambiar una asignación no sobrescribe la anterior. |
| RF-RTE-003 | Un vendedor solo descargará y operará sus rutas asignadas. | Alta | No recibe clientes ni inventario de otra ruta. |
| RF-RTE-004 | El servidor asignará automáticamente los códigos de vendedores, rutas y vehículos con prefijos `VND-`, `RUT-` y `VEH-`. | Alta | Los formularios no solicitan códigos y cada alta recibe un correlativo único. |

### 7.5 Inventario y carga

| ID | Requisito verificable | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-INV-001 | Todo cambio de inventario generará un movimiento inmutable. | Alta | El saldo puede explicarse por sus movimientos. |
| RF-INV-002 | El sistema mantendrá inventario por ubicación y por ruta en unidades base. | Alta | Conversiones de presentaciones no alteran el total físico. |
| RF-INV-003 | El sistema impedirá stock negativo. | Alta | Frontend avisa y backend rechaza venta que excede disponibilidad. |
| RF-LOD-001 | Bodega preparará una carga con ítems y cantidades. | Alta | La carga queda en estado preparado y auditable. |
| RF-LOD-002 | Bodega confirmará entrega y vendedor confirmará recepción por separado. | Alta | Se guardan ambos actores, fechas de servidor y dispositivos. |
| RF-LOD-003 | Una carga iniciada no podrá editarse silenciosamente. | Alta | Correcciones requieren movimiento compensatorio autorizado. |
| RF-LOD-004 | Bodega podrá registrar una recarga para una ruta con recorrido iniciado. | Alta | La recarga usa doble confirmación, mueve inventario, queda auditada y se incorpora a la liquidación de la carga inicial. |
| RF-LOD-005 | Una recarga no podrá iniciar un segundo recorrido ni registrarse después del cierre de la liquidación. | Alta | La API rechaza ambos casos y mantiene una sola liquidación por recorrido. |
| RF-LOD-006 | Confirmar la recepción de una carga inicial requerirá una ubicación puntual y registrará el inicio de ruta en la misma transacción. | Alta | Sin `location` válida la recepción se rechaza; una ruta conserva un único punto `START`. |

### 7.6 Ventas, pagos y crédito

| ID | Requisito verificable | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-SAL-001 | El vendedor registrará ventas con cliente, producto, presentación y cantidad. | Alta | Una venta confirmada contiene UUID, versión de precio, totales y propietario. |
| RF-SAL-002 | Venta, ítems, pago y movimientos se confirmarán en una transacción ACID. | Alta | Una falla revierte todos los efectos. |
| RF-SAL-003 | Una venta confirmada será inmutable. | Alta | No existen endpoints de edición o borrado; solo anulación autorizada. |
| RF-SAL-004 | El servidor asignará número oficial después de sincronizar y conservará referencia local. | Alta | Ambas referencias se consultan y no se duplican. |
| RF-SAL-005 | Confirmar una venta requerirá una ubicación puntual y la persistirá atómicamente con la venta. | Alta | Sin `location` válida no existe venta oficial; cada venta tiene exactamente un punto `SALE`. |
| RF-PAY-001 | El sistema admitirá efectivo, transferencia y crédito. | Alta | El total se distribuye entre medios válidos sin exceder la venta. |
| RF-PAY-002 | Las transferencias usarán PENDING_VERIFICATION, VERIFIED o REJECTED. | Alta | El vendedor no puede verificar su propia transferencia. |
| RF-CRD-001 | Crédito se permitirá solo a clientes autorizados dentro del límite disponible. | Alta | Operación que excede límite es rechazada transaccionalmente. |
| RF-CRD-002 | Clientes ocasionales y provisionales no usarán crédito. | Alta | Frontend no lo ofrece y backend lo rechaza. |

### 7.7 Mermas y devoluciones

| ID | Requisito verificable | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-WST-001 | El vendedor podrá reportar merma online u offline con tipo, cantidad y evidencia según política. | Alta | El reporte inicia pendiente y nunca aprobado automáticamente. |
| RF-WST-002 | La revisión admitirá aprobación total, parcial o rechazo. | Alta | Solo unidades aprobadas afectan conciliación física. |
| RF-WST-003 | El vendedor no aprobará su propia merma. | Alta | Intento por API responde 403 o 400 sin cambiar estado. |
| RF-WST-004 | La merma parcial registrará unidades dañadas y recuperables. | Alta | Dañar 3 unidades de un fardo de 24 no descuenta 24. |
| RF-WST-005 | El sistema generará indicadores y alertas de merma sospechosa sin concluir fraude automáticamente. | Media | La alerta conserva evidencia y requiere investigación humana. |
| RF-RET-001 | Producto no vendido, devolución de cliente, merma y faltante serán conceptos separados. | Alta | Cada operación usa entidad, movimiento y reporte correspondiente. |
| RF-RET-002 | Bodega confirmará físicamente las devoluciones recibidas. | Alta | La cantidad confirmada alimenta la conciliación y queda auditada. |

### 7.8 Liquidación y control antifraude

| ID | Requisito verificable | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-SET-001 | El sistema calculará diferencia física como carga menos ventas, devoluciones buenas y merma aprobada. | Alta | Los escenarios 100=60+38+2 y merma parcial producen resultados esperados. |
| RF-SET-002 | El sistema calculará diferencia monetaria independientemente de la física. | Alta | Venta Q600 y entrega Q400 produce faltante Q200 aun con merma. |
| RF-SET-003 | La liquidación mostrará fuentes y cálculos sin aceptar totales enviados por frontend. | Alta | La API deriva todos los importes de registros oficiales. |
| RF-SET-004 | No se cerrará definitivamente con operaciones offline pendientes o conflictos relevantes. | Alta | Cierre responde conflicto y enumera causas bloqueantes. |
| RF-SET-005 | Cerrar una liquidación la vuelve inmutable y auditable. | Alta | Un segundo cierre o modificación directa es rechazado. |

### 7.9 PWA y sincronización

| ID | Requisito verificable | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-SYN-001 | Antes de ruta, la PWA descargará solo datos autorizados y necesarios. | Alta | El paquete excluye rutas y clientes ajenos. |
| RF-SYN-002 | Datos y Outbox persistirán en IndexedDB al cerrar y reabrir. | Alta | Tres ventas offline continúan después del reinicio. |
| RF-SYN-003 | Cada operación crítica tendrá `clientOperationId` y `deviceId`. | Alta | La base rechaza la combinación duplicada como nuevo efecto. |
| RF-SYN-004 | Cambio local y entrada Outbox se guardarán atómicamente. | Alta | No existe venta local durable sin operación de sincronización. |
| RF-SYN-005 | El Sync Engine respetará dependencias. | Alta | Cliente provisional se sincroniza antes de su venta y pago. |
| RF-SYN-006 | El batch devolverá resultado por operación. | Alta | Un rechazo no marca exitosas ni fallidas las demás operaciones. |
| RF-SYN-007 | Repetir una operación devolverá el resultado original sin duplicar efectos. | Alta | Enviar cinco veces crea una venta, un pago y un movimiento. |
| RF-SYN-008 | Los reintentos usarán backoff exponencial y jitter. | Media | Fallas temporales no generan polling excesivo. |
| RF-SYN-009 | ConnectionManager verificará conectividad real mediante endpoint sin caché. | Alta | Distingue OFFLINE, DEGRADED y ONLINE sin depender solo de `navigator.onLine`. |
| RF-SYN-010 | El usuario verá estado y error de cada operación local. | Alta | La interfaz muestra PENDING, SYNCING, SYNCED, FAILED_RETRYABLE, CONFLICT o REJECTED. |
| RF-SYN-011 | El payload offline de una venta podrá conservar un snapshot opcional `location` para sincronizar el mismo contrato. | Alta | El snapshot permanece en la operación Outbox; no se crea un watcher, historial móvil de rastreo ni tarea de fondo. |

### 7.10 Comprobantes, FEL, reportes y auditoría

| ID | Requisito verificable | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-DOC-001 | Una venta sincronizada podrá generar un PDF con datos históricos y configuración empresarial. | Alta | El PDF contiene empresa, venta, ítems, total, pago y estado correctos. |
| RF-DOC-002 | La PWA compartirá mediante Web Share API y ofrecerá fallback seguro. | Alta | En navegador sin Web Share se puede descargar el PDF y preparar mensaje. |
| RF-DOC-003 | Un comprobante interno no se identificará como DTE certificado. | Alta | Documento sin certificación muestra su naturaleza interna. |
| RF-FEL-001 | FEL permanecerá desactivado sin adaptador real y credenciales válidas. | Alta | Intento de activación es rechazado y auditado. |
| RF-FEL-002 | Una integración FEL habilitada conservará solicitud, respuesta, identificadores, estado y DTE. | Alta | Cada emisión se rastrea hasta la venta y respuesta del certificador. |
| RF-REP-001 | Administración consultará dashboard y reportes por vendedor, ruta, cliente, producto, fecha, pago, merma y diferencia. | Media | Filtros retornan datos autorizados y paginados. |
| RF-REP-002 | Los reportes de ventas, mermas y liquidaciones se exportarán en Excel `.xlsx` y PDF imprimible. | Alta | Ambos formatos contienen identidad empresarial, filtros aplicados, datos autorizados y no omiten filas silenciosamente. |
| RF-ALT-001 | El sistema generará alertas configurables para diferencias y conductas anómalas. | Media | Cada alerta posee regla, severidad, evidencia y estado de atención. |
| RF-AUD-001 | Las acciones críticas producirán auditoría inmutable. | Alta | Eventos exigidos contienen actor, entidad, fecha, dispositivo y correlación. |

## 8. Reglas de negocio

| ID | Regla |
|---|---|
| RB-001 | El servidor es la autoridad para precio, total, permisos, crédito, stock y liquidación. |
| RB-002 | Una merma afecta solo la conciliación física. |
| RB-003 | Una merma pendiente o rechazada no cuadra inventario. |
| RB-004 | En aprobación parcial solo cuentan las unidades aprobadas. |
| RB-005 | El vendedor nunca aprueba su propia merma, descuento, transferencia o anulación restringida. |
| RB-006 | Una venta confirmada no se edita ni elimina. |
| RB-007 | No se borra físicamente información financiera, de inventario o auditoría. |
| RB-008 | Las conversiones a unidad base se aplican uniformemente en carga, venta, devolución y merma. |
| RB-009 | Un precio nuevo no modifica ventas históricas. |
| RB-010 | Un cliente provisional conserva sus ventas aunque su alta sea rechazada o fusionada. |
| RB-011 | No se concede crédito nuevo ni descuento extraordinario offline. |
| RB-012 | Una liquidación no cierra con operaciones locales que puedan modificarla. |
| RB-013 | La numeración interna no se usa como autorización fiscal FEL. |
| RB-014 | La configuración empresarial es la única fuente de identidad y datos para comprobantes. |

## 9. Requisitos de seguridad

| ID | Requisito | Criterio de aceptación |
|---|---|---|
| SEC-001 | Contraseñas con Argon2id y parámetros calibrados. | No hay texto plano ni hash expuesto; prueba de autenticación y migración pasa. |
| SEC-002 | Access token corto en memoria. | No aparece en localStorage, IndexedDB, URL o logs. |
| SEC-003 | Refresh token opaco, rotativo, hasheado y enviado en cookie segura. | Rotación y revocación se verifican en integración. |
| SEC-004 | Protección CSRF/origen para endpoints basados en cookie. | Solicitud desde origen no permitido es rechazada. |
| SEC-005 | RBAC más autorización por recurso. | Matriz y pruebas BOLA/IDOR pasan. |
| SEC-006 | CORS con allowlist y headers de seguridad. | Orígenes ajenos fallan y headers esperados están presentes. |
| SEC-007 | Rate limiting y bloqueo temporal de acceso. | Intentos excesivos producen 429/bloqueo sin afectar indefinidamente al usuario. |
| SEC-008 | Validación estricta de DTO, dominio y base. | Valores negativos, campos protegidos y formatos inválidos se rechazan. |
| SEC-009 | Archivos validados por MIME real, tamaño y extensión. | Archivo no permitido no se almacena. |
| SEC-010 | Logs y auditoría excluyen secretos y datos innecesarios. | Pruebas inspeccionan eventos representativos. |
| SEC-011 | Producción exige HTTPS, HSTS y cookies Secure. | Perfil de producción no inicia con configuración insegura. |
| SEC-012 | Credenciales FEL se protegen en backend. | Nunca se devuelven, registran ni incluyen en documentos. |
| SEC-013 | Un HTTP 401 de una sesión vigente intentará una sola renovación coordinada del access token y repetirá la solicitud original. | Solicitudes concurrentes comparten una renovación; si falla, se cierra la sesión y no se muestra como caída de PostgreSQL. |

## 10. Requisitos de datos

| ID | Requisito |
|---|---|
| DAT-001 | Entidades críticas usan UUID. |
| DAT-002 | Importes usan `BigDecimal`/`NUMERIC` con precisión y escala definidas. |
| DAT-003 | Fechas oficiales se almacenan en UTC y se presentan en la zona empresarial. |
| DAT-004 | PostgreSQL aplica PK, FK, NOT NULL, UNIQUE, CHECK e índices justificados. |
| DAT-005 | Flyway administra todos los cambios del esquema servidor. |
| DAT-006 | El ERD PostgreSQL corresponde a las migraciones aplicadas. |
| DAT-007 | IndexedDB se versiona mediante migraciones deterministas y recuperables. |
| DAT-008 | El ERD lógico móvil corresponde a object stores, keyPaths e índices reales. |
| DAT-009 | IndexedDB no almacena contraseñas ni refresh tokens. |
| DAT-010 | Evidencias grandes se guardan mediante abstracción de archivos, no en columnas PostgreSQL. |
| DAT-011 | Auditoría e historial financiero son inmutables. |
| DAT-012 | Backup PostgreSQL es independiente del volumen Docker. |
| DAT-013 | `route_tracking_point` es inmutable, aplica rangos geográficos y sólo permite una fila `START` por ruta y una `SALE` por venta. |

## 11. Interfaces externas

| ID | Interfaz | Requisito |
|---|---|---|
| INT-001 | API REST | JSON versionado, errores consistentes, paginación y OpenAPI. |
| INT-002 | Connectivity | Endpoint pequeño, con timeout y `Cache-Control: no-store`. |
| INT-003 | Sync batch | Resultados individuales e idempotentes por operación. |
| INT-004 | IndexedDB | Object stores documentados y migrados por versión. |
| INT-005 | Storage | Puerto para almacenamiento local y futuro object storage. |
| INT-006 | PDF | Documento descargable/compartible derivado de venta oficial. |
| INT-007 | WhatsApp | Web Share API o fallback; no API privada. |
| INT-008 | FEL | Adaptador específico de proveedor autorizado cuando se configure. |
| INT-009 | OpenAPI | Contratos, roles, errores e idempotencia documentados. |

## 12. Requisitos no funcionales

| ID | Requisito verificable | Criterio de aceptación |
|---|---|---|
| RNF-001 | Mobile First y responsive. | Flujos críticos funcionan en teléfono, tablet y escritorio. |
| RNF-002 | Instalable como PWA. | Manifiesto y Service Worker pasan validación funcional. |
| RNF-003 | Operación offline durable. | Cerrar/reabrir no pierde operaciones confirmadas localmente. |
| RNF-004 | Accesibilidad operativa. | Formularios usan etiquetas, foco, contraste y objetivos táctiles adecuados. |
| RNF-005 | Rendimiento de API. | Consultas comunes usan paginación e índices medidos. |
| RNF-006 | Integridad transaccional. | Fallos parciales no dejan ventas o pagos incompletos. |
| RNF-007 | Auditabilidad. | Toda operación crítica puede reconstruirse con referencias. |
| RNF-008 | Mantenibilidad modular. | Dependencias respetan Clean Architecture y no duplican reglas. |
| RNF-009 | Instalación reproducible. | `docker compose up -d --build` inicia servicios saludables. |
| RNF-010 | Recuperación. | Procedimientos de backup y restore se ejecutan y verifican. |
| RNF-011 | Observabilidad. | Logs estructurados incluyen correlationId sin secretos. |
| RNF-012 | Compatibilidad. | Navegadores modernos soportados ejecutan el flujo online; mejoras offline se degradan de forma segura. |

## 13. Contrato de errores

La API devolverá un formato consistente:

```json
{
  "code": "BUSINESS_ERROR_CODE",
  "message": "Mensaje seguro",
  "correlationId": "uuid",
  "timestamp": "UTC",
  "fieldErrors": []
}
```

No se devolverán stack traces. Los códigos permitirán distinguir validación, autenticación, autorización, inexistencia, conflicto, rate limit y error interno.

## 14. Criterios de aceptación del sistema

Los escenarios 1 a 12 de las secciones 145 a 156 del prompt maestro son obligatorios. Además:

1. La configuración empresarial se captura una vez y alimenta interfaz y PDF.
2. El ERD PostgreSQL coincide con Flyway.
3. El ERD móvil coincide con la versión real de IndexedDB.
4. La misma operación enviada cinco veces produce un único efecto.
5. Un comprobante interno nunca se presenta como DTE certificado.
6. FEL no se activa sin proveedor real y credenciales verificadas.

## 15. Trazabilidad

| Rango | Casos de uso/módulo | Evidencia principal |
|---|---|---|
| RF-CFG | Configuración empresarial | Pruebas de API, formulario, auditoría y PDF. |
| RF-IAM / SEC | Inicio de sesión, usuarios y dispositivos | Pruebas unitarias, integración y seguridad. |
| RF-CAT / RF-PRI | Productos, presentaciones y precios | Pruebas de dominio y API. |
| RF-CUS / RF-RTE | Clientes y rutas | Casos CU-007, CU-008, CU-018 y autorización por objeto. |
| RF-INV / RF-LOD | Inventario y carga | CU-002, CU-003 y pruebas de concurrencia. |
| RF-SAL / RF-PAY / RF-CRD | Venta y cobro | CU-005, CU-006, CU-016 y E2E. |
| RF-WST / RF-RET | Merma y devolución | CU-009, CU-010, CU-011 y antifraude. |
| RF-SET | Liquidación | CU-013 y escenarios de diferencia. |
| RF-SYN | Sincronización | CU-012, pruebas IndexedDB e idempotencia. |
| RF-DOC / RF-FEL | PDF, WhatsApp y FEL | CU-014 y pruebas de proveedor/estado. |
| RF-REP / RF-ALT / RF-AUD | Reportes, alertas y auditoría | Pruebas de consulta, permisos y eventos. |
| DAT | PostgreSQL e IndexedDB | Flyway, migraciones móviles y ambos ERD. |
| RNF | Plataforma completa | CI, Docker, E2E, seguridad y recuperación. |

Cada caso de uso, endpoint, migración y prueba futura deberá declarar los identificadores que satisface. Una matriz automatizable se mantendrá durante la implementación sin copiar la redacción completa de este documento.
