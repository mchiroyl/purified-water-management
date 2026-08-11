[CmdletBinding()]
param(
  [string]$BackupDirectory = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path 'backups'),
  [string]$ComposeProjectName
)

$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$composeFile = Join-Path $workspace 'docker-compose.yml'
$backupRoot = [System.IO.Path]::GetFullPath($BackupDirectory)
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$setName = "agua-pura-$timestamp-$([guid]::NewGuid().ToString('N').Substring(0, 8))"
$backupSet = Join-Path $backupRoot $setName

function Invoke-Docker([string[]]$DockerArguments) {
  & docker @DockerArguments
  if ($LASTEXITCODE -ne 0) { throw "Docker falló: docker $($DockerArguments -join ' ')" }
}

$composeArguments = @('compose')
if ($ComposeProjectName) { $composeArguments += @('-p', $ComposeProjectName) }
$composeArguments += @('-f', $composeFile)

Invoke-Docker ($composeArguments + @('config', '--quiet'))
$postgresContainer = (& docker @($composeArguments + @('ps', '-q', 'postgres'))).Trim()
if ($LASTEXITCODE -ne 0 -or -not $postgresContainer) { throw 'PostgreSQL no está iniciado para este proyecto Compose.' }
$backendContainer = (& docker @($composeArguments + @('ps', '-q', 'backend'))).Trim()
if ($LASTEXITCODE -ne 0 -or -not $backendContainer) { throw 'Backend no está iniciado para este proyecto Compose.' }

New-Item -ItemType Directory -Path $backupSet | Out-Null
$databaseFile = Join-Path $backupSet 'database.dump'
$filesArchive = Join-Path $backupSet 'files.tar.gz'
$manifestFile = Join-Path $backupSet 'manifest.json'
$remoteDatabase = "/tmp/$setName.dump"
$remoteFiles = "/tmp/$setName-files.tar.gz"

try {
  Invoke-Docker @('exec', $postgresContainer, 'sh', '-c', "pg_dump -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" -Fc -f '$remoteDatabase'")
  Invoke-Docker @('cp', "${postgresContainer}:$remoteDatabase", $databaseFile)
  Invoke-Docker @('exec', $postgresContainer, 'pg_restore', '--list', $remoteDatabase)

  Invoke-Docker @('exec', $backendContainer, 'sh', '-c', "tar -czf '$remoteFiles' -C /app/storage .")
  Invoke-Docker @('cp', "${backendContainer}:$remoteFiles", $filesArchive)

  $databaseName = (& docker exec $postgresContainer sh -c 'printf "%s" "$POSTGRES_DB"').Trim()
  if ($LASTEXITCODE -ne 0) { throw 'No fue posible leer el nombre de la base.' }
  $databaseUser = (& docker exec $postgresContainer sh -c 'printf "%s" "$POSTGRES_USER"').Trim()
  if ($LASTEXITCODE -ne 0) { throw 'No fue posible leer el usuario de la base.' }
  $gitCommit = (& git -C $workspace rev-parse HEAD 2>$null).Trim()
  if ($LASTEXITCODE -ne 0) { $gitCommit = $null }

  $manifest = [ordered]@{
    formatVersion = 1
    createdAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    databaseName = $databaseName
    databaseUser = $databaseUser
    gitCommit = $gitCommit
    databaseFile = 'database.dump'
    databaseSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $databaseFile).Hash.ToLowerInvariant()
    filesArchive = 'files.tar.gz'
    filesSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $filesArchive).Hash.ToLowerInvariant()
  }
  [System.IO.File]::WriteAllText($manifestFile, ($manifest | ConvertTo-Json), [System.Text.UTF8Encoding]::new($false))
  Write-Output $backupSet
}
finally {
  & docker exec $postgresContainer rm -f $remoteDatabase 2>$null | Out-Null
  & docker exec $backendContainer rm -f $remoteFiles 2>$null | Out-Null
}
