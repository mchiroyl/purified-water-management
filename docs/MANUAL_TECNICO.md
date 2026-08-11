# Manual técnico — Sistema Agua Pura

Versión: `0.1.0`  
Arquitectura: monolito modular con PWA offline-first  
Alcance organizacional: una empresa purificadora

## 1. Componentes y versiones

| Capa | Tecnología principal |
|---|---|
| Proxy/UI | Nginx 1.28 Alpine, React 19.2, TypeScript 7, Vite 8.2 |
| PWA | vite-plugin-pwa 1.3, Service Worker/Workbox, IndexedDB con `idb` 8 |
| Estado/validación | TanStack Query 5, React Hook Form 7, Zod 4 |
| API | Java 21, Spring Boot 4.1, Spring MVC, Security, Validation y Actuator |
| Persistencia | Spring Data JPA, PostgreSQL 18.4, Flyway V1–V18 |
| Documentos | Apache PDFBox 3.0.8 y almacenamiento por volumen |
| Pruebas | JUnit, Testcontainers 2, Vitest 4, Testing Library y Playwright 1.62 |
| Ejecución | Docker Compose, imágenes multi-stage y procesos no privilegiados |

Las versiones ejecutables se fijan en `backend/pom.xml`, `frontend/package.json` y `docker-compose.yml`.

## 2. Arquitectura

El backend es un monolito modular organizado en:

- `domain`: entidades, value objects, reglas y puertos; no depende de Spring/JPA.
- `application`: casos de uso, comandos, consultas y DTO de aplicación.
- `infrastructure`: JPA, JWT, almacenamiento, PDF, seguridad y adaptadores externos.
- `presentation`: controladores REST, validación de entrada y manejo de errores.

Las dependencias apuntan hacia dominio/aplicación. Los controladores no contienen reglas financieras ni de inventario. Las operaciones críticas delimitan su transacción en el caso de uso.

El frontend se divide en `app`, `features`, `offline`, `pwa`, `services` y `types`. Cada función de negocio tiene página, integración HTTP y prueba cerca del código que la usa.

Diagramas vigentes:

- `diagrams/context/system-context.mmd`;
- `diagrams/architecture/system-architecture.mmd`;
- `diagrams/architecture/clean-architecture.mmd`;
- `diagrams/components/system-components.mmd`;
- `diagrams/flows/*.mmd`.

## 3. Flujo HTTP

```text
Navegador/PWA
  → Nginx (TLS en producción, límites, CSP y cabeceras)
    → /api/* hacia Spring Boot:8080
      → caso de uso
        → puertos/repositorios JPA
          → PostgreSQL
```

Solo el frontend publica un puerto en el Compose local. PostgreSQL y backend permanecen en la red privada `agua_pura_network`.

Nginx sirve la PWA y aplica fallback a `index.html` para rutas del cliente. `/healthz` comprueba el frontend y `/actuator/health/readiness` la preparación del backend.

## 4. Seguridad

### 4.1 Autenticación

- Las contraseñas se almacenan con Argon2id.
- El access token JWT tiene vida corta y se envía en `Authorization: Bearer`.
- El refresh token se conserva en cookie HttpOnly, rota en cada uso y se serializa con bloqueo pesimista.
- El hash del refresh se guarda en PostgreSQL; el token plano no se persiste.
- Usuario, dispositivo, estado y roles se revalidan en cada petición autenticada.
- Desactivar usuario o revocar dispositivo invalida acceso vigente.
- Una contraseña temporal produce un JWT restringido al endpoint de cambio.

### 4.2 Autorización

Spring Security y `@PreAuthorize` aplican RBAC. Además, los casos de uso verifican pertenencia de ruta, vendedor, recurso y segregación de funciones. No basta con ocultar un menú en React.

### 4.3 Controles perimetrales

- rate limit de login por IP/usuario;
- límite de cuerpo JSON y de colecciones;
- CORS configurable por origen exacto;
- CSP, `frame-ancestors 'none'`, `nosniff` y política de referrer;
- TLS/HSTS en el perfil productivo;
- validación de tipo, tamaño y hash para archivos;
- errores de autenticación genéricos;
- secretos obligatorios fuera del repositorio.

La confianza de `X-Forwarded-For` está limitada al proxy previsto; no debe exponerse directamente el backend a Internet.

## 5. Configuración y secretos

El archivo `.env` local no se versiona. `.env.example` documenta las claves sin valores sensibles.

Variables obligatorias:

| Variable | Propósito |
|---|---|
| `POSTGRES_PASSWORD` | Credencial de la base. |
| `JWT_SECRET_BASE64` | Clave HMAC aleatoria codificada en Base64. |
| `BOOTSTRAP_ADMIN_PASSWORD` | Contraseña inicial del administrador. |

Variables operativas destacadas:

| Variable | Uso |
|---|---|
| `POSTGRES_DB`, `POSTGRES_USER` | Nombre/usuario PostgreSQL. |
| `JWT_ISSUER`, `ACCESS_TOKEN_MINUTES`, `REFRESH_TOKEN_DAYS` | Emisor y vencimientos. |
| `CORS_ALLOWED_ORIGINS` | Orígenes explícitos permitidos. |
| `COOKIE_SECURE` | Debe ser `true` detrás de HTTPS. |
| `STORAGE_PATH` | Ruta del volumen de archivos. |
| `FRONTEND_PORT` | Puerto publicado local. |
| `BOOTSTRAP_ADMIN_FORCE_PASSWORD_CHANGE` | Exige cambio al primer ingreso. |
| `FEL_ENABLED`, `FEL_PROVIDER_CODE`, `FEL_CREDENTIAL_SECRET_REF` | Integración FEL opcional. |

No registre valores secretos en tickets, auditoría, capturas, comandos compartidos ni documentación.

## 6. Modelo oficial PostgreSQL

Flyway es la única fuente ejecutable de esquema. V1–V18 crean 54 tablas agrupadas así:

- identidad, roles, dispositivos, sesiones, empresa, archivos, FEL y auditoría;
- productos, presentaciones, conversiones y precios versionados;
- clientes, rutas, vehículos y asignaciones históricas;
- ubicaciones, saldos, libro de movimientos y cargas;
- ventas, ítems, pagos, crédito e idempotencia;
- provisionales, mermas, devoluciones y alertas;
- liquidaciones, autorizaciones, incidencias y anulaciones;
- comprobantes internos y documentos FEL.

El ERD reconciliado está en `diagrams/erd/postgresql-erd.mmd`. `diagrams/erd/README.md` relaciona cada migración con su alcance.

Reglas de evolución:

1. No editar una migración aplicada.
2. Crear la siguiente `V{n}__descripcion.sql`.
3. Mantener la migración compatible con datos existentes.
4. Actualizar entidades/adaptadores, pruebas, ERD y documentación en el mismo cambio.
5. Verificar desde una base vacía y desde la versión anterior soportada.

## 7. Invariantes transaccionales

### Inventario

`inventory_movement` es inmutable; `inventory_balance` es la proyección bloqueable por ubicación/producto. Toda entrada o salida registra movimiento y actualiza saldo en la misma transacción. No se admite stock negativo.

### Precios

Las versiones activadas son históricas. El servidor selecciona precio vigente/tramo/especial y guarda las referencias usadas en `sale_item`.

### Venta

Asignación, cliente, precio, crédito, inventario, numeración, venta, ítems y pagos se validan/registran atómicamente. Un error revierte el conjunto.

### Crédito y pagos

La cuenta se representa con entradas inmutables; las anulaciones generan compensaciones. Transferencias conservan estado de verificación y quién tomó la decisión.

### Carga y liquidación

Bodega y vendedor confirman por separado. La liquidación solo cierra sin Outbox pendiente; calcula diferencias desde libros oficiales y deja la carga en estado liquidado.

### Anulación

La venta original no se borra. Una decisión autorizada crea movimientos y reversos exactos con correlación/auditoría.

## 8. Base móvil IndexedDB

`frontend/src/offline/mobileDatabase.ts` define `agua-pura-mobile`, versión 2, con 26 object stores. El ERD lógico está en `diagrams/erd/mobile-indexeddb-erd.mmd`.

Categorías:

- contexto autorizado, empresa, paquete de ruta, clientes, productos y precios;
- carga e inventario móvil;
- ventas, pagos, mermas y devoluciones locales con detalles;
- Outbox, resultados de sincronización, archivos y comprobantes.

No se almacenan contraseñas, refresh tokens, secretos FEL ni datos administrativos innecesarios. Al cambiar de usuario/dispositivo o cerrar sesión se aplica aislamiento/borrado seguro del contexto local.

## 9. ConnectionManager y SyncEngine

`ConnectionManager` modela `UNKNOWN`, `CHECKING`, `OFFLINE`, `DEGRADED` y `ONLINE`; usa timeout, cooldown, backoff y eventos de ciclo de vida. `navigator.onLine` no se toma como prueba suficiente: se consulta `/api/connectivity` con `no-store`.

`SyncEngine`:

1. Lee operaciones Outbox listas por dependencias.
2. Envía lotes con `deviceId` y `clientOperationId`.
3. El backend calcula hash canónico y reserva `sync_operation`.
4. Ejecuta cada operación en transacción.
5. Persiste resultado oficial antes de responder.
6. Actualiza referencias locales y estado del Outbox.

Reenviar una operación idéntica devuelve `ALREADY_PROCESSED`. Reutilizar el UUID con otro contenido genera conflicto. El servidor es responsable de la idempotencia; la PWA no puede asumirla localmente.

