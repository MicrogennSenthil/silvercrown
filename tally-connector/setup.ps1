# ============================================================
#  Tally Connector — Windows Setup Script (PowerShell)
#  Run once on the office PC to set up the connector.
#
#  Usage (from elevated PowerShell in this directory):
#    Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
#    .\setup.ps1
# ============================================================

param(
    [string]$NodeMinVersion = "20"
)

Write-Host ""
Write-Host "=== Tally Connector Windows Setup ===" -ForegroundColor Cyan
Write-Host ""

# ─── 1. Check Node.js ─────────────────────────────────────────────────────────
Write-Host "Checking Node.js..." -ForegroundColor Yellow

$nodeVersion = $null
try {
    $nodeVersion = (node --version 2>$null).TrimStart("v")
} catch {}

if (-not $nodeVersion) {
    Write-Host "  ERROR: Node.js is not installed." -ForegroundColor Red
    Write-Host "  Download Node.js 20+ LTS from: https://nodejs.org/en/download" -ForegroundColor Yellow
    exit 1
}

$nodeMajor = [int]($nodeVersion.Split(".")[0])
if ($nodeMajor -lt [int]$NodeMinVersion) {
    Write-Host "  ERROR: Node.js v$nodeVersion found, but v$NodeMinVersion+ is required." -ForegroundColor Red
    Write-Host "  Please upgrade: https://nodejs.org/en/download" -ForegroundColor Yellow
    exit 1
}

Write-Host "  OK: Node.js v$nodeVersion" -ForegroundColor Green

# ─── 2. Install npm dependencies ──────────────────────────────────────────────
Write-Host ""
Write-Host "Installing npm dependencies..." -ForegroundColor Yellow

Push-Location $PSScriptRoot
try {
    npm install --omit=dev
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    Write-Host "  OK: Dependencies installed." -ForegroundColor Green
} catch {
    Write-Host "  ERROR: $_" -ForegroundColor Red
    Pop-Location
    exit 1
} finally {
    Pop-Location
}

# ─── 3. Create .env from example if missing ───────────────────────────────────
Write-Host ""
$envFile     = Join-Path $PSScriptRoot ".env"
$envExample  = Join-Path $PSScriptRoot ".env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "  Created .env from .env.example." -ForegroundColor Green
        Write-Host "  IMPORTANT: Open .env and fill in ERP_BASE_URL and ERP_CONNECTOR_TOKEN." -ForegroundColor Yellow
    } else {
        Write-Host "  WARNING: .env.example not found. Create .env manually." -ForegroundColor Yellow
    }
} else {
    Write-Host "  .env already exists — skipping copy." -ForegroundColor Cyan
}

# ─── 4. Remind about Tally HTTP Server ────────────────────────────────────────
Write-Host ""
Write-Host "── Tally Prime Configuration Reminder ──" -ForegroundColor Cyan
Write-Host "  1. Open Tally Prime on this PC."
Write-Host "  2. Go to:  F1 (Help) > Settings > Connectivity"
Write-Host "     OR:     Gateway of Tally > F12: Configure > Advanced Configuration"
Write-Host "  3. Enable 'TallyPrime Server' or 'ODBC Server'."
Write-Host "  4. Set port to 9000 (or update TALLY_PORT in .env)."
Write-Host "  5. Ensure the company you want to sync is open."
Write-Host ""

# ─── 5. Run setup check ───────────────────────────────────────────────────────
Write-Host "Running pre-flight check..." -ForegroundColor Yellow
Push-Location $PSScriptRoot
node scripts/setup-check.js
$checkExit = $LASTEXITCODE
Pop-Location

if ($checkExit -ne 0) {
    Write-Host ""
    Write-Host "  Setup incomplete. Fix the issues above then re-run setup.ps1." -ForegroundColor Red
    exit 1
}

# ─── 6. Optional: Create Windows Task Scheduler job ───────────────────────────
Write-Host ""
$createTask = Read-Host "Create a Windows Task Scheduler job to auto-start the connector? (y/N)"

if ($createTask -eq "y" -or $createTask -eq "Y") {
    $taskName   = "TallyConnector"
    $scriptPath = Join-Path $PSScriptRoot "start.cmd"
    $action     = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$scriptPath`""
    $trigger    = New-ScheduledTaskTrigger -AtLogOn
    $settings   = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
    $principal  = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive

    try {
        Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
        Write-Host "  Scheduled task '$taskName' created — will start at logon." -ForegroundColor Green
    } catch {
        Write-Host "  WARNING: Could not create scheduled task: $_" -ForegroundColor Yellow
        Write-Host "  You can start the connector manually using start.cmd." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host "  To start the connector: npm start   (or double-click start.cmd)" -ForegroundColor Cyan
Write-Host ""
