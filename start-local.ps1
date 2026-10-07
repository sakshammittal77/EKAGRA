# Hosts EKAGRA on this computer: backend (port 8010) + website (port 5173, also on your Wi-Fi).
# Run: right-click > "Run with PowerShell", or double-click start-local.bat
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$name = if ($args[0]) { $args[0] } else { $env:USERNAME }

# --- Node.js (installed, or the portable copy in %LOCALAPPDATA%\node-portable) ---
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  $node = Get-ChildItem "$env:LOCALAPPDATA\node-portable\node-*\node.exe" -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $node) { throw 'Node.js not found. Install the LTS version from https://nodejs.org' }
$nodeDir = Split-Path $node

# --- Backend: Python venv + local settings ---
$backend = Join-Path $root 'backend'
$py = Join-Path $backend '.venv\Scripts\python.exe'
if (-not (Test-Path $py)) {
  Write-Host 'Setting up the backend (first run only)...'
  python -m venv (Join-Path $backend '.venv')
  & $py -m pip install -q -r (Join-Path $backend 'requirements.txt')
}
if (-not (Test-Path (Join-Path $backend '.env'))) {
  "MONGODB_URI=memory`nDEV_AUTH=true`nALLOWED_ORIGINS=http://localhost:5173" | Set-Content -Encoding utf8 (Join-Path $backend '.env')
}

# --- Frontend: packages + local settings ---
$frontend = Join-Path $root 'frontend'
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
  Write-Host 'Installing website packages (first run only)...'
  Push-Location $frontend; & (Join-Path $nodeDir 'npm.cmd') install; Pop-Location
}
if (-not (Test-Path (Join-Path $frontend '.env.local'))) {
  "VITE_ENABLE_DEMO=true`nVITE_API_URL=/" | Set-Content -Encoding utf8 (Join-Path $frontend '.env.local')
}

# --- Start both in their own windows ---
Start-Process powershell -WorkingDirectory $backend -ArgumentList '-NoExit', '-Command',
  "`$host.UI.RawUI.WindowTitle='EKAGRA backend :8010'; & '$py' -m uvicorn main:app --port 8010"
Start-Process powershell -WorkingDirectory $frontend -ArgumentList '-NoExit', '-Command',
  "`$host.UI.RawUI.WindowTitle='EKAGRA website :5173'; & '$node' node_modules/vite/bin/vite.js --host"

$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.PrefixOrigin -in 'Dhcp', 'Manual' -and $_.IPAddress -notlike '169.*' } |
  Select-Object -First 1).IPAddress

Write-Host ''
Write-Host "EKAGRA is starting..." -ForegroundColor Yellow
Write-Host "  This computer : http://localhost:5173/?demo=$name"
if ($ip) { Write-Host "  Phone (Wi-Fi) : http://${ip}:5173/?demo=$name" }
Write-Host '  Close the two EKAGRA windows to stop it.'
Start-Sleep -Seconds 4
Start-Process "http://localhost:5173/?demo=$name"
