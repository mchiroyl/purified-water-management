# Análisis inicial del proyecto

Fecha: 2026-08-10  
Proyecto: Sistema de control para distribuidora de agua pura

## 1. Estado del repositorio

La carpeta de trabajo contiene únicamente `PROMPT_MAESTRO_SISTEMA_AGUA_PURA.md`. No existe código fuente, configuración, documentación adicional, pruebas, contenedores ni historial Git previo.

Por lo tanto, el sistema se construirá desde cero. No hay componentes técnicos reutilizables ni migraciones que deban conservarse. El prompt maestro sí se conserva como fuente principal de requisitos.

## 2. Alcance identificado

El documento exige una aplicación empresarial para una sola purificadora, compuesta por:

- Backend Java y Spring Boot con Clean Architecture.
- Frontend React y TypeScript como PWA Mobile First y offline-first.
- PostgreSQL administrado mediante Flyway.
- Seguridad con JWT, sesiones renovables, RBAC y autorización por recurso.
- Control de usuarios, vendedores, clientes, rutas, productos y presentaciones.
- Precios versionados, inventario, cargas, ventas, pagos y crédito.
- Clientes ocasionales y provisionales creados sin conexión.
- Sincronización idempotente mediante Outbox y operaciones UUID.
- Mermas, devoluciones y liquidaciones con conciliación física y financiera separadas.
- Auditoría, reportes, dashboard, alertas y comprobantes PDF.
- Infraestructura Docker, pruebas automáticas, diagramas y manuales.

## 3. Regla central del negocio

El sistema debe determinar de forma independiente lo recibido, vendido, devuelto y entregado por el vendedor. Una merma afecta únicamente el inventario físico y nunca reduce el efectivo esperado.

Las fórmulas base son:

```text
Carga inicial
- Unidades vendidas
- Producto bueno devuelto
- Merma aprobada
= Diferencia física
```

```text
Efectivo esperado
- Efectivo entregado
= Diferencia monetaria
```

Las dos conciliaciones se calculan y presentan por separado.

## 4. Decisiones confirmadas con el usuario

- El sistema será para una sola empresa purificadora.
- Los datos empresariales serán configurables y no estarán escritos directamente en el código.
- Nombre, identidad, NIT, contacto, logotipo, moneda, zona horaria y numeraciones estarán en un único formulario de configuración empresarial.
- Esa configuración será la única fuente de datos corporativos para la interfaz y los comprobantes.
- La arquitectura seleccionada es un monolito modular desplegado con Docker Compose.

## 5. Condiciones técnicas y de integridad

- El servidor será autoritativo para precios, permisos, crédito, inventario y totales.
- Ventas, pagos, liquidaciones, movimientos de inventario y auditoría serán inmutables.
- Las correcciones se realizarán mediante anulaciones autorizadas o movimientos compensatorios.
- Cada operación offline crítica tendrá un UUID y procesamiento idempotente.
- Una ruta no podrá cerrarse definitivamente mientras existan operaciones locales sin sincronizar.
- Los importes usarán `BigDecimal` en Java y `NUMERIC` en PostgreSQL.
- Todo cambio de esquema se realizará mediante Flyway.
- La información descargada a cada vendedor se limitará a sus rutas y recursos autorizados.

## 6. Riesgos principales

### Sincronización offline

Es el riesgo técnico más alto. Se mitigará con Outbox transaccional en IndexedDB, dependencias explícitas, lotes pequeños, idempotencia en servidor, resultados por operación y reintentos controlados.

### Integridad concurrente

Ventas simultáneas, crédito, inventario y revisiones requieren control de concurrencia. Se usarán transacciones y bloqueos optimistas o pesimistas según la operación.

### Autorización por recurso

Los roles no son suficientes. Cada consulta o comando debe verificar vendedor, ruta, cliente, dispositivo y propiedad del recurso para evitar BOLA/IDOR.



### Alcance

El proyecto contiene múltiples subsistemas. Se desarrollará por fases integradas, verificando cada fase antes de avanzar y manteniendo funcional el conjunto acumulado.

## 7. Estrategia de construcción

Se seguirá un monolito modular con límites claros por capacidad de negocio. El núcleo antifraude, la seguridad, el modelo transaccional y los contratos de sincronización se diseñarán primero. Las interfaces administrativas y móviles consumirán los mismos casos de uso del backend.

Cada fase incluirá código, pruebas, revisión de seguridad, actualización documental y verificación ejecutable. No se considerará terminada una función que solo exista visualmente o que dependa de datos simulados permanentes.

## 8. Resultado del análisis

No existe impedimento técnico local para comenzar la planificación. Los requisitos y decisiones confirmadas están unificados en `PROMPT_MAESTRO_SISTEMA_AGUA_PURA.md`, que es la única fuente canónica. El documento de diseño conserva únicamente contexto histórico. La implementación requiere un plan detallado que utilice exactamente las fases 0 a 39 del prompt maestro.

## 9. Análisis de conectividad, operación móvil y resiliencia sin energía eléctrica

