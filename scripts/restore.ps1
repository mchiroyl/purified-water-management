[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BackupSet,
  [string]$ComposeProjectName,
  [switch]$Force,
  [switch]$SkipSafetyBackup
)

$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$composeFile = Join-Path $workspace 'docker-compose.yml'
$resolvedSet = (Resolve-Path -LiteralPath $BackupSet).Path
$manifestFile = Join-Path $resolvedSet 'manifest.json'
if (-not (Test-Path -LiteralPath $manifestFile -PathType Leaf)) { throw 'El conjunto no contiene manifest.json.' }
$manifest = Get-Content -LiteralPath $manifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.formatVersion -ne 1) { throw "Formato de respaldo no soportado: $($manifest.formatVersion)" }
$databaseFile = Join-Path $resolvedSet $manifest.databaseFile
$filesArchive = Join-Path $resolvedSet $manifest.filesArchive
if (-not (Test-Path -LiteralPath $databaseFile -PathType Leaf)) { throw 'Falta database.dump.' }
if (-not (Test-Path -LiteralPath $filesArchive -PathType Leaf)) { throw 'Falta files.tar.gz.' }
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $databaseFile).Hash.ToLowerInvariant() -ne $manifest.databaseSha256) {
  throw 'El hash de database.dump no coincide con el manifiesto.'
}
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $filesArchive).Hash.ToLowerInvariant() -ne $manifest.filesSha256) {
  throw 'El hash de files.tar.gz no coincide con el manifiesto.'
}

function Invoke-Docker([string[]]$DockerArguments) {
  & docker @DockerArguments
  if ($LASTEXITCODE -ne 0) { throw "Docker falló: docker $($DockerArguments -join ' ')" }
}

$composeArguments = @('compose')
if ($ComposeProjectName) { $composeArguments += @('-p', $ComposeProjectName) }
$composeArguments += @('-f', $composeFile)
Invoke-Docker ($composeArguments + @('config', '--quiet'))
$postgresContainer = (& docker @($composeArguments + @('ps', '-q', 'postgres'))).Trim()
$backendContainer = (& docker @($composeArguments + @('ps', '-q', 'backend'))).Trim()
if (-not $postgresContainer -or -not $backendContainer) { throw 'PostgreSQL y backend deben existir en el proyecto Compose.' }

$currentDatabase = (& docker exec $postgresContainer sh -c 'printf "%s" "$POSTGRES_DB"').Trim()
if ($LASTEXITCODE -ne 0) { throw 'No fue posible determinar la base destino.' }
if ($currentDatabase -ne $manifest.databaseName) {
  throw "El respaldo pertenece a '$($manifest.databaseName)' y el destino es '$currentDatabase'."
}
if (-not $Force) {
  $confirmation = Read-Host "Se reemplazarán PostgreSQL y /app/storage de '$currentDatabase'. Escriba RESTAURAR"
  if ($confirmation -cne 'RESTAURAR') { throw 'Restauración cancelada.' }
}

if (-not $SkipSafetyBackup) {
  $safetyRoot = Join-Path $workspace 'backups\pre-restore'
  $safetySet = & (Join-Path $PSScriptRoot 'backup.ps1') -BackupDirectory $safetyRoot -ComposeProjectName $ComposeProjectName
  if ($LASTEXITCODE -ne 0) { throw 'No fue posible crear el respaldo de seguridad previo.' }
  Write-Host "Respaldo previo creado: $safetySet"
}

$remoteDatabase = "/tmp/agua-pura-restore-$([guid]::NewGuid().ToString('N')).dump"
$servicesStopped = $false
try {
  Invoke-Docker @('cp', $databaseFile, "${postgresContainer}:$remoteDatabase")
  Invoke-Docker @('exec', $postgresContainer, 'pg_restore', '--list', $remoteDatabase)
  Invoke-Docker ($composeArguments + @('stop', 'frontend', 'backend'))
  $servicesStopped = $true

  Invoke-Docker @('exec', $postgresContainer, 'sh', '-c', "pg_restore -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" --clean --if-exists --no-owner --no-privileges '$remoteDatabase'")

  $volumeMount = "${resolvedSet}:/restore:ro"
  Invoke-Docker @(
    'run', '--rm', '--volumes-from', $backendContainer, '-v', $volumeMount,
    'alpine:3.22', 'sh', '-c',
    'find /app/storage -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -xzf /restore/files.tar.gz -C /app/storage'
  )

  Invoke-Docker ($composeArguments + @('start', 'backend', 'frontend'))
  $servicesStopped = $false
  $deadline = (Get-Date).AddMinutes(3)
  do {
    $backendHealth = (& docker inspect --format='{{.State.Health.Status}}' $backendContainer 2>$null).Trim()
    $frontendContainer = (& docker @($composeArguments + @('ps', '-q', 'frontend'))).Trim()
    $frontendHealth = if ($frontendContainer) { (& docker inspect --format='{{.State.Health.Status}}' $frontendContainer 2>$null).Trim() } else { '' }
    if ($backendHealth -eq 'healthy' -and $frontendHealth -eq 'healthy') { break }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  if ($backendHealth -ne 'healthy' -or $frontendHealth -ne 'healthy') {
    throw "Los servicios no quedaron saludables: backend=$backendHealth frontend=$frontendHealth"
  }
  Write-Host "Restauración verificada desde $resolvedSet"
}
finally {
  & docker exec $postgresContainer rm -f $remoteDatabase 2>$null | Out-Null
  if ($servicesStopped) {
    & docker @($composeArguments + @('start', 'backend', 'frontend')) | Out-Null
  }
}
