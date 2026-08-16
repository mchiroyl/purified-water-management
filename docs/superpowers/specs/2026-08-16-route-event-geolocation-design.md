# Geolocalización de eventos operativos de ruta

## Objetivo

Registrar exclusivamente dos eventos con ubicación: el punto de inicio de la ruta, cuando el vendedor confirma la recepción de la carga en bodega, y el punto de cada venta confirmada. No se implementará rastreo GPS continuo ni captura en segundo plano.

## Alcance

- Captura de latitud, longitud, precisión y hora de captura en el navegador del dispositivo vendedor.
- Persistencia de cada punto en PostgreSQL, vinculado a la ruta y carga; el punto de venta queda además vinculado a la venta confirmada.
- Soporte para ventas offline: la coordenada capturada viaja en la operación local y se sincroniza con la venta.
- La coordenada no se muestra al vendedor ni se agrega a los comprobantes.
- El sistema conserva los puntos ordenables para análisis posterior, sin construir en esta iteración un mapa ni un rastreo periódico.
- Corrección del indicador de conexión para que una respuesta HTTP exitosa del backend marque el cliente como en línea, aunque la comprobación inicial haya fallado temporalmente.

## Reglas funcionales

1. El inicio se registra una sola vez por carga inicial de ruta al confirmar la recepción (`POST /loads/{id}/receipt`). Las recargas no crean un segundo inicio de ruta.
2. Cada venta confirmada (`POST /sales` o su operación de sincronización) debe incluir una ubicación válida.
3. Latitud válida: `[-90, 90]`; longitud válida: `[-180, 180]`; precisión, cuando se informe, debe ser no negativa.
4. Si el dispositivo no entrega ubicación o el usuario niega el permiso, no se confirma la operación y se muestra un error accionable.
5. La ubicación se captura justo antes de enviar/confirmar la operación; no se solicita seguimiento continuo.
6. El servidor conserva la hora de captura declarada y la hora de persistencia para auditoría; la hora del servidor no se sustituye por la del dispositivo.
7. Los puntos son inmutables. Las restricciones de base de datos impiden más de un inicio por carga y más de un punto para la misma venta.
8. Un `401` demuestra que el servidor respondió y no debe marcar la conectividad como caída; los errores de red y las respuestas `5xx` sí activan la recuperación/reintento.

## Arquitectura y flujo

### Inicio de ruta

1. `RouteLoadsPage` solicita una posición con `navigator.geolocation.getCurrentPosition` al pulsar “Recibir carga”.
2. Envía `{ latitude, longitude, accuracyMeters, capturedAt }` en el cuerpo de `/loads/{id}/receipt`.
3. `RouteLoadController` valida el DTO y `RouteLoadApplicationService` ejecuta la transición de recepción.
4. La persistencia actualiza la carga e inserta una fila `START` en la misma transacción.

### Venta confirmada

1. `SalesPage` solicita la posición al confirmar la venta.
2. La solicitud online incluye el objeto `location` en `CreateSaleRequest`.
3. La venta y su fila `SALE` se guardan en una única transacción; si falla el punto, no queda una venta confirmada sin ubicación.
4. En modo offline, la operación local guarda el mismo objeto `location`; `OfflineSaleSyncHandler` reutiliza el contrato al sincronizar.

### Modelo de datos

Se agrega `route_tracking_point` con:

- `id`, `route_load_id`, `route_id`, `sale_id` nullable.
- `point_type` (`START` o `SALE`).
- `latitude`, `longitude`, `accuracy_meters` nullable, `captured_at`, `persisted_at`.
- `created_by`, `device_id`.
- FK a la carga, venta, usuario y dispositivo; índices por ruta/fecha y carga/fecha.
- Restricciones: coordenadas dentro de rango; `START` único por carga; `SALE` único por venta; coherencia entre `sale_id` y `point_type`.

## Error y privacidad

- El mensaje de permiso denegado explica que se requiere ubicación únicamente para registrar el inicio o confirmar la venta; no se muestra la coordenada en la interfaz.
- Si el navegador no soporta geolocalización, la acción queda bloqueada con una instrucción para usar un dispositivo compatible.
- No se persiste una ubicación parcial ni se registra ubicación en segundo plano.
- El acceso futuro a los puntos se limita a roles administrativos/supervisión mediante endpoints internos; esta iteración solo deja el registro disponible para análisis.

## Corrección de conectividad

`apiClient` publicará un evento de respuesta exitosa después de cualquier respuesta del backend, incluyendo `401` y `204`. `ConnectionManager` escuchará ese evento, cancelará el reintento pendiente y cambiará el estado a `ONLINE`. Los errores de transporte y `5xx` conservarán el flujo actual de degradación/reintento.

## Pruebas y criterios de aceptación

- Prueba backend: DTO rechaza coordenadas fuera de rango.
- Prueba backend: recepción de carga inserta un único `START` y una segunda recepción no duplica el punto.
- Prueba backend: creación online y sincronización offline insertan un punto `SALE` atómico con la venta.
- Prueba frontend: confirmar recepción y venta solicita geolocalización y envía el objeto `location`; rechazo del permiso no ejecuta la mutación.
- Prueba frontend: una respuesta HTTP exitosa actualiza el estado de `ConnectionManager` a `ONLINE`; una excepción de red conserva `OFFLINE`/reintento.
- Prueba de regresión: suite existente de backend/frontend y flujo E2E continúan pasando.

## Fuera de alcance

- Rastreo GPS continuo o en segundo plano.
- Mapa, reproducción visual de rutas o exportación específica de coordenadas.
- Cambios de roles, facturación FEL, comprobantes o contratos no relacionados.