### 9.1. Evaluación ética, profesional y operativa de dispositivos por rol

| Rol | Dispositivo Principal | Conectividad | Veredicto y Justificación Profesional |
|---|---|---|---|
| **Vendedor (Ruta)** | **Smartphone (Android / iOS)** | Datos Móviles + **Offline-First** | **Indispensable**: El vendedor opera en camión, bajando garrafones y cobrando en calle. El teléfono es su punto de venta móvil (POS). Debe funcionar con total autonomía tanto si no hay señal celular como si los comercios no tienen energía eléctrica. |
| **Administrador** | **Laptop / Computadora** | Datos Compartidos (**Hotspot**) o Red Fija | **Opción más segura y profesional**: El administrador audita liquidaciones masivas, concilia arqueos de caja, inventarios globales y anulaciones. Trabajar exclusivamente en 6 pulgadas eleva la fatiga visual y el riesgo de toques accidentales críticos. |
| **Administrador (Móvil)** | **Smartphone (PWA Responsiva)** | Datos Móviles | **Respaldo de emergencia (*Failover*)**: La interfaz web progresiva es 100% responsiva, permitiendo autorizar créditos, consultar saldos de garrafones o verificar ventas urgentes desde el celular cuando se encuentre fuera de la oficina. |

### 9.2. Resiliencia en la nube ante cortes de energía ("Sin Luz")

- **Infraestructura Cloud**: El backend (Render), la base de datos (PostgreSQL) y el frontend (Vercel) se encuentran en centros de datos internacionales de alta disponibilidad con generadores propios y redundancia.
- **Continuidad ante apagones locales**:
  - Si se corta la energía eléctrica en la purificadora o municipio, **el servidor en la nube no se apaga ni sufre interrupciones**.
  - El administrador puede encender su laptop (cuya batería ofrece horas de autonomía), activar la función de **"Zona WiFi / Compartir Datos Móviles (Hotspot)"** en su teléfono y seguir trabajando en la laptop con pantalla completa y teclado sin depender del tendido eléctrico local.

## 10. Especificación técnica: Descarga de catálogos offline (`Route Package`)

### 10.1. Diagnóstico del problema con señal inestable (1 a 2 barritas)

El mayor riesgo operativo en campo no es la desconexión total (donde el navegador falla en 5 ms), sino las zonas con 1 o 2 barritas de señal celular:
- `navigator.onLine` reporta falsamente que hay conexión.
- Múltiples llamadas HTTP individuales (`/customers`, `/products`, `/pricing`, `/route-loads`) se quedan colgadas de 30 a 60 segundos, congelando la pantalla del vendedor.
- Los reintentos sin idempotencia provocan ventas duplicadas y descuadres de inventario.

### 10.2. Solución: Paquete Atómico de Ruta Diario (`GET /api/v1/sync/route-package/{routeId}`)

En lugar de múltiples llamadas concurrentes dispersas, el sistema implementa un paquete único comprimido (< 150 KB) que se descarga al iniciar la jornada o seleccionar ruta:

1. **Contenido del Paquete**:
   - Clientes asignados a la ruta del vendedor (con límites de crédito, contacto y saldo de garrafones prestados).
   - Catálogo de productos y presentaciones activas.
   - Precios estándar por tramos de mayoreo y precios especiales vinculados a los clientes de la ruta.
   - Carga inicial de inventario confirmada en el camión.
2. **Almacenamiento Local Atómico en IndexedDB**:
   - El frontend consume el paquete mediante la función `replaceRoutePackage(...)` en [`mobileDatabase.ts`](file:///d:/UMG/Purificadora/frontend/src/offline/mobileDatabase.ts).
   - Los formularios de venta ([`SalesPage.tsx`](file:///d:/UMG/Purificadora/frontend/src/features/sales/SalesPage.tsx)) y garrafones leen directamente de IndexedDB en menos de 15 ms, garantizando fluidez de 60 fps sin bloqueos de red.
3. **Indicador Visual de Certeza Operativa (`/impeccable`)**:
   - Encabezado con estado del catálogo: `📦 Catálogo de Ruta: Actualizado hoy a las 07:15 AM (142 clientes)`.
   - Botón de refresco manual con icono 🔄 para sincronizar cuando se recupere buena señal.
   - Selector visual de conectividad: `[ Conectado (Online) ]` y `[ Sin Señal (Modo Local) ]`.
4. **Optimización de Base de Datos PostgreSQL (`/supabase-postgres-best-practices`)**:
   - Índices compuestos para ensamblar el paquete en < 50 ms:
     - `CREATE INDEX idx_customer_route_active ON customer(route_id, is_active) WHERE is_active = true;`
     - `CREATE INDEX idx_special_price_customer_status ON special_price(customer_id, status) WHERE status = 'ACTIVE';`
   - Protección de idempotencia absoluta contra duplicados en reintentos móviles:
     - `CREATE UNIQUE INDEX uq_sale_device_client_reference ON sale(device_id, client_reference);`

