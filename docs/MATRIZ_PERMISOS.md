# Matriz de permisos

Leyenda: **Sí** permitido; **No** prohibido; **Cond.** permitido con condición de política, asignación o segregación.

| Operación | Administrador | Bodega | Vendedor | Supervisor | Restricción adicional |
|---|---:|---:|---:|---:|---|
| Configurar datos de empresa | Sí | No | No | No | Auditado; registro único. |
| Crear/desactivar usuario | Sí | No | No | No | No borra historial. |
| Asignar roles | Sí | No | No | No | Impide autoescalamiento desde DTO. |
| Revocar dispositivo | Sí | No | No | Cond. | Supervisor según política. |
| Gestionar productos/presentaciones | Sí | Cond. | No | Cond. | Bodega puede consultar; cambios según política. |
| Cambiar precios | Sí | No | No | Cond. | Versionado obligatorio. |
| Aprobar descuento | Sí | No | No | Cond. | Nunca el solicitante. |
| Gestionar clientes | Sí | No | Cond. | Cond. | Vendedor solo ocasional/provisional en su ruta. |
| Fusionar clientes | Sí | No | No | Cond. | Revisión humana y auditoría. |
| Gestionar rutas/asignaciones | Sí | Cond. | No | Cond. | Conserva historial. |
| Preparar carga | Sí | Sí | No | Cond. | Para recorrido válido. |
| Confirmar entrega de carga | Sí | Sí | No | Cond. | Guarda actor y dispositivo. |
| Confirmar recepción de carga | No | No | Sí | No | Solo vendedor asignado. |
| Iniciar/finalizar recorrido | No | No | Sí | Cond. | Solo recorrido asignado. |
| Crear venta | Sí | No | Sí | No | Vendedor solo su ruta; servidor calcula. |
| Consultar venta propia | Sí | Cond. | Sí | Sí | Bodega solo datos necesarios. |
| Consultar venta ajena | Sí | Cond. | No | Sí | Según alcance de supervisión. |
| Editar/eliminar venta | No | No | No | No | Corrección solo por anulación. |
| Solicitar anulación | Sí | No | Sí | Sí | Motivo obligatorio. |
| Aprobar anulación | Sí | No | No | Cond. | Nunca el solicitante. |
| Registrar efectivo | Sí | Cond. | Sí | Cond. | Asociado a ruta/venta. |
| Verificar transferencia | Sí | No | No | Cond. | Nunca el vendedor que la registró. |
| Conceder crédito | Sí | No | No | Cond. | Cliente autorizado y límite. |
| Registrar merma | Sí | Sí | Sí | Sí | Cantidad/evidencia según política. |
| Aprobar merma pequeña | Sí | Sí | No | Sí | Bodega según límite; nunca reportante. |
| Aprobar merma extraordinaria | Sí | No | No | Cond. | Niveles configurados. |
| Registrar devolución | Sí | Sí | Sí | Sí | Vendedor reporta; bodega recibe. |
| Confirmar devolución física | Sí | Sí | No | Cond. | Cantidad verificada. |
| Consultar liquidación | Sí | Sí | Cond. | Sí | Vendedor solo la propia. |
| Cerrar liquidación | Sí | No | No | Cond. | Sin pendientes bloqueantes. |
| Consultar dashboard/reportes | Sí | Cond. | Cond. | Sí | Datos mínimos por rol. |
| Consultar auditoría | Sí | No | No | Cond. | Acceso restringido y auditado. |

Toda operación con **Sí** o **Cond.** también aplica autorización a nivel de recurso. Un rol nunca concede acceso automático a rutas, vendedores o entidades fuera de su alcance.
