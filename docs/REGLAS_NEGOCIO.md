# Reglas de negocio

Fuente: `docs/ERS_SRS.md` y `PROMPT_MAESTRO_SISTEMA_AGUA_PURA.md`.

## Identidad y configuración

- **RB-001:** El sistema administra una sola empresa y rechaza una segunda configuración empresarial.
- **RB-002:** La configuración empresarial es la única fuente para nombre, NIT, contacto, logotipo, moneda, zona horaria y numeración interna.
- **RB-003:** Un comprobante interno no puede identificarse como DTE certificado.
- **RB-004:** FEL permanece desactivado hasta validar un adaptador real y credenciales de un certificador autorizado.

## Seguridad y propiedad

- **RB-005:** El servidor decide permisos; ocultar una acción en frontend no sustituye autorización backend.
- **RB-006:** Un vendedor solo consulta y modifica recursos de rutas que tiene asignadas.
- **RB-007:** El vendedor no aprueba sus propias mermas, transferencias, descuentos ni anulaciones.
- **RB-008:** Revocar un dispositivo revoca sus sesiones y bloquea sincronización posterior.
- **RB-009:** Roles, propietario, precio, total y estados protegidos nunca se aceptan desde DTO de vendedor.

## Productos, conversiones y precios

- **RB-010:** Todo producto que controla inventario tiene unidad base.
- **RB-011:** Carga, venta, devolución y merma se convierten a unidad base con la misma regla vigente.
- **RB-012:** Cambiar una conversión o precio no modifica operaciones históricas.
- **RB-013:** El vendedor no escribe el precio; el backend resuelve versión, tramo y precio especial.
- **RB-014:** Un descuento extraordinario solo aplica si está aprobado, vigente y corresponde a cliente/producto.
- **RB-015:** No se crean descuentos extraordinarios offline.

## Clientes y crédito

- **RB-016:** Un cliente ocasional compra sin convertirse en permanente y no recibe crédito ni precio especial nuevo.
- **RB-017:** Un cliente provisional puede comprar con efectivo o transferencia pendiente, pero no con crédito.
- **RB-018:** Rechazar o fusionar el alta de un provisional nunca elimina sus ventas.
- **RB-019:** Posibles duplicados requieren revisión humana; no se fusionan automáticamente.
- **RB-020:** Crédito requiere cliente activo, autorización previa y disponibilidad suficiente.

## Inventario y carga

- **RB-021:** Todo cambio físico se representa mediante movimiento inmutable.
- **RB-022:** Ninguna operación deja inventario negativo.
- **RB-023:** Bodega confirma entrega y vendedor confirma recepción de la carga por separado.
- **RB-024:** Una carga iniciada no se edita; se corrige con movimiento compensatorio autorizado.
- **RB-025:** Cantidades se verifican en frontend, dominio y transacción PostgreSQL.

## Ventas y pagos

- **RB-026:** Venta, ítems, pago y movimientos se guardan en una transacción ACID.
- **RB-027:** Una venta confirmada es inmutable y no se elimina.
- **RB-028:** Una corrección usa solicitud de anulación y efectos compensatorios.
- **RB-028A:** Una anulación aprobada conserva la venta y el pago originales, registra sus reversiones y repone inventario exactamente una vez.
- **RB-028B:** Una venta no puede anularse después de que la carga de su ruta queda liquidada.
- **RB-029:** La referencia local UUID se conserva después de asignar número oficial.
- **RB-030:** Transferencia permanece pendiente hasta revisión de un usuario autorizado distinto del vendedor.
- **RB-031:** Una transferencia rechazada no cuenta como pago verificado.

## Mermas y devoluciones

- **RB-032:** Merma significa pérdida física y nunca dinero.
- **RB-033:** Merma pendiente o rechazada no reduce la diferencia física.
- **RB-034:** En aprobación parcial únicamente cuentan las unidades aprobadas.
- **RB-035:** Una presentación dañada parcialmente descuenta solo unidades realmente dañadas.
- **RB-036:** Producto no vendido, devolución de cliente, merma y faltante son conceptos distintos.
- **RB-037:** Evidencia fotográfica apoya revisión, pero no aprueba automáticamente.

## Sincronización

- **RB-038:** Toda operación offline crítica usa `clientOperationId` y `deviceId`.
- **RB-039:** Agregado local y Outbox se confirman en la misma transacción IndexedDB.
- **RB-040:** Una operación solo se envía cuando sus dependencias ya fueron aceptadas.
- **RB-041:** Repetir `deviceId + clientOperationId` devuelve el resultado original sin repetir efectos.
- **RB-042:** Un batch puede tener resultados parciales; no se marca exitoso globalmente.
- **RB-043:** Un conflicto o rechazo se conserva y se muestra; no se borra la operación local.

## Conciliación y cierre

- **RB-044:** Diferencia física = carga − ventas − devolución buena − merma aprobada.
- **RB-045:** Diferencia monetaria = efectivo esperado − efectivo entregado.
- **RB-046:** Las conciliaciones física y monetaria nunca se compensan entre sí.
- **RB-047:** Una merma legítima no reduce el efectivo esperado.
- **RB-048:** No se cierra definitivamente una liquidación con operaciones offline relevantes pendientes.
- **RB-049:** Una liquidación cerrada es inmutable.

## Auditoría

- **RB-050:** Toda acción crítica registra actor, entidad, fecha servidor, dispositivo y correlación.
- **RB-051:** Auditoría y logs excluyen contraseñas, tokens, claves y credenciales FEL.
- **RB-052:** Fechas locales se conservan para trazabilidad, pero la hora oficial es la del servidor.
