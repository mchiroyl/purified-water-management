# Diseño del sistema de control para distribuidora de agua pura

Fecha: 2026-08-10  
Estado: sustituido como fuente de requisitos por el prompt maestro unificado
Tipo de solución: monolito modular para una sola empresa

> Este documento conserva el razonamiento arquitectónico histórico. La única fuente canónica para planificar e implementar es `PROMPT_MAESTRO_SISTEMA_AGUA_PURA.md`.

## 1. Propósito

Construir un sistema real, verificable y ejecutable localmente para controlar ventas, rutas, inventario, pagos, mermas y liquidaciones de una purificadora de agua. La solución debe reducir fugas de producto y dinero sin depender únicamente de lo declarado por el vendedor.

El sistema será completamente digital. La experiencia principal del vendedor será una PWA instalada en el teléfono, con trabajo offline y sincronización posterior. Los comprobantes serán archivos PDF digitales que podrán compartirse mediante las capacidades oficiales del dispositivo, incluido WhatsApp cuando esté disponible.

## 2. Alcance de la solución

La solución incluirá:

- Configuración e identidad de una única empresa.
- Usuarios, roles, vendedores, dispositivos y sesiones.
- Clientes permanentes, ocasionales y provisionales.
- Productos, unidades, presentaciones y conversiones.
- Listas, versiones, tramos y precios especiales.
- Rutas, asignaciones y cargas con doble confirmación.
- Inventario general y de ruta mediante movimientos inmutables.
- Ventas, pagos, transferencias y crédito autorizado.
- Devoluciones, mermas, evidencias y revisiones.
- Conciliación física, conciliación financiera y liquidaciones.
- Operación offline, sincronización, idempotencia y conflictos.
- Anulaciones, autorizaciones, incidencias y auditoría.
- Dashboard, alertas, reportes y comprobantes PDF.
- Configuración FEL opcional y preparada para un proveedor real.
- Docker, pruebas automáticas, documentación y diagramas.

## 3. Arquitectura seleccionada

Se utilizará un monolito modular. Esta opción conserva transacciones fuertes para ventas, pagos e inventario, simplifica la operación local y evita la complejidad prematura de microservicios.

### 3.1 Servicios de ejecución

Docker Compose ejecutará tres servicios principales:

1. `postgres`: PostgreSQL con volumen persistente y healthcheck.
2. `backend`: API Java/Spring Boot con Flyway y healthcheck.
3. `frontend`: compilación React/PWA servida por Nginx y dependiente de la salud del backend.

El almacenamiento local de logotipos y evidencias se montará en un volumen separado. La abstracción permitirá cambiar a almacenamiento de objetos en producción sin modificar los casos de uso.

### 3.2 Backend

El código seguirá la estructura requerida:

```text
domain/
application/
infrastructure/
presentation/
```

Cada capa tendrá subpaquetes por módulo. Las dependencias apuntarán hacia el dominio: presentación invoca aplicación; aplicación coordina dominio; infraestructura implementa puertos definidos hacia el interior.

Los módulos serán:

- Auth y sesiones.
- Configuración empresarial.
- Usuarios, vendedores, roles y dispositivos.
- Productos, unidades y presentaciones.
- Precios y autorizaciones comerciales.
- Clientes y rutas.
- Inventario y cargas.
- Ventas y pagos.
- Crédito y transferencias.
- Mermas y devoluciones.
- Liquidaciones.
- Sincronización e idempotencia.
- Auditoría, alertas y reportes.
- PDF y FEL.

### 3.3 Frontend

React y TypeScript se organizarán por funcionalidades. La aplicación utilizará:

- TanStack Query para estado remoto.
- React Hook Form y Zod para formularios.
- Cliente HTTP centralizado y errores tipados.
- IndexedDB para datos de ruta y Outbox.
- Service Worker para instalación, shell offline y actualización controlada.
- ConnectionManager para conectividad real.
- Sync Engine independiente para ordenar y enviar operaciones.

La PWA no será autoritativa: sus cálculos mejoran la experiencia, pero el backend recalcula y valida toda operación.

## 4. Límites de los módulos

Cada módulo tendrá una responsabilidad y contratos explícitos:

- **Configuración empresarial:** mantiene la identidad única utilizada por interfaz y documentos.
- **Pricing:** resuelve precios vigentes y devuelve la versión y regla aplicadas.
- **Inventory:** registra movimientos y comprueba disponibilidad en unidades base.
- **Sales:** confirma ventas inmutables coordinando precio, stock y pago.
- **Waste:** registra pérdidas físicas y administra revisiones independientes.
- **Settlement:** consume resultados de ventas, pagos, devoluciones y mermas aprobadas sin alterar sus fuentes.
- **Synchronization:** valida identidad de dispositivo, idempotencia, dependencias y resultados de lote.
- **Auditing:** recibe eventos de negocio sin exponer secretos.
- **PDF:** genera comprobantes desde ventas sincronizadas y configuración empresarial.
- **FEL:** define configuración y contrato de proveedor sin alterar el comprobante interno.

