<#
.SYNOPSIS
    Runs all six LocalLedger AI end-to-end integration checks with an isolated test database.

.DESCRIPTION
    Executes the integration test runner using the backend virtual environment Python.
    Verifies API health & routes, Image OCR upload, PDF extraction, SQLite restart persistence,
    Tesseract OCR installation, and local Ollama inference.
    Safely isolates all test data in a temporary directory and never modifies the production database.

.PARAMETER KeepTemp
    Preserve temporary test database and uploads directory after completion (useful for debugging).

.PARAMETER Port
    Override the loopback port used for the isolated test server.

.PARAMETER VerboseOutput
    Enable verbose logging from Uvicorn test server instances.

.EXAMPLE
    .\scripts\run_integration_checks.ps1

.EXAMPLE
    .\backend\scripts\run_integration_checks.ps1 -VerboseOutput
#>

[CmdletBinding()]
param (
    [switch]$KeepTemp,
    [int]$Port = 0,
    [switch]$VerboseOutput
)

$ErrorActionPreference = "Stop"

# Determine directories relative to script location
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir
$rootDir = Split-Path -Parent $backendDir
$venvPython = Join-Path $backendDir ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Error "Backend virtual environment not found at: $venvPython"
    exit 1
}

$pyScript = Join-Path $scriptDir "run_integration_checks.py"
if (-not (Test-Path $pyScript)) {
    Write-Error "Integration checks script not found at: $pyScript"
    exit 1
}

$pyArgs = @($pyScript)
if ($KeepTemp) {
    $pyArgs += "--keep-temp"
}
if ($Port -gt 0) {
    $pyArgs += "--port"
    $pyArgs += "$Port"
}
if ($VerboseOutput) {
    $pyArgs += "--verbose"
}

Push-Location $backendDir
try {
    & $venvPython @pyArgs
    $exitCode = $LASTEXITCODE
} finally {
    Pop-Location
}

exit $exitCode
