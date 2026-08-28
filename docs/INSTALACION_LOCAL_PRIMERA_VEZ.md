# Instalación local por primera vez

Esta guía instala el sistema completo para una sola purificadora usando Docker Compose. No expone PostgreSQL ni Spring Boot al host; la entrada única es el frontend Nginx.

## 1. Requisitos

- Windows 10/11 con PowerShell 5.1+ o PowerShell 7.
- Docker Desktop reciente con Docker Compose v2.
- Git, solo si el proyecto se obtiene desde un repositorio.
- 4 GB de RAM disponibles y aproximadamente 5 GB de disco para imágenes/volúmenes.
- Puerto 3000 libre, o elegir otro en `.env`.

Compruebe:

```powershell
docker --version
docker compose version
docker info
```

`docker info` debe terminar correctamente antes de continuar.

## 2. Ubicar el proyecto

Abra PowerShell en la carpeta raíz que contiene:

```text
backend/
frontend/
docker-compose.yml
.env.example
```

En esta instalación local la ruta es:

```powershell
Set-Location 'E:\UMG\Purificadora'
```

Si el proyecto se clonó en otra carpeta, use esa ruta.

## 3. Crear secretos y cuenta inicial

Ejecute una sola vez:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/initialize-local-env.ps1
```

El script solicita de forma oculta la contraseña temporal de `admin`, genera contraseñas aleatorias para PostgreSQL/JWT y crea `.env`. No imprime los secretos y no sobrescribe un archivo existente.

La contraseña elegida debe tener 12–128 caracteres, mayúscula, minúscula y número. Para evitar ambigüedad en `.env`, use letras, números y alguno de: `! @ % _ + = : , . ? -`.

No comparta ni versione `.env`. Haga una copia cifrada en el gestor de secretos/respaldo autorizado.

## 4. Validar configuración sin mostrar secretos

```powershell
docker compose config --quiet
```

Use `--quiet`: ejecutar `docker compose config` sin esa opción puede imprimir valores interpolados, incluidos secretos.

Si el puerto 3000 está ocupado, edite únicamente esta línea de `.env`:

```dotenv
FRONTEND_PORT=3001
```

Y agregue el origen equivalente a `CORS_ALLOWED_ORIGINS`.

## 5. Construir e iniciar

```powershell
docker compose up -d --build
```

La primera construcción descarga PostgreSQL, Maven/JDK, Node y Nginx. Flyway aplica automáticamente V1–V18; Hibernate valida que el modelo coincida con las 54 tablas.

Compruebe:

```powershell
docker compose ps
docker compose logs --tail 80 backend
```

Los servicios `postgres`, `backend` y `frontend` deben mostrar `healthy`. Los logs no deben mostrar errores Flyway/Hibernate.

## 6. Primer ingreso

Abra:

```text
http://localhost:3000
```

Si cambió `FRONTEND_PORT`, use ese puerto.

- Usuario: `admin` (o el valor privado de `BOOTSTRAP_ADMIN_USERNAME`).
- Contraseña: la que introdujo al ejecutar el inicializador.
- Dispositivo: use un nombre reconocible, por ejemplo `PC Administración`.

El sistema obliga a cambiar la contraseña temporal. Después siga el orden:

1. Datos de la empresa y numeración.
2. Usuarios/vendedores.
3. Productos y presentaciones.
4. Precios vigentes.
5. Rutas, vehículos y clientes.
6. Ubicaciones, existencia y carga.

Consulte `docs/MANUAL_USUARIO.pdf`.

## 7. Verificaciones rápidas

Desde PowerShell:

```powershell
Invoke-WebRequest http://localhost:3000/healthz -UseBasicParsing
Invoke-WebRequest http://localhost:3000/api/connectivity -UseBasicParsing
```

Ambas respuestas deben ser HTTP 200. PostgreSQL y backend no deben responder en `localhost:5432` ni `localhost:8080`, porque son internos.

Verifique cabeceras:

```powershell
(Invoke-WebRequest http://localhost:3000 -UseBasicParsing).Headers
```

Deben existir, entre otras, `X-Content-Type-Options`, `X-Frame-Options` y `Content-Security-Policy`.

## 8. Operación diaria del entorno

Iniciar:

```powershell
docker compose up -d
```

Detener sin borrar datos:

```powershell
docker compose stop
```

Reiniciar:

```powershell
docker compose restart
```

Ver estado/logs:

```powershell
docker compose ps
docker compose logs --tail 100
```

Actualizar después de recibir código nuevo:

```powershell
docker compose up -d --build
```

Antes de actualizar, haga respaldo PostgreSQL y del volumen de archivos según `docs/RESPALDO_RESTAURACION.md`.

## 9. No borrar datos por accidente

`docker compose down` elimina contenedores/red pero conserva volúmenes si no se agrega `-v`.

No ejecute:

```text
docker compose down -v
docker volume rm ...
```

en una instalación con datos que deban conservarse. `-v` elimina la base y archivos persistentes de esa instalación.

En la instalación oficial los volúmenes persistentes se identifican como `purificadora_postgres_data` (base de datos) y `purificadora_file_storage` (archivos). Los proyectos de pruebas E2E usan nombres Compose aislados y se eliminan al terminar.

## 10. Solución de problemas

### Docker no está disponible

Inicie Docker Desktop y espere a que `docker info` responda.

### Falta una variable obligatoria

El mensaje `Configure ... en .env` indica que `.env` falta o está incompleto. Vuelva a ejecutar el inicializador solo si `.env` no existe; nunca elimina/sobrescribe el existente.

### Puerto ocupado

Cambie `FRONTEND_PORT` y `CORS_ALLOWED_ORIGINS`. Luego:

```powershell
docker compose up -d --force-recreate frontend backend
```

### Backend no está healthy

```powershell
docker compose logs --tail 200 postgres backend
docker compose ps
```

Busque fallo de conexión, credencial, migración o espacio en disco. No edite una migración aplicada.

### La contraseña inicial no funciona

La cuenta bootstrap se crea solo cuando no existe ningún usuario. Cambiar `BOOTSTRAP_ADMIN_PASSWORD` después no modifica una cuenta ya creada. Use el flujo autorizado de administración/restablecimiento; no cambie hashes directamente en PostgreSQL.

### Navegador conserva una versión anterior

Cierre/reabra la PWA y acepte la actualización cuando se muestre. No borre datos del sitio si existen operaciones offline pendientes.

## 11. Instalación productiva HTTPS

No use HTTP local como despliegue productivo. Configure en `.env`:

- `PUBLIC_ORIGIN=https://dominio:puerto`;
- `TLS_CERT_PATH` y `TLS_KEY_PATH` con rutas absolutas a certificado/clave;
- `COOKIE_SECURE=true`;
- orígenes HTTPS exactos;
- secretos externos y respaldados.

Inicie:

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

El perfil productivo desactiva Swagger/OpenAPI, fuerza cookie segura y expone únicamente salud mínima. Proteja la clave TLS y renueve certificados antes de vencer.


## 13. Instalación manual sin el inicializador

En otro sistema operativo, copie `.env.example` a `.env` y complete, como mínimo:

- una contraseña PostgreSQL aleatoria;
- `JWT_SECRET_BASE64` con 64 bytes aleatorios codificados Base64;
- una contraseña temporal robusta para `admin`;
- `BOOTSTRAP_ADMIN_FORCE_PASSWORD_CHANGE=true`.

Ejemplo para generar solo JWT en Linux/macOS:

```bash
openssl rand -base64 64
```

No reutilice secretos entre instalaciones ni confirme `.env` en Git.
