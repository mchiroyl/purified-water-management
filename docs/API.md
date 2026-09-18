# API REST

Base local: `http://localhost:3000/api`  
Base productiva: el mismo origen HTTPS publicado por Nginx.

La API es de una sola empresa. Los DTO y validaciones en el código son la fuente exacta de tipos; Swagger/OpenAPI está disponible en desarrollo en `/swagger-ui.html` y `/api-docs`, pero se desactiva en el perfil productivo.

## Autenticación

### `POST /auth/login` — público

```json
{
  "username": "admin",
  "password": "...",
  "deviceName": "PC Administración",
  "appVersion": "web-1.0"
}
```

Devuelve `accessToken` y el usuario autenticado; el refresh se establece como cookie HttpOnly. Si `mustChangePassword` es `true`, solo debe llamarse al cambio de contraseña.

### `POST /auth/refresh` — cookie de refresh

Rota el refresh y devuelve un nuevo access token. La rotación es serializada y revoca la sesión anterior.

### `POST /auth/logout` — cookie de refresh

Revoca la sesión y limpia la cookie.

### `POST /auth/change-password` — Bearer restringido o sesión autenticada

```json
{ "currentPassword": "...", "newPassword": "..." }
```

Después del cambio se revocan sesiones anteriores según la política de seguridad.

### Alta controlada de dispositivos por QR

Un administrador crea una invitación con `POST /administration/device-enrollment/invitations`
(`{"userId":"..."}`), que devuelve un `payload` QR y un token de respaldo. La invitación
expira en 10 minutos y es de un solo uso. El cliente puede enviar el QR completo o el token
a `POST /auth/device-enrollment`:

```json
{ "token": "https://sistema.example/enroll?token=...", "deviceName": "Teléfono de ruta", "appVersion": "web-1.0" }
```

El endpoint completa el alta y devuelve la sesión normal. Las invitaciones se consultan o
revocan desde `/administration/device-enrollment/invitations`; el dispositivo puede revocarse
desde `/administration/devices`.

## Convenciones

En rutas protegidas envíe:

```http
Authorization: Bearer <access-token>
Content-Type: application/json
```

