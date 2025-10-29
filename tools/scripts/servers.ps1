param(
  [ValidateSet('start','stop','restart','status','sideload')]
  [string]$Action = 'status',
  [switch]$ForceInstall = $false
)

$ErrorActionPreference = 'SilentlyContinue'

function Ensure-NpmInstall([string]$Dir) {
  try {
    if (-not (Test-Path -LiteralPath $Dir)) { return }
    $mods = Join-Path $Dir 'node_modules'
    if (-not (Test-Path -LiteralPath $mods)) {
      Write-Host "Installing dependencies in $Dir" -ForegroundColor Yellow
      Push-Location $Dir
      npm ci --no-audit --no-fund | Out-Host
      Pop-Location
    }
  } catch {}
}

function Get-PortPid([int]$Port) {
  (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)
}

function Stop-Port([int]$Port) {
  $p = Get-PortPid -Port $Port
  if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; Write-Host "Stopped port $Port (PID $p)" }
  else { Write-Host "No listener on port $Port" }
}

function Wait-Port([int]$Port, [int]$TimeoutSeconds = 20) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $pid = Get-PortPid -Port $Port
    if ($pid) { return $true }
    Start-Sleep -Milliseconds 250
  }
  return $false
}

function Start-Backend() {
  $root = Split-Path -Parent $PSCommandPath | Split-Path -Parent | Split-Path -Parent
  $pfx = "$root\server\config\dev-cert.pfx"
  Ensure-NpmInstall "$root\server"
  Write-Host "Starting backend server on https://localhost:4001..." -ForegroundColor Cyan
  $proc = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-Command","Set-Location -LiteralPath '$root\server'; Write-Host 'WordFTW Backend Server' -ForegroundColor Green; Write-Host 'Starting on https://localhost:4001...' -ForegroundColor Yellow; Write-Host ''; `$env:SUPERDOC_BASE_URL='http://localhost:4002'; if (Test-Path '$pfx') { `$env:SSL_PFX_PATH='$pfx'; `$env:SSL_PFX_PASS='password' }; node src/server.js; if (`$LASTEXITCODE -ne 0) { Write-Host ''; Write-Host 'SERVER FAILED' -ForegroundColor Red; Write-Host 'Press any key to close...'; `$null = `$host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') }" -PassThru
  return $proc
}

