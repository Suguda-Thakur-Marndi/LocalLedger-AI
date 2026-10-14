<#
.SYNOPSIS
    Starts the LocalLedger AI backend service safely with virtual environment verification and port checks.

.DESCRIPTION
    This script verifies the backend virtual environment (.venv), checks whether the target port is available,
    identifies any conflicting process if occupied, and launches Uvicorn using the virtual environment's Python.

.PARAMETER HostAddress
    The IP address to bind to. Default is 127.0.0.1 (local loopback).

.PARAMETER Port
    The port to bind to. Default is 8000.

.PARAMETER Reload
    Enable auto-reload on code changes (optional). Note: On Windows, use caution when terminating
    reloaded processes to prevent orphaned child worker processes.

.EXAMPLE
    .\scripts\start_backend.ps1
    Starts the backend on 127.0.0.1:8000 with reload disabled.

.EXAMPLE
    .\scripts\start_backend.ps1 -Port 8001
    Starts the backend on port 8001 if port 8000 is occupied.

.EXAMPLE
    .\scripts\start_backend.ps1 -Reload
    Starts the backend with auto-reload enabled.
#>

[CmdletBinding()]
param (
    [string]$HostAddress = "127.0.0.1",
    [int]$Port = 8000,
    [switch]$Reload
)

$ErrorActionPreference = "Stop"

# Determine directories
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir
$rootDir = Split-Path -Parent $backendDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " LocalLedger AI Backend Startup" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verify virtual environment
$venvPython = Join-Path $backendDir ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Error @"
Backend virtual environment was not found at:
  $venvPython

Please initialize the backend virtual environment first:
  cd "$backendDir"
  python -m venv .venv
  .\.venv\Scripts\python.exe -m pip install -r requirements.txt
"@
    exit 1
}

Write-Host "[OK] Using virtual environment Python:" -ForegroundColor Green
Write-Host "     $venvPython"

# 2. Check port availability
$connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }

if ($connections) {
    Write-Host ""
    Write-Host "[ERROR] Port $Port is already occupied!" -ForegroundColor Red
    
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
        if ($proc) {
            Write-Host "  Occupying Process: $($proc.ProcessName) (PID: $procId)" -ForegroundColor Yellow
            Write-Host "  Executable:        $($proc.Path)" -ForegroundColor Yellow
        } else {
            Write-Host "  Occupying PID:     $procId (Process handle not found directly; could be an orphaned child process)" -ForegroundColor Yellow
            
            # Inspect for orphaned child processes
            $children = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ParentProcessId -eq $procId }
            if ($children) {
                foreach ($c in $children) {
                    Write-Host "    Detected child process: $($c.Name) (PID: $($c.ProcessId))" -ForegroundColor Yellow
                    Write-Host "    Command line:          $($c.CommandLine)" -ForegroundColor Yellow
                }
            }
        }
    }

    Write-Host ""
    Write-Host "Safe resolution options:" -ForegroundColor Cyan
    Write-Host "  1. If you know the occupying process is a stale backend, terminate it manually:"
    Write-Host "     Stop-Process -Id <PID>"
    Write-Host "  2. Or start LocalLedger on an alternative port (e.g. 8001):"
    Write-Host "     .\scripts\start_backend.ps1 -Port 8001"
    Write-Host ""
    Write-Host "Startup aborted to prevent port collisions. No processes were modified." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Port $Port is available on $HostAddress." -ForegroundColor Green

# 3. Build Uvicorn command
$uvicornArgs = @(
    "-m", "uvicorn",
    "app.main:app",
    "--app-dir", $backendDir,
    "--host", $HostAddress,
    "--port", $Port
)

if ($Reload) {
    $uvicornArgs += "--reload"
    Write-Host "[INFO] Auto-reload enabled." -ForegroundColor Yellow
}

Write-Host "[INFO] Starting Uvicorn server on http://$HostAddress`:$Port ..." -ForegroundColor Cyan
Write-Host "       Press Ctrl+C to stop the server." -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

# Set working directory to backend directory for proper module resolution
Push-Location $backendDir
try {
    & $venvPython @uvicornArgs
} finally {
    Pop-Location
}
