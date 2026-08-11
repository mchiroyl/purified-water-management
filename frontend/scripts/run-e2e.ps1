$ErrorActionPreference = 'Stop'

$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$frontend = Join-Path $workspace 'frontend'
$projectName = 'purificadora-e2e'
$env:FRONTEND_PORT = '3100'
$env:POSTGRES_PASSWORD = 'E2E-Database-Password-2026!'
$env:BOOTSTRAP_ADMIN_PASSWORD = 'E2E-Admin-Password-2026!'
$env:BOOTSTRAP_ADMIN_FORCE_PASSWORD_CHANGE = 'false'
$env:E2E_ADMIN_PASSWORD = $env:BOOTSTRAP_ADMIN_PASSWORD
$env:E2E_BASE_URL = 'http://127.0.0.1:3100'
$env:CORS_ALLOWED_ORIGINS = 'http://127.0.0.1:3100,http://localhost:3100'
$bytes = New-Object byte[] 48
$generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
$env:JWT_SECRET_BASE64 = [Convert]::ToBase64String($bytes)

try {
  docker compose -p $projectName -f (Join-Path $workspace 'docker-compose.yml') up -d --build
  if ($LASTEXITCODE -ne 0) { throw 'No fue posible iniciar el entorno E2E.' }
  $deadline = (Get-Date).AddMinutes(3)
  do {
    $health = docker inspect --format='{{.State.Health.Status}}' "$projectName-frontend-1" 2>$null
    if ($health -eq 'healthy') { break }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  if ($health -ne 'healthy') { throw "El frontend E2E no quedo saludable: $health" }
  Push-Location $frontend
  try { npm run test:e2e } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { throw 'Las pruebas E2E fallaron.' }
}
finally {
  docker compose -p $projectName -f (Join-Path $workspace 'docker-compose.yml') down -v --remove-orphans
}