Cada respuesta incluye `X-Correlation-Id`. Errores tienen esta forma:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "La solicitud contiene datos inválidos.",
  "correlationId": "uuid-o-id",
  "timestamp": "2026-08-11T12:00:00Z",
  "fieldErrors": [{ "field": "name", "message": "no debe estar vacío" }]
}
```

Categorías HTTP: `400` validación/JSON, `401` no autenticado, `403` sin permiso, `404` inexistente, `409` conflicto/idempotencia/regla, `413` cuerpo excedido, `429` límite de tráfico y `500` error interno genérico.

Los importes y cantidades se envían como decimal exacto cuando el DTO lo define. El servidor recalcula totales, precios, crédito e inventario.


| Método | Ruta | Roles |
|---|---|---|
| GET | `/company-configuration` | autenticado |
| PUT | `/company-configuration` | ADMINISTRADOR |
| POST multipart | `/company-configuration/logo` | ADMINISTRADOR |
| GET | `/company-configuration/logo` | público para recurso configurado |
| GET | `/administration/users` | ADMINISTRADOR |
| POST | `/administration/users` | ADMINISTRADOR |
| PATCH | `/administration/users/{id}/status` | ADMINISTRADOR |
| GET | `/administration/devices` | ADMINISTRADOR |
| POST | `/administration/devices/{id}/revoke` | ADMINISTRADOR |

## Catálogo y precios

| Método | Ruta | Función |
|---|---|---|
| GET | `/products` | catálogo visible |
| POST | `/products` | crear producto/presentaciones |
| PATCH | `/products/{id}/status` | activar/desactivar |
| PUT | `/products/{productId}/presentations/{presentationId}/conversion` | nueva conversión vigente |
| PATCH | `/products/{productId}/presentations/{presentationId}/status` | estado de presentación |
| GET/POST | `/pricing/lists` | consultar/crear lista |
| POST | `/pricing/lists/{id}/versions` | crear versión inmutable |
| POST | `/pricing/versions/{id}/activate` | activar versión |
| GET/POST | `/pricing/special-prices` | precios especiales |
| POST | `/pricing/resolve` | calcular precio autorizado |
| GET/POST | `/pricing/discounts` | solicitudes de descuento |
| POST | `/pricing/discounts/{id}/decision` | aprobar/rechazar |

## Rutas, clientes e inventario

| Método | Ruta | Función |
|---|---|---|
| GET/POST | `/routes` | listar/crear rutas |
| GET/POST | `/routes/vehicles` | listar/crear vehículos |
| POST | `/routes/{id}/assignment` | asignar vendedor/vehículo con vigencia |
| GET | `/routes/sellers` | vendedores elegibles |
| GET/POST | `/customers` | clientes autorizados / crear permanente |
| POST | `/customers/occasional` | cliente ocasional |
| GET | `/customers/provisional-reviews` | cola de revisión |
| POST | `/customers/{id}/registration-decision` | aprobar/rechazar/fusionar |
| POST | `/customers/{id}/route-assignment` | asignar cliente a ruta |
| GET/POST | `/inventory/locations` | ubicaciones y saldos |
| POST | `/inventory/adjustments` | ajuste autorizado |
| GET | `/inventory/locations/{id}/movements` | libro de movimientos |

## Cargas, ventas y pagos

| Método | Ruta | Función |
|---|---|---|
| GET/POST | `/loads` | listar/preparar carga |
| POST | `/loads/replenishments` | preparar recarga para una ruta ya iniciada |
| POST | `/loads/{id}/warehouse-confirmation` | confirmación bodega |
| POST | `/loads/{id}/receipt` | recepción vendedor |
| POST | `/loads/{id}/start` | iniciar recorrido |
| POST | `/loads/{id}/corrections` | corrección compensatoria |

`POST /loads/replenishments` recibe el mismo cuerpo de carga (`routeId`, `sourceLocationId`, `plannedDate`, `items` y `notes`), pero fuerza `loadType=REPLENISHMENT`. Solo se acepta cuando la carga `INITIAL` de la ruta está `STARTED`, exige confirmación de bodega y vendedor, se suma a la liquidación de la carga inicial y se rechaza después del cierre.

`POST /loads/{id}/receipt` requiere el cuerpo `{"location": { ... }}`. Al confirmar la recepción de una carga inicial, el servidor persiste un único punto `START` para esa carga en la misma transacción; la recarga conserva su propio flujo y no inicia otro recorrido.
| GET/POST | `/sales` | consultar/crear venta online |
| GET | `/sales/{id}` | detalle oficial |
| GET | `/sales/{saleId}/receipt` | PDF interno inmutable con el logotipo histórico |
| POST | `/sales/no-purchase-visit` | registrar visita sin compra (GPS + motivo obligatorio) |
| GET | `/payments/transfers` | transferencias pendientes |
| POST | `/payments/transfers/{id}/decision` | verificar/rechazar transferencia |

Venta mínima:

```json
{
  "clientReference": "uuid-del-dispositivo",
  "routeId": "uuid",
  "customerId": "uuid",
  "items": [{ "presentationId": "uuid", "quantity": 2 }],
  "payments": [{ "method": "CASH", "amount": null }],
  "location": {
    "latitude": 14.6349,
    "longitude": -90.5069,
    "accuracyMeters": 5,
    "capturedAt": "2026-08-16T12:00:00Z"
  }
}
```

El monto `null` en un único medio permite que el servidor aplique el total calculado; no permite que el cliente defina el precio.

### Captura puntual de ubicación

Los cuerpos de recepción y de venta incluyen `location` con `latitude`, `longitude`, `accuracyMeters` opcional y `capturedAt` ISO-8601. Latitud debe estar entre `-90` y `90`, longitud entre `-180` y `180`, la precisión no puede ser negativa y los demás campos son obligatorios. Un cuerpo ausente o inválido devuelve `400 VALIDATION_ERROR` con `fieldErrors`.

La PWA solicita una sola posición al pulsar **Confirmar recepción** y otra al pulsar **Confirmar venta**. Si el permiso de ubicación se deniega, no envía la solicitud ni confirma la operación; no existe endpoint de rastreo continuo, watcher ni captura en segundo plano. La API persiste filas inmutables en `route_tracking_point`: una `START` por carga inicial y una `SALE` por venta, vinculadas a carga, ruta, actor y dispositivo. Esos datos no forman parte de las respuestas de venta ni de los comprobantes o reportes dirigidos al cliente.

### `POST /api/sales/no-purchase-visit` — VENDEDOR

Registra una visita ética al cliente cuando no se realizó compra. Requiere GPS obligatorio y un motivo predefinido.

```json
{
  "routeLoadId": "uuid",
  "customerId": "uuid",
  "reason": "Cliente no estaba",
  "location": {
    "latitude": 14.6349,
    "longitude": -90.5069,
    "accuracyMeters": 8,
    "capturedAt": "2026-09-16T14:05:00Z"
  }
}
```

Motivos aceptados: `"Cliente no estaba"`, `"No necesitaba"`. El sistema persiste un punto `NO_PURCHASE_VISIT` en `route_tracking_point` con el `customer_id` y `visit_note`. No afecta inventario ni genera comprobante.

### `GET /api/loads/{id}/route-map` — ADMINISTRADOR / VENDEDOR (ruta propia)

Devuelve la secuencia cronológica de puntos GPS de una jornada con estado `STARTED` o `SETTLED` para renderizar en el mapa interactivo (Leaflet + OpenStreetMap + OSRM). Incluye tipo de punto, coordenadas, hora de captura, nombre de cliente (cuando aplica) y monto de venta.

### `GET /api/routes/{id}/route-history` — ADMINISTRADOR

Devuelve el resumen de jornadas (loadId, fecha, vendedor, inicio/fin, duración, puntos GPS, distancia estimada) filtrable por rango de fechas y vendedor.

### `GET /api/routes/sellers` — ADMINISTRADOR

Devuelve la lista de vendedores disponibles para filtrar el historial geográfico.


## Offline y control operativo

| Método | Ruta | Función |
|---|---|---|
| POST | `/sync/batch` | lote Outbox idempotente |
| GET/POST | `/wastes` | listar/registrar merma |
| POST | `/wastes/{id}/reviews` | revisión parcial/total |
| GET/POST | `/wastes/types` | catálogo de merma |
| PUT | `/wastes/types/{id}` | actualizar política |
| GET | `/wastes/indicators` | alertas/indicadores |
| GET/POST | `/returns` | listar/registrar devolución |
| POST | `/returns/{id}/receipt` | recepción bodega |
| GET/POST | `/operations-control/authorizations` | solicitudes |
| POST | `/operations-control/authorizations/{id}/decision` | decisión segregada |
| GET/POST | `/operations-control/incidents` | incidencias |
| POST | `/operations-control/incidents/{id}/actions` | investigar/resolver |
| GET/POST | `/annulments` | solicitud de anulación |
| POST | `/annulments/{id}/decision` | decisión y reversos |

El lote de sincronización conserva `clientOperationId`, `deviceId`, hash canónico, dependencias y payload. Repetir el mismo lote devuelve `ALREADY_PROCESSED`; no se deben generar nuevos UUID para “reintentar” una operación no resuelta.

## Liquidaciones, panel y reportes

| Método | Ruta | Función |
|---|---|---|
| GET | `/settlements` | liquidaciones y recorridos |
| POST | `/settlements/{loadId}/calculate` | calcular diferencias |
| POST | `/settlements/{loadId}/cash-deliveries` | registrar entrega |
| POST | `/settlements/{loadId}/close` | cerrar conciliación |
| GET | `/dashboard` | indicadores oficiales |
| GET | `/reports/sales` | reporte paginado |
| GET | `/reports/wastes` | reporte paginado |
| GET | `/reports/settlements` | reporte paginado |
| GET | `/reports/sales.xlsx` / `/reports/sales.pdf` | exportar ventas en Excel o PDF |
| GET | `/reports/wastes.xlsx` / `/reports/wastes.pdf` | exportar mermas en Excel o PDF |
| GET | `/reports/settlements.xlsx` / `/reports/settlements.pdf` | exportar liquidaciones en Excel o PDF |
| GET | `/audit` | auditoría filtrable |

Los filtros de fechas, ruta, vendedor y paginación respetan alcance por rol. Excel incluye logotipo e identidad de empresa, filtros y encabezados congelados; PDF es imprimible y contiene el logotipo, la misma identidad y filtros. El sistema no publica CSV como formato operativo.

Los códigos de cliente, vendedor, ruta y vehículo los asigna el servidor con los prefijos `CLI-`, `VND-`, `RUT-` y `VEH-`; si una integración antigua envía un campo `code`, ese valor se ignora por compatibilidad. La placa y la descripción del vehículo siguen siendo datos operativos capturados por el usuario.

## Salud y límites

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/connectivity` | público, `no-store` |
| GET | `/actuator/health/readiness` | red interna/healthcheck |
| GET | `/actuator/health/liveness` | red interna/healthcheck |

El cuerpo JSON está limitado por `MAX_JSON_BYTES` (2 MiB por defecto), las colecciones tienen límites de entrada y login/API tienen rate limit configurable.
