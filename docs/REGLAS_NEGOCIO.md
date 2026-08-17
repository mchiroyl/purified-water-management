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
- **RB-025A:** Una recarga solo puede crearse para una ruta con carga inicial en estado `STARTED`, sigue la doble confirmación de bodega/vendedor y mueve inventario mediante movimientos auditables.
- **RB-025B:** Una recarga se suma a la carga inicial para la liquidación, no inicia otro recorrido y queda bloqueada cuando la liquidación de la ruta está cerrada.

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

## Comprobantes y FEL

- **RB-053:** El comprobante interno usa la identidad empresarial capturada con la venta y permanece estable aunque la configuración cambie después.
- **RB-054:** Cada venta posee como máximo un PDF interno almacenado; repetir la solicitud devuelve el mismo documento.
- **RB-055:** El PDF interno declara de forma visible que no es un DTE FEL certificado.
- **RB-056:** FEL no se activa sin un adaptador de certificador real instalado y credenciales validadas exclusivamente en backend.
- **RB-057:** Web Share se usa únicamente cuando el navegador confirma soporte para compartir el archivo PDF.
- **RB-058:** El fallback descarga el PDF y usa el enlace público `wa.me`; no integra APIs privadas de WhatsApp.
- **RB-059:** Un comprobante oficial descargado puede almacenarse en IndexedDB y una descarga solicitada offline queda pendiente sin inventar un documento local.

## Dashboard y alertas

- **RB-060:** El día operativo se calcula con la zona horaria configurada para la empresa, no con la zona del navegador ni de la base de datos.
- **RB-061:** El dashboard excluye ventas con anulación aprobada y no acepta totales calculados por el frontend.
- **RB-062:** Un vendedor solo consulta métricas de sus rutas y sus propias operaciones pendientes.
- **RB-063:** Las alertas del dashboard se derivan de diferencias y pendientes autoritativos del servidor.
- **RB-063A:** Un `401` por expiración del access token se reintenta una sola vez tras renovar la sesión; no cambia el estado de conectividad. Solo una falla de red, timeout o respuesta 5xx activa la alerta de conexión.

## Reportes

- **RB-064:** Todo rango de reporte usa fechas locales inclusivas en la zona empresarial y no puede superar 366 días.
- **RB-065:** Los filtros y la exportación aplican exactamente el mismo alcance de autorización en el servidor.
- **RB-066:** La exportación se rechaza si supera 20,000 filas; no se entrega un archivo silenciosamente incompleto.
- **RB-067:** Los reportes operativos se entregan en Excel `.xlsx` y PDF imprimible; ambos incluyen la identidad empresarial y los filtros aplicados.
- **RB-067A:** El servidor asigna los códigos `CLI-`, `VND-`, `RUT-` y `VEH-`; ningún formulario puede imponer o reutilizar un código operativo.

## Auditoría operativa

- **RB-068:** Un evento de auditoría confirmado no se modifica ni elimina, incluso mediante SQL directo.
- **RB-069:** La correlación almacenada coincide con `X-Correlation-Id` de la solicitud que produjo el evento.
- **RB-070:** Contraseñas, tokens, secretos, credenciales, autorizaciones y cookies se eliminan recursivamente de before/after.
- **RB-071:** Consultar el historial de auditoría produce a su vez un evento `AUDIT_VIEW`.
- **RB-072:** Los intentos de login fallidos se conservan aunque la autenticación termine con HTTP 401.
