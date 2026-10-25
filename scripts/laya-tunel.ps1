# Laya desde tu PC para la API de Render: Ollaya con clave + túnel gratuito de Cloudflare.
# Uso (en la raíz del repo):  powershell -ExecutionPolicy Bypass -File scripts\laya-tunel.ps1
# Déjalo abierto: al cerrar la ventana se cierra el túnel (y la API sigue con Groq/Gemini).
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

# 1) Clave: se genera una vez y se guarda en .env (que Git ignora). Nunca se imprime.
$envFile = '.env'
if (-not (Test-Path $envFile)) { New-Item -ItemType File $envFile | Out-Null }
$envText = Get-Content $envFile -Raw
if ($envText -notmatch '(?m)^LAYA_API_KEY=\S+') {
  $bytes = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $key = -join ($bytes | ForEach-Object { $_.ToString('x2') })
  Add-Content $envFile "`nLAYA_API_KEY=$key"
  Write-Host 'Clave generada y guardada en .env (LAYA_API_KEY).'
}

# 2) Ollaya con clave en 127.0.0.1:11436
docker compose --profile laya-public up -d ollaya-public
if ($LASTEXITCODE -ne 0) { throw 'No he podido arrancar el contenedor ollaya-public (¿Docker Desktop está abierto?).' }

# 3) cloudflared (túnel sin cuenta)
$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) {
  Write-Host 'Instalando cloudflared con winget...'
  winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
  $cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
  if (-not $cf) { $cf = Get-ChildItem "$env:ProgramFiles*\cloudflared\cloudflared.exe", "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Cloudflare.cloudflared*\cloudflared.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName }
  if (-not $cf) { throw 'cloudflared se instaló pero no lo encuentro: cierra y abre la terminal y vuelve a ejecutar el script.' }
}

# 4) Túnel: la URL aparece en el log de cloudflared
$log = Join-Path $env:TEMP 'laya-tunel.log'
Remove-Item $log -ErrorAction SilentlyContinue
$p = Start-Process $cf -ArgumentList 'tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:11436' -RedirectStandardError $log -RedirectStandardOutput "$log.out" -PassThru -WindowStyle Hidden
$url = $null
for ($i = 0; $i -lt 40 -and -not $url; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $log) { $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1; if ($m) { $url = $m.Matches[0].Value } }
}
if (-not $url) { $p.Kill(); throw "El túnel no ha dado URL; mira $log" }
Set-Clipboard $url
Write-Host ''
Write-Host "Túnel listo: $url  (copiada al portapapeles)" -ForegroundColor Green
Write-Host 'En Render > Environment:'
Write-Host '  LAYA_BASE_URL = la URL de arriba'
Write-Host '  LAYA_API_KEY  = el valor de LAYA_API_KEY de tu .env'
Write-Host 'Guarda y redespliega. Deja esta ventana abierta y el PC sin suspender.'
Write-Host 'Ctrl+C para cerrar el túnel.'
try { Wait-Process -Id $p.Id } finally { if (-not $p.HasExited) { $p.Kill() } }