function Start-Dev() {
  $root = Split-Path -Parent $PSCommandPath | Split-Path -Parent | Split-Path -Parent
  Ensure-NpmInstall "$root\addin"
  # Preflight: ensure webpack exists for the add-in dev server; optionally force install
  try {
    $binDir = Join-Path "$root\addin\node_modules" ".bin"
    $hasWebpack = (Test-Path -LiteralPath (Join-Path $binDir 'webpack.cmd')) -or (Test-Path -LiteralPath (Join-Path $binDir 'webpack.ps1')) -or (Test-Path -LiteralPath (Join-Path $binDir 'webpack'))
    if ($ForceInstall -or -not $hasWebpack) {
      Write-Host "Installing dependencies in $root\addin" -ForegroundColor Yellow
      Push-Location "$root\addin"
      npm ci --no-audit --no-fund | Out-Host
      Pop-Location
    }
  } catch {}
  Write-Host "Starting add-in dev server on https://localhost:4000..." -ForegroundColor Cyan
  $proc = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-Command","Set-Location -LiteralPath '$root\addin'; Write-Host 'WordFTW Add-in Dev Server' -ForegroundColor Green; Write-Host 'Starting on https://localhost:4000...' -ForegroundColor Yellow; Write-Host ''; npm run dev-server; if (`$LASTEXITCODE -ne 0) { Write-Host ''; Write-Host 'DEV SERVER FAILED' -ForegroundColor Red; Write-Host 'Press any key to close...'; `$null = `$host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown') }" -PassThru
  return $proc
}

function Start-Collab() {
  $root = Split-Path -Parent $PSCommandPath | Split-Path -Parent | Split-Path -Parent
  Ensure-NpmInstall "$root\collab"
  Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-Command","cd '$root'; node collab/server.js" -WindowStyle Minimized -PassThru
}

function Start-AddinSideload() {
  $root = Split-Path -Parent $PSCommandPath | Split-Path -Parent | Split-Path -Parent
  # Launch Office sideload (opens Word and loads the add-in)
  $word = Get-Process -Name WINWORD -ErrorAction SilentlyContinue
  if (-not $word) {
    # Fallback in case WINWORD is running in another session
    $tasklistOut = & cmd /c "tasklist /FI \"IMAGENAME eq WINWORD.EXE\" | findstr /I WINWORD.EXE" 2>$null
  }
  if (-not $word -and -not $tasklistOut) {
    Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-Command","cd '$root\addin'; npm start" -WindowStyle Normal -PassThru
  } else {
    $pids = if ($word) { $word.Id -join ', ' } else { 'unknown' }
    Write-Host "Detected Word already running (PID(s): $pids). Skipping launch; refresh the add-in in the existing document."
  }
}

function Show-Status() {
  $conns = Get-NetTCPConnection -LocalPort 4000,4001,4002,11434 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess,State
  if ($conns) { $conns | Format-Table -AutoSize | Out-Host } else { Write-Host "No listeners on 4000/4001/4002/11434" }
}

switch ($Action) {
  'status'   { Show-Status }
  'stop'     {
    Stop-Port 4000; Stop-Port 4001; Stop-Port 4002; Stop-Port 11434;
    try {
      $root = Split-Path -Parent $PSCommandPath | Split-Path -Parent | Split-Path -Parent
      Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-ExecutionPolicy","Bypass","-Command","cd '$root\addin'; npm run stop" -WindowStyle Minimized | Out-Null
    } catch {}
    Show-Status
  }
  'start'    {
    Write-Host "Stopping existing servers..." -ForegroundColor Cyan
    Stop-Port 4000; Stop-Port 4001; Stop-Port 4002; Stop-Port 11434;
    Write-Host ""
    
    $c=Start-Collab
    if (-not (Wait-Port -Port 4002 -TimeoutSeconds 60)) { 
      Write-Host "ERROR: Port 4002 (SuperDoc) failed to start" -ForegroundColor Red
      Write-Host "Check if SuperDoc dependencies are installed" -ForegroundColor Yellow
      exit 1
    }
    
    $b=Start-Backend
    if (-not (Wait-Port -Port 4001 -TimeoutSeconds 60)) { 
      Write-Host "ERROR: Port 4001 (Backend) failed to start" -ForegroundColor Red
      Write-Host "Check the 'WordFTW Backend Server' window for errors" -ForegroundColor Yellow
      Write-Host "Common issues:" -ForegroundColor Yellow
      Write-Host "  - Missing node_modules (run: cd server && npm install)" -ForegroundColor Yellow
      Write-Host "  - Port already in use" -ForegroundColor Yellow
      Write-Host "  - Environment variable issues" -ForegroundColor Yellow
      exit 1
    }
    Write-Host "✓ Backend server started on https://localhost:4001" -ForegroundColor Green
    
    $d=Start-Dev
    if (-not (Wait-Port -Port 4000 -TimeoutSeconds 60)) { 
      Write-Host "ERROR: Port 4000 (Add-in Dev Server) failed to start" -ForegroundColor Red
      Write-Host "Check the 'WordFTW Add-in Dev Server' window for errors" -ForegroundColor Yellow
      Write-Host "Common issues:" -ForegroundColor Yellow
      Write-Host "  - Missing node_modules (run: cd addin && npm install)" -ForegroundColor Yellow
      Write-Host "  - Webpack configuration issues" -ForegroundColor Yellow
      exit 1
    }
    Write-Host "✓ Add-in dev server started on https://localhost:4000" -ForegroundColor Green
    
    $a=Start-AddinSideload; Start-Sleep -Seconds 1;
    Write-Host ""
    Write-Host "Server PIDs:" -ForegroundColor Cyan
    Write-Host "  Collab: $($c.Id)  Backend: $($b.Id)  Dev: $($d.Id)  Addin: $($a.Id)"
    Write-Host ""
    Show-Status
    Write-Host ""
    Write-Host "✅ All servers started successfully!" -ForegroundColor Green
  }
  'restart'  {
    Stop-Port 4000; Stop-Port 4001; Stop-Port 4002; Stop-Port 11434;
    $c=Start-Collab; if (-not (Wait-Port -Port 4002 -TimeoutSeconds 60)) { Write-Host "WARN: 4002 not listening" -ForegroundColor Yellow }
    $b=Start-Backend; if (-not (Wait-Port -Port 4001 -TimeoutSeconds 60)) { Write-Host "WARN: 4001 not listening" -ForegroundColor Yellow }
    $d=Start-Dev; if (-not (Wait-Port -Port 4000 -TimeoutSeconds 60)) { Write-Host "WARN: 4000 not listening" -ForegroundColor Yellow }
    $a=Start-AddinSideload; Start-Sleep -Seconds 1;
    Write-Host "Collab PID: $($c.Id)  Backend PID: $($b.Id)  Dev PID: $($d.Id)  Addin PID: $($a.Id)";
    Show-Status
  }
  'sideload' { Start-AddinSideload }
}