Los módulos se comunicarán mediante servicios de aplicación y eventos internos posteriores a la confirmación de transacciones. No accederán directamente a tablas ajenas para implementar reglas de negocio.

## 5. Configuración empresarial

Existirá un único registro de empresa y un único menú `Configuración → Datos de la empresa`. El formulario se dividirá visualmente en secciones, pero se guardará como una sola configuración coherente.

Contendrá:

- Nombre comercial y razón social.
- NIT.
- Dirección.
- Teléfonos, WhatsApp y correo.
- Logotipo.
- Moneda.
- Zona horaria.
- Prefijos y secuencias de comprobantes.
- Información adicional autorizada para documentos.

Este registro será la única fuente de verdad para encabezados, datos visibles y comprobantes PDF. No existirá otro formulario con copias de la misma información.

Las políticas de negocio, seguridad, sincronización y FEL estarán en menús distintos porque requieren permisos y ciclos de cambio diferentes.

## 6. Modelo de dominio y persistencia

### 6.1 Identificadores y fechas

Las entidades de negocio utilizarán UUID. El servidor trabajará en UTC. La interfaz convertirá a la zona configurada. Las operaciones offline conservarán hora local, hora de recepción y hora de sincronización sin confiar exclusivamente en el reloj del dispositivo.

### 6.2 Dinero

Java utilizará `BigDecimal` y PostgreSQL `NUMERIC` con precisión y escala explícitas. No se utilizarán `float` ni `double` para importes.

### 6.3 Inmutabilidad

Ventas, pagos, liquidaciones, mermas, revisiones, movimientos de inventario y auditoría no tendrán borrado físico. Las correcciones requerirán anulaciones o transacciones compensatorias autorizadas.

### 6.4 Inventario

El inventario se derivará de un libro de movimientos. Los saldos podrán materializarse para consulta, pero cada cambio deberá estar respaldado por un movimiento referenciado.

Productos y presentaciones se convertirán a unidades base. Una merma parcial de una presentación registrará las unidades realmente dañadas y las recuperables.

### 6.5 Entidades principales

La persistencia incluirá, con divisiones adicionales cuando sirvan a las restricciones:

- Usuario, rol, sesión renovable, dispositivo y vendedor.
- Empresa y configuración operativa.
- Ruta, asignación de ruta y recorrido.
- Cliente, asignación, cuenta de crédito y movimientos.
- Producto, unidad, presentación y conversión.
- Lista de precios, versión, tramo y precio especial.
- Inventario, movimiento, carga e ítems de carga.
- Venta, ítems, pago y transferencia.
- Devolución e ítems.
- Merma, tipo, ítems, evidencia y revisión.
- Liquidación, entrega de efectivo y diferencias.
- Incidencia, autorización y solicitud de anulación.
- Operación de sincronización y auditoría.

Flyway creará todas las tablas, restricciones, índices y datos técnicos mínimos. Hibernate validará el esquema y no lo generará en producción.

## 7. Flujo de ruta y venta

El recorrido tendrá la siguiente secuencia:

1. Bodega prepara la carga.
2. Bodega confirma la entrega.
3. El vendedor confirma la recepción desde su dispositivo.
4. El vendedor inicia la ruta y descarga el paquete offline autorizado.
5. Registra ventas, pagos, devoluciones y reportes de merma.
6. Finaliza el recorrido sin cerrar la liquidación.
7. Bodega recibe el producto bueno devuelto y revisa el producto dañado.
8. El sistema calcula conciliaciones.
9. Los roles autorizados resuelven revisiones y diferencias.
10. La liquidación se cierra de forma inmutable.

Al confirmar una venta, el backend volverá a resolver precio, versión, regla, crédito y stock. Venta, ítems, pago y movimientos se guardarán en una única transacción. Si una parte falla, toda la operación se revertirá.

## 8. Conciliación antifraude

La conciliación física será:

```text
Carga inicial
- Unidades vendidas
- Producto bueno devuelto
- Merma aprobada
= Diferencia física
```

La conciliación financiera será:

```text
Efectivo esperado
- Efectivo entregado
= Diferencia monetaria
```

Transferencias verificadas y créditos autorizados se presentarán por separado y se considerarán según su estado. Una transferencia declarada por el vendedor no se considerará verificada.

Una merma:

- Afecta solamente la conciliación física.
- Nunca cambia una venta ni el efectivo esperado.
- No cuenta mientras esté sin revisar.
- Cuenta únicamente por las unidades aprobadas cuando la aprobación es parcial.
- No puede ser aprobada por el vendedor que la reportó.

