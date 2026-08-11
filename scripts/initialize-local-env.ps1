[CmdletBinding()]
param(
  [string]$OutputPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path '.env'),
  [Security.SecureString]$AdminPassword
)

$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$templatePath = Join-Path $workspace '.env.example'
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)

if (-not (Test-Path -LiteralPath $templatePath -PathType Leaf)) {
  throw "No se encontró la plantilla $templatePath"
}
if (Test-Path -LiteralPath $resolvedOutput) {
  throw "El archivo ya existe y no será sobrescrito: $resolvedOutput"
}

if (-not $AdminPassword) {
  $AdminPassword = Read-Host 'Defina la contraseña temporal del usuario admin' -AsSecureString
}

$passwordPointer = [IntPtr]::Zero
$plainPassword = $null
try {
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($AdminPassword)
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  if ($plainPassword.Length -lt 12 -or $plainPassword.Length -gt 128) {
    throw 'La contraseña del administrador debe tener entre 12 y 128 caracteres.'
  }
  if ($plainPassword -notmatch '[A-Z]' -or $plainPassword -notmatch '[a-z]' -or $plainPassword -notmatch '[0-9]') {
    throw 'La contraseña debe incluir mayúscula, minúscula y número.'
  }
  if ($plainPassword -notmatch '^[A-Za-z0-9!@%_+=:,.?-]+$') {
    throw 'Use únicamente letras, números y ! @ % _ + = : , . ? - para evitar ambigüedad en .env.'
  }

  function New-RandomBase64([int]$byteCount) {
    $bytes = New-Object byte[] $byteCount
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return [Convert]::ToBase64String($bytes)
  }

  function New-RandomEnvironmentPassword {
    return ((New-RandomBase64 36).Replace('+', '_').Replace('/', '-').TrimEnd('=')) + 'Aa1!'
  }

  $postgresPassword = New-RandomEnvironmentPassword
  $jwtSecret = New-RandomBase64 64
  $content = Get-Content -LiteralPath $templatePath -Raw -Encoding UTF8
  $content = [regex]::Replace($content, '(?m)^POSTGRES_PASSWORD=.*$', "POSTGRES_PASSWORD=$postgresPassword")
  $content = [regex]::Replace($content, '(?m)^JWT_SECRET_BASE64=.*$', "JWT_SECRET_BASE64=$jwtSecret")
  $content = [regex]::Replace($content, '(?m)^BOOTSTRAP_ADMIN_PASSWORD=.*$', "BOOTSTRAP_ADMIN_PASSWORD=$plainPassword")
  $content = [regex]::Replace($content, '(?m)^BOOTSTRAP_ADMIN_FORCE_PASSWORD_CHANGE=.*$', 'BOOTSTRAP_ADMIN_FORCE_PASSWORD_CHANGE=true')

  $parent = Split-Path -Parent $resolvedOutput
  if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
    New-Item -ItemType Directory -Path $parent | Out-Null
  }
  [System.IO.File]::WriteAllText($resolvedOutput, $content, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Configuración creada en $resolvedOutput"
  Write-Host 'Los secretos generados no se mostraron. El sistema exigirá cambiar la contraseña de admin al primer ingreso.'
}
finally {
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
  $plainPassword = $null
}
