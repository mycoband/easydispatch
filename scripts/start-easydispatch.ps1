# EasyDispatch desktop launcher
$ErrorActionPreference = 'Continue'
$root = 'C:\Users\Admin\Desktop\easydispatch\easydispatch'
$url = 'http://localhost:3000/login'

$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
  [System.Environment]::GetEnvironmentVariable('Path', 'User') +
  ';C:\Program Files\nodejs'

Set-Location $root
$host.UI.RawUI.WindowTitle = 'EasyDispatch — keep this window open'

Write-Host '========================================'
Write-Host '  EasyDispatch'
Write-Host '========================================'
Write-Host ''

if (-not (Test-Path (Join-Path $root 'package.json'))) {
  Write-Host "ERROR: Cannot find app at $root"
  Read-Host 'Press Enter to close'
  exit 1
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue) -and -not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host 'ERROR: npm not found. Install Node.js from https://nodejs.org'
  Read-Host 'Press Enter to close'
  exit 1
}

Write-Host 'Stopping any old server...'
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object {
  if ($_.OwningProcess -gt 0) {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}
Start-Sleep -Seconds 1

Write-Host 'Starting server (browser opens when ready)...'
Write-Host 'Keep this window open.'
Write-Host ''

# Open browser when /login is ready (background)
$waiter = Start-Job -ScriptBlock {
  param($u)
  for ($i = 0; $i -lt 120; $i++) {
    try {
      $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -eq 200) {
        Start-Process $u
        return
      }
    } catch { }
    Start-Sleep -Seconds 1
  }
  Start-Process $u
} -ArgumentList $url

# Run Next in this window (blocks)
& npm.cmd run dev
$exit = $LASTEXITCODE

Stop-Job $waiter -ErrorAction SilentlyContinue
Remove-Job $waiter -ErrorAction SilentlyContinue

Write-Host ''
Write-Host "Server stopped (exit $exit)."
Read-Host 'Press Enter to close'