La liquidación no podrá cerrarse definitivamente cuando existan operaciones offline sin sincronizar o conflictos que puedan cambiar sus resultados.

## 9. Operación offline

Antes de iniciar la ruta, el vendedor descargará solo:

- Su recorrido y clientes autorizados.
- Productos, presentaciones y conversiones necesarias.
- Carga e inventario asignado.
- Precios y versiones vigentes.
- Precios especiales y límites de crédito autorizados.
- Configuración mínima para operar.

IndexedDB almacenará el paquete, ventas locales, evidencias y Outbox. Los datos sensibles innecesarios no se descargarán.

Se permitirán offline:

- Ventas con precio y stock descargados.
- Efectivo.
- Transferencias en estado de verificación.
- Clientes ocasionales y provisionales.
- Mermas pendientes de revisión.
- Devoluciones autorizadas por las reglas descargadas.

No se permitirán offline nuevos créditos, descuentos extraordinarios, aprobaciones, validación de transferencias ni cambios administrativos.

## 10. Sincronización e idempotencia

Cada operación tendrá:

- `clientOperationId` UUID.
- `deviceId`.
- Tipo de entidad y operación.
- Payload validado.
- Fecha local.
- Estado, reintentos y último error.
- Dependencias de otras operaciones.

Los cambios de negocio locales y su registro de Outbox se escribirán en una sola transacción IndexedDB. El Sync Engine ordenará las dependencias y enviará lotes pequeños.

El backend impondrá una unicidad equivalente a `device_id + client_operation_id`. Procesará cada operación en su propia frontera transaccional y almacenará el resultado. Un reenvío devolverá el resultado existente sin repetir efectos.

Las respuestas individuales serán:

- `ACCEPTED`.
- `ALREADY_PROCESSED`.
- `REJECTED`.
- `CONFLICT`.
- `RETRY`.

El frontend reflejará `PENDING`, `SYNCING`, `SYNCED`, `FAILED_RETRYABLE`, `CONFLICT` o `REJECTED`. Los reintentos usarán backoff exponencial con jitter y se activarán al abrir, volver al primer plano, recuperar conexión o solicitar sincronización manual.

ConnectionManager usará eventos del navegador como señales y confirmará el estado mediante `/api/connectivity` con timeout y `Cache-Control: no-store`.

## 11. Seguridad

### 11.1 Autenticación

- Contraseñas codificadas con Argon2id.
- Access token JWT corto y conservado en memoria.
- Refresh token opaco, rotativo y almacenado como hash en servidor.
- Cookie de renovación `Secure`, `HttpOnly` y `SameSite`.
- Protección de origen y CSRF en endpoints que utilizan cookie.
- Revocación por sesión, usuario y dispositivo.
- Detección de reutilización que invalida la familia de sesión.

Los tiempos de sesión serán configurables dentro de límites seguros. La configuración de desarrollo permitirá HTTP local; producción exigirá HTTPS.

### 11.2 Autorización

RBAC se combinará con autorización por objeto. Cada caso de uso comprobará rol, estado, ruta, vendedor, dispositivo y propiedad del recurso. Conocer un UUID no concederá acceso.

Los DTO de entrada no expondrán campos protegidos como rol, precio final, total calculado, estado aprobado o propietario. El servidor derivará esos valores.

### 11.3 Protección de plataforma

- CORS por allowlist.
- Rate limiting general y específico para autenticación.
- Bloqueo temporal por intentos fallidos.
- Límites de cuerpo y archivos.
- Validación de MIME real, extensión y tamaño.
- CSP, HSTS y encabezados de seguridad en producción.
- Consultas parametrizadas mediante JPA y repositorios controlados.
- Validaciones en formulario, DTO, dominio y base de datos.

### 11.4 Auditoría

La auditoría registrará usuario, acción, entidad, identificador, cambios relevantes, fecha del servidor, dispositivo y `correlationId`. No almacenará contraseñas, tokens, claves, evidencias completas ni datos personales innecesarios.

## 12. Manejo de errores y concurrencia

Los errores REST usarán un contrato estable:

```json
{
  "code": "BUSINESS_ERROR_CODE",
  "message": "Mensaje seguro y comprensible",
  "correlationId": "uuid",
  "timestamp": "fecha UTC",
  "fieldErrors": []
}
```

No se devolverán stack traces. Los errores de validación distinguirán campos; los conflictos de estado devolverán un código que permita recargar o conciliar.

Se empleará bloqueo optimista para ediciones administrativas normales. Inventario, crédito, numeraciones, revisiones y cierre de liquidaciones usarán el mecanismo de bloqueo apropiado para impedir doble consumo o doble aprobación. Las operaciones críticas serán ACID.

