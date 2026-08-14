# Mejoras operativas: códigos, reportes, recargas y sesión

## Objetivo

Mejorar la operación diaria de una sola empresa purificadora sin romper los datos históricos: asignar automáticamente los códigos de cliente, vendedor, ruta y vehículo; entregar reportes Excel y PDF; registrar recargas de producto a rutas ya iniciadas; renovar sesiones expiradas sin interrumpir el trabajo; y documentar todos los menús y flujos en los manuales.

## Alcance aprobado

1. Los códigos nuevos serán generados por PostgreSQL y no serán editables desde la interfaz:
   - `CLI-000001` para clientes.
   - `VND-000001` para vendedores.
   - `RUT-000001` para rutas.
   - `VEH-000001` para vehículos.
2. Los códigos existentes se conservan sin renumerarlos.
3. La placa del vehículo sigue siendo un dato operativo capturado por el administrador; no se confunde con el código interno.
4. La exportación visible en Reportes será Excel `.xlsx` y PDF. El CSV deja de ser la opción presentada al usuario.
5. Una recarga permite entregar producto desde una bodega a una ruta cuyo recorrido ya inició. La recarga usa el libro de inventario y queda relacionada con la ruta y la liquidación.
6. Un `401` causado por vencimiento del access token dispara una sola renovación usando la cookie HttpOnly, reintenta la solicitud original y solo cierra sesión si la renovación también falla.
7. El indicador de conectividad distingue autenticación vencida de indisponibilidad de red.
8. Se actualizan manual de usuario Markdown/PDF, manual técnico, API, ERD y matriz de trazabilidad.

## Diseño funcional

### Códigos automáticos

Los comandos de creación ya no exigirán `code` en cliente, ruta, vehículo ni perfil de vendedor. Cada adaptador reservará el siguiente valor de una secuencia en la misma transacción que inserta el registro. La unicidad seguirá protegida por índices y la respuesta devolverá el código asignado para mostrarlo inmediatamente.

Los formularios mostrarán el texto “Código asignado automáticamente” y dejarán editables únicamente los datos descriptivos. El formulario de usuario conservará nombre, correo, contraseña temporal y roles; para el rol vendedor solicitará nombre visible, pero no código.

### Reportes Excel y PDF

El servidor generará ambos formatos a partir de la misma consulta autorizada y de los mismos filtros de fecha, vendedor, ruta, cliente, producto, presentación, forma de pago y diferencias. El libro Excel tendrá una hoja por reporte, encabezado congelado, autofiltro, anchos legibles, fechas locales y formatos monetarios. El PDF tendrá encabezado de empresa, tipo de reporte, filtros aplicados, fecha/hora de generación y una tabla que se adapta a orientación vertical u horizontal.

La interfaz conservará la tabla paginada y añadirá botones “Exportar Excel” y “Imprimir PDF”. Las descargas usarán los mismos permisos RBAC y alcance por vendedor que la consulta en pantalla.

### Recargas de ruta

Se añadirá un tipo de carga `REPLENISHMENT` al flujo de cargas existente, sin crear un libro paralelo. Una recarga se crea para una ruta activa con recorrido iniciado, origen de bodega, productos activos y cantidades positivas. Sus estados son:

`PREPARED` → `WAREHOUSE_CONFIRMED` → `RECEIVED`.

La confirmación de bodega descuenta inventario central y la recepción del vendedor ingresa inventario de ruta dentro de la misma transacción. Una recarga no inicia un segundo recorrido ni crea una segunda liquidación. La liquidación de la carga inicial agregará las unidades de recargas recibidas antes del cierre y sus movimientos quedarán auditados. No se permitirá recargar una ruta cuya liquidación ya esté cerrada.

En el menú Cargas se mostrará una sección “Nueva recarga” para administrador/bodega y el botón “Confirmar recepción de recarga” para el vendedor asignado. El formulario podrá elegir cualquier producto activo que controle inventario y exigirá un motivo operativo.

### Renovación de sesión y conectividad

`apiRequest` y `apiFile` compartirán un ejecutor HTTP que, ante `401` y fuera de los endpoints de autenticación, espera una única promesa de refresh para solicitudes concurrentes. Si obtiene una nueva respuesta de autenticación, actualiza el access token, sincroniza el usuario de sesión y repite una vez la petición original. Si el refresh falla, limpia el token, borra el contexto móvil de forma segura, emite un evento de sesión expirada y la interfaz vuelve al inicio mostrando un mensaje accionable.

La respuesta `401` no provocará la marca de “Sin conexión”. Los errores de red, timeout y respuestas 5xx seguirán alimentando `ConnectionManager`; el indicador mostrará “Sesión expirada” cuando corresponda.

## Diseño técnico

- Backend: migración Flyway posterior a V18 para secuencias, columna/tipo de carga y restricciones de recarga; DTOs, servicios, puertos, adaptadores JDBC, controladores y generación de archivos.
- Frontend: cliente HTTP con refresh/reintento, formularios sin código manual, sección de recargas, botones de reporte y mensajes de sesión.
- Documentos: `docs/MANUAL_USUARIO.md`, PDF derivado, `docs/MANUAL_TECNICO.md`, `docs/API.md`, `diagrams/erd/postgresql-erd.mmd`, `diagrams/erd/README.md` y `docs/MATRIZ_TRAZABILIDAD.md`.
- Compatibilidad: registros históricos conservan sus códigos y cargas antiguas siguen interpretándose como `INITIAL` mediante valor por defecto.

## Seguridad y consistencia

- La generación de códigos ocurre en el servidor; nunca se confía en un contador del navegador.
- La recarga verifica rol, pertenencia de vendedor a ruta, estado de ruta, existencia de bodega, producto activo y stock no negativo.
- Las descargas de reportes no exponen datos fuera del alcance autorizado.
- El refresh token permanece HttpOnly; no se guardará en localStorage ni IndexedDB.
- Todas las mutaciones nuevas auditarán usuario, dispositivo, recurso, resultado y correlación.

## Pruebas de aceptación

1. Crear dos clientes, vendedores, rutas y vehículos concurrentemente produce códigos distintos y secuenciales, sin enviar `code` desde la UI.
2. Los registros existentes mantienen sus códigos después de migrar.
3. Excel abre como libro válido y contiene filtros, encabezados y valores de los tres tipos de reporte.
4. PDF contiene identidad de empresa, filtros y filas autorizadas, y puede imprimirse.
5. Una recarga completa el flujo bodega → vendedor, mueve inventario exactamente una vez y se incluye en liquidación.
6. Una recarga no puede iniciarse como recorrido separado ni ejecutarse después del cierre de liquidación.
7. Un `401` renueva una sola vez aun con varias peticiones simultáneas; la petición original se reintenta y la UI conserva la sesión.
8. Un refresh expirado devuelve al login sin presentar el evento como “Sin conexión”.
9. Manuales, API, ERD y trazabilidad describen los nuevos endpoints y estados.

