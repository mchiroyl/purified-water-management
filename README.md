# Sistema Agua Pura

Sistema operativo para una empresa purificadora: configura identidad empresarial, catálogo, precios, vendedores, rutas, clientes, bodega, cargas, ventas, pagos, mermas, devoluciones, liquidaciones, comprobantes, reportes y auditoría. La PWA permite operación móvil offline con sincronización idempotente.


## Inicio rápido

Requisitos: Docker Desktop con Compose v2, PowerShell y 4 GB de RAM.

```powershell
Set-Location 'E:\UMG\Purificadora'
powershell -ExecutionPolicy Bypass -File scripts/initialize-local-env.ps1
docker compose config --quiet
docker compose up -d --build
```

Abra `http://localhost:3000`, ingrese como `admin` con la contraseña temporal elegida en el inicializador y cámbiela cuando se solicite. Consulte [la guía de instalación](docs/INSTALACION_LOCAL_PRIMERA_VEZ.md) para cambiar puerto, resolver problemas y configurar HTTPS productivo.

## Documentación

- [Manual de usuario (Markdown)](docs/MANUAL_USUARIO.md) · [Manual de usuario (PDF)](docs/MANUAL_USUARIO.pdf)
- [Manual técnico](docs/MANUAL_TECNICO.md)
- [Instalación local y producción](docs/INSTALACION_LOCAL_PRIMERA_VEZ.md)
- [Respaldo y restauración](docs/RESPALDO_RESTAURACION.md)
- [API REST](docs/API.md)
- [Guía de desarrollo](docs/DEVELOPER_GUIDE.md)
- [ERS/SRS](docs/ERS_SRS.md) · [Reglas de negocio](docs/REGLAS_NEGOCIO.md)
- [Matriz de permisos](docs/MATRIZ_PERMISOS.md) · [Trazabilidad](docs/MATRIZ_TRAZABILIDAD.md)
- [Diagramas y ERD](diagrams/erd/README.md)
- [Política de seguridad](SECURITY.md)

## Desarrollo y pruebas

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

Aceptación completa, con Compose aislado:

```powershell
powershell -ExecutionPolicy Bypass -File frontend/scripts/run-e2e.ps1
```

## Estado de implementación

Las fases 0–39 están implementadas, verificadas y documentadas. La evidencia final está en [INFORME_VERIFICACION_FINAL.md](docs/INFORME_VERIFICACION_FINAL.md) y el avance se registra en [PLAN_IMPLEMENTACION.md](docs/PLAN_IMPLEMENTACION.md).

## Seguridad básica

