# Arquitectura inicial

## Estilo

Monolito modular Spring Boot y PWA React. El backend es una sola unidad de despliegue, pero cada capacidad mantiene límites internos y dependencias dirigidas hacia el dominio.

## Capas backend

- `domain`: entidades, valores, reglas, contratos y excepciones sin dependencias web/JPA.
- `application`: casos de uso, comandos, consultas y DTO internos.
- `infrastructure`: JPA, seguridad, storage, PDF, sincronización y configuración.
- Los comprobantes internos se generan con Apache PDFBox y se conservan como archivos inmutables mediante `file_object` y `receipt_document`.
- `presentation`: controladores REST, validación de entrada y manejo de errores.

## Componentes frontend

- `app`: composición, rutas, proveedores y sesión.
- `features`: módulos por capacidad.
- `storage`: repositorios IndexedDB.
- `sync`: Outbox, dependencias, batches y reintentos.
- `pwa`: manifiesto, Service Worker y actualización.
- `services`: cliente HTTP y contratos API.

## Persistencia

PostgreSQL es autoritativo y transaccional. IndexedDB conserva únicamente el paquete autorizado de ruta y operaciones offline. Los archivos usan una abstracción separada con volumen local en desarrollo.

## Seguridad

JWT corto en memoria y refresh opaco rotativo en cookie segura. RBAC se combina con autorización por recurso. El backend deriva campos protegidos. Auditoría y correlationId atraviesan operaciones críticas.

## Despliegue local

Docker Compose ejecuta PostgreSQL, backend y frontend Nginx. Flyway migra al iniciar backend. Los healthchecks gobiernan dependencias sin asumir que un proceso iniciado está listo.
