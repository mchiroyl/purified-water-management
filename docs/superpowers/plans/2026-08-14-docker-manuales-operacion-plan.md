# Limpieza Docker y actualización de manuales — Implementation Plan

> **For agentic workers:** Execute each task with evidence before advancing.

**Goal:** Dejar únicamente los recursos Docker oficiales de Agua Pura, actualizar los manuales que estén desalineados y verificar que el sistema pueda levantarse manualmente siguiendo el manual técnico.

**Architecture:** Se conservarán los tres servicios del `docker-compose.yml` oficial (`postgres`, `backend`, `frontend`) y sus dos volúmenes persistentes. Los recursos de E2E/QA y cachés sin referencias se eliminarán mediante nombres explícitos. La documentación se contrastará directamente contra Compose, `.env.example` y los scripts de instalación/respaldo.

**Tech Stack:** Docker Compose, PowerShell, Markdown, Spring Boot, React/Vite/PWA.

## Global Constraints

- No eliminar recursos etiquetados con proyectos Compose distintos de `purificadora`.
- No eliminar `purificadora_postgres_data` ni `purificadora_file_storage`.
- No exponer valores secretos de `.env`.
- Toda afirmación final debe tener una verificación ejecutada.

---

### Task 1: Inventario y clasificación Docker

**Files:** ninguno.

- [x] Listar contenedores, imágenes, volúmenes y proyectos Compose.
- [x] Confirmar montajes y etiquetas de los servicios oficiales.
- [x] Clasificar recursos temporales de E2E/QA, cachés sin referencias y recursos de otros proyectos.

### Task 2: Limpieza selectiva

**Files:** ninguno.

- [x] Verificar que cada volumen temporal candidato tenga cero referencias; no quedaron volúmenes nombrados de pruebas.
- [x] Eliminar únicamente imágenes/volúmenes de prueba identificados y caches del proyecto sin uso runtime; no hubo candidatos restantes en este inventario.
- [x] Confirmar que otros proyectos Docker permanezcan intactos.

### Task 3: Auditoría documental

**Files:**
- Inspect: `README.md`, `docs/MANUAL_USUARIO.md`, `docs/MANUAL_TECNICO.md`, `docs/INSTALACION_LOCAL_PRIMERA_VEZ.md`, `docker-compose.yml`, `.env.example`.

- [x] Comparar comandos, variables, puertos, healthchecks, credenciales iniciales, persistencia y orden de arranque.
- [x] Detectar instrucciones obsoletas o incompletas.

### Task 4: Actualización de manuales

**Files:**
- Modify: `docs/MANUAL_TECNICO.md` y/o `docs/INSTALACION_LOCAL_PRIMERA_VEZ.md` únicamente donde la auditoría encuentre divergencias.

- [x] Documentar preparación de `.env`, generación de secretos, `docker compose up -d --build`, validación de healthchecks, acceso web y detención.
- [x] Documentar que los volúmenes oficiales son persistentes y que los recursos de pruebas se levantan en proyectos aislados.

### Task 5: Verificación de levantamiento manual

**Files:** ninguno.

- [x] Ejecutar las instrucciones documentadas en la instalación oficial con el `.env` existente, sin alterar datos.
- [x] Confirmar `docker compose ps`, `/healthz`, `/api/connectivity`, readiness del backend y los volúmenes montados.
- [x] Ejecutar pruebas documentales (`git diff --check`) y dejar solo los cambios de documentación pendientes de registrar.