## 10. Archivos, comprobantes y FEL

`file_object` conserva metadatos, propósito, tamaño, MIME, storage key y SHA-256. El contenido vive en `file_storage`/`STORAGE_PATH` y debe respaldarse junto con PostgreSQL.

PDFBox crea el comprobante interno desde el snapshot histórico de la venta/empresa. `receipt_document` vincula venta, archivo, hash, usuario y dispositivo generador.

FEL usa un puerto/adaptador opcional. Sin implementación y credenciales reales, activar FEL responde `FEL_PROVIDER_UNAVAILABLE`; nunca simula una certificación. Un adaptador futuro debe ser idempotente por venta, validar respuesta/firma, persistir autorización y archivo certificado, y auditar cada transición.

## 11. Auditoría y observabilidad

Los eventos críticos incluyen usuario, dispositivo, acción, recurso, resultado, dirección segura, correlación y datos sanitizados. La auditoría no se actualiza ni elimina desde la aplicación.

Actuator expone únicamente salud necesaria. Los logs deben mantener el mismo correlation ID y excluir:

- contraseñas y hashes;
- JWT y cookies;
- secretos/credenciales FEL;
- cuerpos completos con datos sensibles;
- binarios y evidencia privada.

Alertas operativas viven en el dominio (`alert`); alertas de infraestructura deben gestionarse en la plataforma de despliegue.

## 12. Pruebas

### Backend

```powershell
docker run --rm -v aguapura_m2:/root/.m2 -v "${PWD}:/workspace" `
  -w /workspace/backend maven:3.9.11-eclipse-temurin-21-alpine mvn -q test
```

Las pruebas de integración levantan PostgreSQL real con Testcontainers y verifican concurrencia, constraints, bloqueos, rollback, inmutabilidad, seguridad y migraciones.

### Frontend

```powershell
Set-Location frontend
npm ci
npm test -- --run --pool=threads
npm run build
```

Vitest usa jsdom y `fake-indexeddb` para componentes, persistencia móvil, migraciones, rollback local, ConnectionManager, SyncEngine y PWA.

### Aceptación E2E

```powershell
powershell -ExecutionPolicy Bypass -File frontend/scripts/run-e2e.ps1
```

El script crea un proyecto Compose aislado, ejecuta el recorrido 1–28, comprueba cinco reenvíos idempotentes, controles HTTP y después elimina contenedores/volúmenes temporales. Para regenerar capturas del manual:

```powershell
$env:E2E_CAPTURE_MANUAL='1'
powershell -ExecutionPolicy Bypass -File frontend/scripts/run-e2e.ps1
Remove-Item Env:E2E_CAPTURE_MANUAL
```

## 13. Construcción y despliegue

`docker compose up -d --build` construye backend y frontend con imágenes multi-stage. Los contenedores ejecutan como usuarios no privilegiados donde aplica y disponen de healthchecks/restart policy.

Para producción use también `docker-compose.prod.yml`, certificados montados, `SPRING_PROFILES_ACTIVE=prod`, `COOKIE_SECURE=true` y orígenes HTTPS explícitos. No publique 5432 ni 8080. Un balanceador externo debe conservar el esquema HTTPS y la IP únicamente desde redes de proxy confiables.

Los volúmenes persistentes son:

- `postgres_data`: esquema y datos oficiales;
- `file_storage`: logotipos, evidencias y comprobantes.

Ambos forman una sola unidad lógica de respaldo/restauración.

## 14. Convenciones de mantenimiento

- Java: nombres de caso de uso explícitos, DTO inmutables y `BigDecimal` para cantidades/importes.
- TypeScript: tipos estrictos, importes decimales serializados como texto cuando viven en IndexedDB.
- Fechas: instantes UTC en transporte/persistencia y zona empresarial para la fecha operativa.
- Identificadores: UUID para agregados/operaciones; correlativos únicamente para documentos oficiales.
- Errores: código estable, mensaje de usuario y correlation ID; no filtrar excepciones internas.
- Estado: transiciones explícitas y auditadas; no usar borrado físico para corregir hechos.
- Commits: migración, código, pruebas, ERD y documentación deben permanecer sincronizados.

## 15. Documentación relacionada

- `docs/ERS_SRS.md`: requisitos del sistema.
- `docs/REGLAS_NEGOCIO.md`: invariantes funcionales.
- `docs/MATRIZ_PERMISOS.md`: roles y acciones.
- `docs/MATRIZ_TRAZABILIDAD.md`: requisito → fase → evidencia.
- `docs/ARQUITECTURA.md`: decisiones arquitectónicas.
- `docs/MANUAL_USUARIO.md` y `.pdf`: operación por usuario.
- `diagrams/erd/README.md`: modelos PostgreSQL/IndexedDB.
