# Respaldo y restauración

Un respaldo válido del Sistema Agua Pura incluye simultáneamente:

1. PostgreSQL (`database.dump`).
2. Archivos persistentes (`files.tar.gz`): logotipo, evidencias y comprobantes.
3. `manifest.json` con versión, fecha, base, commit y hashes SHA-256.

Copiar solo la base o solo el volumen de archivos deja referencias incompletas.

## 1. Crear respaldo

Con los tres servicios saludables:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup.ps1
```

La salida es la carpeta creada, por ejemplo:

```text
backups/agua-pura-20260811T120000Z-a1b2c3d4/
  database.dump
  files.tar.gz
  manifest.json
```

El script usa `pg_dump -Fc`, comprueba el catálogo con `pg_restore --list`, empaqueta `/app/storage` y calcula hashes. No incluye `.env`, contraseñas ni claves TLS.

### Carpeta externa

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup.ps1 `
  -BackupDirectory 'D:\Respaldos\AguaPura'
```

Después copie el conjunto completo a almacenamiento cifrado y fuera del equipo. Conserve al menos una copia desconectada.

## 2. Política recomendada

- diario: 7 copias;
- semanal: 5 copias;
- mensual: 12 copias;
- antes de toda actualización/restauración: una copia adicional;
- prueba de restauración: mensual y después de cambios de esquema.

Defina RPO/RTO según el negocio. Un respaldo no probado no se considera recuperable.

## 3. Verificar sin restaurar

```powershell
$set = 'D:\Respaldos\AguaPura\agua-pura-...'
$manifest = Get-Content "$set\manifest.json" -Raw | ConvertFrom-Json
(Get-FileHash "$set\database.dump" -Algorithm SHA256).Hash.ToLowerInvariant() -eq $manifest.databaseSha256
(Get-FileHash "$set\files.tar.gz" -Algorithm SHA256).Hash.ToLowerInvariant() -eq $manifest.filesSha256
```

Ambas expresiones deben ser `True`. `restore.ps1` repite obligatoriamente estas comprobaciones.

## 4. Restaurar

La restauración reemplaza datos y archivos del proyecto destino. Cierre el acceso de usuarios y confirme que eligió la instalación correcta.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restore.ps1 `
  -BackupSet 'D:\Respaldos\AguaPura\agua-pura-...'
```

El script:

1. valida manifiesto, archivos y hashes;
2. verifica que el nombre de base coincida;
3. solicita escribir exactamente `RESTAURAR`;
4. crea automáticamente un respaldo previo en `backups/pre-restore`;
5. detiene frontend/backend;
6. restaura PostgreSQL con `--clean --if-exists`;
7. reemplaza el contenido de `/app/storage` desde el archivo;
8. inicia servicios y espera ambos healthchecks.

`-Force` omite únicamente la pregunta interactiva. `-SkipSafetyBackup` omite la copia previa y debe reservarse para pruebas automatizadas en entornos desechables.

## 5. Verificación posterior

```powershell
docker compose ps
docker compose logs --tail 100 postgres backend frontend
Invoke-WebRequest http://localhost:3000/healthz -UseBasicParsing
Invoke-WebRequest http://localhost:3000/api/connectivity -UseBasicParsing
```

Después ingrese y verifique:

- identidad/logotipo empresarial;
- usuarios y rutas;
- último correlativo de venta;
- saldos de inventario;
- última liquidación;
- descarga de un comprobante histórico;
- auditoría reciente.

## 6. Proyecto Compose con nombre

Para una instalación levantada con `docker compose -p purificadora-prod`, use el mismo nombre:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/backup.ps1 -ComposeProjectName purificadora-prod
powershell -ExecutionPolicy Bypass -File scripts/restore.ps1 `
  -ComposeProjectName purificadora-prod -BackupSet 'D:\Respaldos\AguaPura\agua-pura-...'
```

No restaure un respaldo de otra empresa/base: el script bloquea nombres de base diferentes, pero el operador sigue siendo responsable de confirmar el destino.

## 7. Recuperación ante fallo

Si la restauración falla:

1. no permita nuevas operaciones;
2. conserve logs y el conjunto fallido sin modificar;
3. use el respaldo automático de `backups/pre-restore`;
4. corrija la causa (espacio, permisos, archivo corrupto o versión);
5. repita desde una copia intacta;
6. documente el incidente y las verificaciones.

No repare tablas manualmente ni borre `flyway_schema_history`.

## 8. Secretos y certificados

Los scripts no respaldan deliberadamente:

- `.env`;
- claves privadas TLS;
- secretos de proveedor FEL;
- credenciales del almacenamiento externo.

Mantenga estos elementos en un gestor de secretos con su propio respaldo cifrado. En una recuperación total deben restaurarse por canal separado antes de iniciar el sistema.
