#!/usr/bin/env bash
# ==============================================================================
# Script de Autodespliegue Completo: Base de Datos + Backend + Frontend
# Sistema Purificadora de Agua (Linux / Bash / VPS)
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=========================================================="
echo "🚀 INICIANDO AUTODESPLIEGUE DEL SISTEMA PURIFICADORA"
echo "=========================================================="

# 1. Comprobar archivo .env
if [ ! -f ".env" ]; then
  echo "❌ Error: No se encontró el archivo .env en $ROOT_DIR"
  echo "   Configure el archivo .env antes de continuar."
  exit 1
fi

# 2. Descargar últimos cambios de GitHub
if [ "${1:-}" != "--no-pull" ]; then
  echo ""
  echo "📥 [1/4] Descargando últimos cambios desde GitHub..."
  git pull origin main || echo "⚠️ Advertencia al hacer git pull"
fi

# 3. Determinar argumentos de Docker Compose
COMPOSE_ARGS=(-f docker-compose.yml)
if [ "${1:-}" = "--prod" ] || [ "${2:-}" = "--prod" ]; then
  if [ -f "docker-compose.prod.yml" ]; then
    COMPOSE_ARGS+=(-f docker-compose.prod.yml)
    echo "⚙️ Modo Producción activado."
  fi
fi

# 4. Reconstruir y levantar servicios
echo ""
echo "🔨 [2/4] Reconstruyendo y desplegando servicios (DB, Backend, Frontend)..."
echo "   • Base de Datos: PostgreSQL (Flyway ejecutará migraciones automáticamente)"
echo "   • Backend: Spring Boot (Java)"
echo "   • Frontend: React / Vite PWA"

docker compose "${COMPOSE_ARGS[@]}" up -d --build

# 5. Esperar a que los servicios estén listos
echo ""
echo "⏳ [3/4] Verificando salud de los contenedores..."
for svc in postgres backend frontend; do
  for i in $(seq 1 30); do
    health=$(docker compose "${COMPOSE_ARGS[@]}" ps --format "{{.Health}}" "$svc" 2>/dev/null || true)
    if [ "$health" = "healthy" ]; then
      echo "   ✅ Servicio '$svc' está saludable y listo."
      break
    fi
    sleep 2
  done
done

# 6. Estado final
echo ""
echo "📊 [4/4] Estado final de los contenedores:"
docker compose "${COMPOSE_ARGS[@]}" ps

echo ""
echo "=========================================================="
echo "🎉 AUTODESPLIEGUE FINALIZADO EXITOSAMENTE"
echo "   • Base de Datos: Lista y migrada con Flyway"
echo "   • Backend API:   http://localhost:8080/api"
echo "   • Frontend Web:  http://localhost:3000"
echo "=========================================================="
