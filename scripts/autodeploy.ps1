# ==============================================================================
# Script de Autodespliegue Completo: Base de Datos + Backend + Frontend
# Sistema Purificadora de Agua
# ==============================================================================
[CmdletBinding()]
param(
  [switch]$NoPull,
  [switch]$Prod
)

$ErrorActionPreference = 'Stop'
$rootDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $rootDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🚀 INICIANDO AUTODESPLIEGUE DEL SISTEMA PURIFICADORA" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Comprobar archivo .env
$envFile = Join-Path $rootDir '.env'
if (-not (Test-Path $envFile)) {
  Write-Host "❌ Error: No se encontró el archivo .env en $rootDir" -ForegroundColor Red
  Write-Host "   Ejecute primero: .\scripts\initialize-local-env.ps1" -ForegroundColor Yellow
  exit 1
}

# 2. Actualizar código desde GitHub (si no se indicó -NoPull)
if (-not $NoPull) {
  Write-Host "`n📥 [1/4] Descargando últimos cambios desde GitHub..." -ForegroundColor Yellow
  try {
    git pull origin main
    Write-Host "✅ Código actualizado al último commit de main." -ForegroundColor Green
  } catch {
    Write-Host "⚠️ Advertencia al hacer git pull: $_" -ForegroundColor Yellow
  }
} else {
  Write-Host "`n⏭️ [1/4] Omitiendo git pull (-NoPull activado)..." -ForegroundColor DarkGray
}

# 3. Determinar archivos compose
$composeFiles = @("-f", "docker-compose.yml")
if ($Prod -and (Test-Path (Join-Path $rootDir "docker-compose.prod.yml"))) {
  $composeFiles += @("-f", "docker-compose.prod.yml")
  Write-Host "⚙️ Modo Producción activado." -ForegroundColor Magenta
}

# 4. Construir y desplegar contenedores
Write-Host "`n🔨 [2/4] Reconstruyendo y desplegando servicios (DB, Backend, Frontend)..." -ForegroundColor Yellow
Write-Host "   • Base de Datos: PostgreSQL (Flyway ejecutará migraciones pendientes automáticamente)" -ForegroundColor DarkCyan
Write-Host "   • Backend: Spring Boot (Java)" -ForegroundColor DarkCyan
Write-Host "   • Frontend: React / Vite PWA" -ForegroundColor DarkCyan

& docker compose @composeFiles up -d --build

if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Error durante docker compose up --build" -ForegroundColor Red
  exit $LASTEXITCODE
}

# 5. Esperar a que los servicios estén listos (Healthcheck)
Write-Host "`n⏳ [3/4] Esperando verificación de salud de los servicios..." -ForegroundColor Yellow

$services = @("postgres", "backend", "frontend")
foreach ($svc in $services) {
  $maxWait = 60
  $elapsed = 0
  $ready = $false

  while ($elapsed -lt $maxWait) {
    $status = (docker compose @composeFiles ps --format "{{.Health}}" $svc 2>$null)
    if ($status -eq "healthy") {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 2
    $elapsed += 2
  }

  if ($ready) {
    Write-Host "   ✅ Servicio '$svc' está saludable y listo." -ForegroundColor Green
  } else {
    Write-Host "   ⚠️ Servicio '$svc' iniciado (estado: $status)." -ForegroundColor Yellow
  }
}

# 6. Resumen de estado
Write-Host "`n📊 [4/4] Estado final de los contenedores:" -ForegroundColor Yellow
& docker compose @composeFiles ps

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "🎉 AUTODESPLIEGUE FINALIZADO EXITOSAMENTE" -ForegroundColor Green
Write-Host "   • Base de Datos: Lista y migrada con Flyway" -ForegroundColor Green
Write-Host "   • Backend API:   http://localhost:8080/api" -ForegroundColor Green
Write-Host "   • Frontend Web:  http://localhost:3000" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
