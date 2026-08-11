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

## Empresa, identidad y FEL

| Método | Ruta | Roles |
|---|---|---|
| GET | `/company-configuration` | autenticado |
| PUT | `/company-configuration` | ADMINISTRADOR |
| POST multipart | `/company-configuration/logo` | ADMINISTRADOR |
| GET | `/company-configuration/logo` | público para recurso configurado |
| GET | `/fel-configuration` | ADMINISTRADOR |
| PUT | `/fel-configuration` | ADMINISTRADOR; bloquea proveedor inexistente |
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
| POST | `/loads/{id}/warehouse-confirmation` | confirmación bodega |
| POST | `/loads/{id}/receipt` | recepción vendedor |
| POST | `/loads/{id}/start` | iniciar recorrido |
| POST | `/loads/{id}/corrections` | corrección compensatoria |
| GET/POST | `/sales` | consultar/crear venta online |
| GET | `/sales/{id}` | detalle oficial |
| GET | `/sales/{saleId}/receipt` | PDF interno inmutable |
| GET | `/payments/transfers` | transferencias pendientes |
| POST | `/payments/transfers/{id}/decision` | verificar/rechazar transferencia |

Venta mínima:

```json
{
  "clientReference": "uuid-del-dispositivo",
  "routeId": "uuid",
  "customerId": "uuid",
  "items": [{ "presentationId": "uuid", "quantity": 2 }],
  "payments": [{ "method": "CASH", "amount": null }]
}
```

El monto `null` en un único medio permite que el servidor aplique el total calculado; no permite que el cliente defina el precio.

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
| GET | `/reports/sales.csv` | exportación CSV segura |
| GET | `/reports/wastes.csv` | exportación CSV segura |
| GET | `/reports/settlements.csv` | exportación CSV segura |
| GET | `/audit` | auditoría filtrable |

Los filtros de fechas, ruta, vendedor y paginación respetan alcance por rol. Las exportaciones sanitizan celdas que podrían interpretarse como fórmulas.

## Salud y límites

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/connectivity` | público, `no-store` |
| GET | `/actuator/health/readiness` | red interna/healthcheck |
| GET | `/actuator/health/liveness` | red interna/healthcheck |

El cuerpo JSON está limitado por `MAX_JSON_BYTES` (2 MiB por defecto), las colecciones tienen límites de entrada y login/API tienen rate limit configurable.