## 13. Experiencia de usuario

### 13.1 Vendedor

La navegación móvil inferior incluirá Inicio, Ruta, Nueva venta, Pendientes y Perfil. El inicio mostrará inventario, ventas del día, conexión y sincronización. Las operaciones críticas mostrarán un resumen previo a la confirmación.

### 13.2 Bodega

Las pantallas de carga, recepción, devoluciones y mermas estarán optimizadas para teléfono y tablet. La doble confirmación mostrará usuario, dispositivo, cantidades y hora del servidor.

### 13.3 Administración y supervisión

Usarán menú lateral adaptable con dashboard, catálogos, rutas, inventario, revisiones, liquidaciones, reportes, auditoría y configuración.

### 13.4 Estados visibles

La conexión será persistente y discreta. Cada operación mostrará si está pendiente, sincronizando, sincronizada, en conflicto o rechazada, con explicación y acciones seguras. Una venta confirmada no tendrá edición ni eliminación directa.

## 14. Comprobantes PDF, WhatsApp y FEL

Los comprobantes internos se generarán después de que la venta esté sincronizada y tenga número oficial. Usarán directamente la configuración empresarial aprobada y los datos históricos de la venta.

La PWA intentará compartir el archivo mediante Web Share API. Cuando no esté disponible, ofrecerá descarga del PDF y apertura de WhatsApp con un mensaje preparado, sin depender de APIs privadas.

FEL será opcional. La configuración incluirá estado, proveedor y referencia segura a credenciales. Como no hay certificador seleccionado:

- FEL estará desactivado de forma predeterminada.
- La interfaz impedirá activarlo sin un adaptador real y credenciales válidas.
- No se presentará un comprobante interno como documento fiscal certificado.
- La selección futura del certificador originará un adaptador probado contra su contrato oficial.

## 15. Pruebas

### 15.1 Backend

- Pruebas unitarias de precios, inventario, ventas, crédito, mermas y liquidaciones.
- Pruebas de autorización, manipulación de campos y propiedad de recursos.
- Pruebas de integración PostgreSQL con Testcontainers.
- Pruebas de idempotencia, concurrencia y transacciones.

### 15.2 Frontend

- Componentes y formularios.
- Validaciones.
- IndexedDB y Outbox.
- ConnectionManager.
- Sync Engine, dependencias, reintentos y conflictos.
- Persistencia tras cerrar y reabrir la PWA.

### 15.3 E2E y seguridad

Playwright recorrerá los escenarios principales del prompt maestro. Se comprobarán expresamente:

- Diferencia monetaria independiente de mermas.
- Aprobación parcial de merma.
- Reenvío idempotente.
- Manipulación de precio, total, rol y estado.
- Aislamiento entre vendedores.
- Persistencia y sincronización offline.
- Bloqueo de liquidación con operaciones locales.
- Generación y compartición de comprobante.

## 16. Documentación y diagramas

El repositorio contendrá requisitos trazables, reglas de negocio, permisos, casos de uso, arquitectura, API, seguridad, instalación, operación, desarrollo, backup y restauración.

Los diagramas se mantendrán en Mermaid o PlantUML y abarcarán contexto, casos de uso, componentes, capas, ERD, dominio, secuencias, actividades, estados, despliegue y sincronización.

El manual de usuario se completará con capturas obtenidas del sistema funcional. Los comandos de instalación y recuperación se verificarán antes de publicarse.

## 17. Estrategia de entrega

El trabajo se dividirá en fases acumulativas. Cada fase deberá cumplir:

1. Código compilado.
2. Pruebas de la fase aprobadas.
3. Revisión de seguridad correspondiente.
4. Documentación y diagramas actualizados.
5. Ausencia de errores conocidos dentro del alcance de la fase.

El sistema completo no se declarará terminado hasta ejecutar pruebas backend, frontend, integración, E2E, construcción Docker, arranque de Compose, migraciones y escenarios finales de aceptación.

## 18. Decisiones explícitas

- Una sola empresa; no se implementará multitenencia.
- Monolito modular; no se implementarán microservicios.
- PostgreSQL será la base de datos de producción y pruebas de integración.
- El comprobante interno es independiente de FEL.
- FEL no podrá activarse sin un proveedor real.
- La identidad empresarial tendrá una única fuente de verdad.
- Las dos conciliaciones nunca se combinarán.
- El vendedor nunca aprobará sus propias operaciones restringidas.
- El servidor será autoritativo aun cuando una operación se origine offline.

## 19. Criterio de aceptación del diseño

Este diseño se considera satisfecho cuando la implementación cumple los escenarios del prompt maestro, puede levantarse mediante Docker Compose desde una computadora nueva siguiendo la guía local y no requiere datos simulados permanentes ni configuraciones ocultas.
