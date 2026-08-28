$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$manual = Get-Content (Join-Path $root 'docs/MANUAL_USUARIO.md') -Raw
$api = Get-Content (Join-Path $root 'docs/API.md') -Raw
$technical = Get-Content (Join-Path $root 'docs/MANUAL_TECNICO.md') -Raw

$requiredManualTerms = @(
    'Inicio', 'Productos', 'Clientes', 'Rutas', 'Precios', 'Inventario', 'Cargas', 'Ventas',
    'Transferencias', 'Mermas', 'Devoluciones', 'Liquidaciones', 'Control operativo',
    'Anulaciones', 'Pendientes', 'Reportes', 'Auditoría', 'Usuarios', 'Datos de la empresa',
    'CLI-', 'VND-', 'RUT-', 'VEH-', 'Recarga', 'Excel', 'PDF', '401'
)
$missing = $requiredManualTerms | Where-Object { $manual -notmatch [regex]::Escape($_) }
if ($missing.Count -gt 0) {
    throw "Faltan términos requeridos en docs/MANUAL_USUARIO.md: $($missing -join ', ')"
}

$requiredApiTerms = @(
    '/loads/replenishments', '/reports/sales.xlsx', '/reports/sales.pdf',
    '/reports/wastes.xlsx', '/reports/wastes.pdf', '/reports/settlements.xlsx', '/reports/settlements.pdf',
    'CLI-', 'VND-', 'RUT-', 'VEH-'
)
$missingApi = $requiredApiTerms | Where-Object { $api -notmatch [regex]::Escape($_) }
if ($missingApi.Count -gt 0) {
    throw "Faltan contratos requeridos en docs/API.md: $($missingApi -join ', ')"
}

if ($technical -notmatch 'Flyway.*V19' -or $technical -notmatch 'refresh') {
    throw 'docs/MANUAL_TECNICO.md no documenta la migración V19 y la renovación de sesión.'
}

Write-Output 'Documentacion operativa verificada: manual, API y manual tecnico contienen los cambios solicitados.'
