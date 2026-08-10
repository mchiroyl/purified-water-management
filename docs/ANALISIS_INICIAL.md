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
- La facturación FEL se considerará una capacidad opcional.
- No existe todavía un certificador FEL seleccionado.
- Mientras no se contrate y configure un proveedor, FEL permanecerá desactivado y los comprobantes internos PDF seguirán funcionando.
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

### FEL

No puede implementarse una certificación real sin definir un certificador, credenciales y contrato técnico. El sistema incluirá configuración, estados y un contrato de integración, pero bloqueará la activación mientras no exista un adaptador de proveedor real.

### Alcance

El proyecto contiene múltiples subsistemas. Se desarrollará por fases integradas, verificando cada fase antes de avanzar y manteniendo funcional el conjunto acumulado.

## 7. Estrategia de construcción

Se seguirá un monolito modular con límites claros por capacidad de negocio. El núcleo antifraude, la seguridad, el modelo transaccional y los contratos de sincronización se diseñarán primero. Las interfaces administrativas y móviles consumirán los mismos casos de uso del backend.

Cada fase incluirá código, pruebas, revisión de seguridad, actualización documental y verificación ejecutable. No se considerará terminada una función que solo exista visualmente o que dependa de datos simulados permanentes.

## 8. Resultado del análisis

No existe impedimento técnico local para comenzar la planificación. Los requisitos y decisiones confirmadas están unificados en `PROMPT_MAESTRO_SISTEMA_AGUA_PURA.md`, que es la única fuente canónica. El documento de diseño conserva únicamente contexto histórico. La implementación requiere un plan detallado que utilice exactamente las fases 0 a 39 del prompt maestro.
