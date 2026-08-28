# Guía de desarrollo

## 1. Flujo de trabajo

1. Lea el requisito en `docs/ERS_SRS.md` y la regla en `docs/REGLAS_NEGOCIO.md`.
2. Actualice la matriz de trazabilidad si cambia el alcance.
3. Escriba primero una prueba que falle para la regla nueva.
4. Implemente dominio/caso de uso antes de adaptar REST o React.
5. Si cambia PostgreSQL, agregue una migración Flyway nueva; nunca edite una aplicada.
6. Actualice DTO/API, permisos, ERD, manuales y pruebas en el mismo cambio.
7. Ejecute pruebas específicas y luego la suite completa.
8. Revise `git diff --check` y no incluya `.env`, dumps ni artefactos locales.

## 2. Estructura

```text
backend/src/main/java/gt/com/aguapura/
  domain/           reglas, agregados y puertos
  application/      servicios de casos de uso y DTO
  infrastructure/   JDBC/JPA, JWT, archivos, PDF, configuración
  presentation/     REST, validación, errores y correlación
frontend/src/
  app/              rutas y shell
  features/         módulos por capacidad
  offline/          IndexedDB, Outbox y sincronización
  pwa/              ciclo de vida y actualización segura
  services/         cliente API
```

La dirección de dependencias es presentación → aplicación → dominio; infraestructura implementa puertos y no debe llevar reglas de negocio hacia el controlador.

## 3. Backend

### Nuevo caso de uso

- Defina el comando/consulta y sus invariantes en `application`/`domain`.
- Use `BigDecimal` para dinero/cantidad y `Instant` para eventos.
- Valide pertenencia de actor, dispositivo, ruta y recurso en el servicio.
- Registre auditoría de acción crítica con correlation ID.
- Encierre escrituras relacionadas en una transacción.
- Cree puerto de persistencia; impleméntelo con el adaptador JDBC/JPA.
- Exponga DTOs explícitos en controller; no devuelva entidades de persistencia.
- Añada pruebas de éxito, permisos, conflicto, rollback y concurrencia cuando aplique.

### Migración

```text
backend/src/main/resources/db/migration/V19__descripcion.sql
```

Incluya PK/FK/UNIQUE/CHECK/índices y timestamps necesarios. Actualice `diagrams/erd/postgresql-erd.mmd`, `diagrams/erd/README.md`, servicio, adaptador, tests y `docs/MATRIZ_TRAZABILIDAD.md`.

## 4. Frontend

- Una capacidad vive en `features/<modulo>`.
- La UI solo presenta acciones permitidas; la API vuelve a autorizarlas.
- Use TanStack Query para datos de servidor.
- Use `apiRequest` para Bearer, refresh y errores estándar.
- Para una operación offline, escriba agregado, detalles, proyección local y `outboxOperations` en una sola transacción IndexedDB.
- Mantenga UUID local estable y dependencias explícitas.
- No guarde secretos ni refresh tokens en IndexedDB/localStorage.
- Añada prueba jsdom y fake-indexeddb para migración, rollback y reapertura.

## 5. Pruebas locales

Backend:

```powershell
docker run --rm -v aguapura_m2:/root/.m2 -v "${PWD}:/workspace" `
  -w /workspace/backend maven:3.9.11-eclipse-temurin-21-alpine mvn -q test
```

Frontend:

```powershell
Set-Location frontend
npm ci
npm test -- --run --pool=threads
npm run build
```

E2E:

```powershell
powershell -ExecutionPolicy Bypass -File frontend/scripts/run-e2e.ps1
```

E2E usa el proyecto Compose `purificadora-e2e` y lo destruye al terminar. No reutilice ese nombre para una instalación con datos.

## 6. Contratos y errores

El contrato resumido está en `docs/API.md`. Los errores deben mantener `code`, `message`, `correlationId`, `timestamp` y `fieldErrors`. No devuelva stack traces ni mensajes de base de datos.

Un cambio incompatible requiere documentar versión/compatibilidad, actualizar frontend y E2E, y conservar lectura de datos existentes cuando sea posible.

## 7. Sincronización

`SyncEngine` solo envía operaciones cuyas dependencias están sincronizadas o reconocidas como procesadas. El backend reserva `clientOperationId + deviceId` y compara hash canónico. Un nuevo intento no debe crear un nuevo UUID por defecto.

Al añadir operación offline documente:

- `entityType` y `operationType`;
- `aggregateLocalId` y `clientOperationId`;
- dependencias;
- payload mínimo y referencias locales;
- resultado `ACCEPTED`, `ALREADY_PROCESSED`, `RETRYABLE`, `CONFLICT` o `REJECTED`;
- migración IndexedDB, si cambia estructura.

## 8. Seguridad durante desarrollo

- Use `.env` local, nunca credenciales en código.
- No copie JWT/refresh cookie a issues o capturas.
- No exponga puertos internos al host salvo una prueba explícita.
- Pruebe BOLA/IDOR, alcance por vendedor, revocación, rate limit y tamaños.
- Revise el resultado del escaneo de seguridad antes de integrar cambios.

## 9. Documentación y diagramas

Cuando una implementación cambie una relación, estado o actor, actualice el diagrama Mermaid correspondiente. Renderice los `.mmd` con Mermaid CLI y `PUPPETEER_EXECUTABLE_PATH` apuntando a Chrome/Edge disponible.

Para el PDF del manual:

```powershell
python scripts/generate_user_manual_pdf.py
```

Renderice con Poppler y revise páginas, imágenes, texto extraíble y número de páginas antes de entregar.

## 10. Revisión antes de commit

```powershell
git diff --check
git status --short
docker compose config --quiet
```

Confirme que no aparecen `.env`, `backups/*.dump`, `frontend/test-results`, `target/` ni `__pycache__`. El commit debe incluir pruebas y documentación de la misma decisión.
