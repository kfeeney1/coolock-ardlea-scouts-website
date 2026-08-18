$ErrorActionPreference = "Stop"

$ProjectRoot = Get-Location
$Target = Join-Path $ProjectRoot "src\pages\JoinManagement.tsx"
$Source = Join-Path $ProjectRoot "JoinManagement-fixed-v3.tsx"

if (-not (Test-Path $Target)) {
    Write-Host "ERROR: src\pages\JoinManagement.tsx not found." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $Source)) {
    Write-Host "ERROR: Put JoinManagement-fixed-v3.tsx beside this script." -ForegroundColor Red
    exit 1
}

$Backup = "$Target.waiting-filter-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Copy-Item $Target $Backup -Force
Copy-Item $Source $Target -Force

Write-Host ""
Write-Host "Join Management fixed from the last known-good source." -ForegroundColor Green
Write-Host "Backup: $Backup" -ForegroundColor Cyan
Write-Host ""
Write-Host "Changes:" -ForegroundColor Cyan
Write-Host "  - Removed the extra Waiting List heading/description"
Write-Host "  - Waiting List button remains highlighted"
Write-Host "  - Selecting Waiting List in the Status dropdown opens/highlights it"
Write-Host "  - Other status dropdown choices return to the normal enquiry view"
Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build" -ForegroundColor Yellow
