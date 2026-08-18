$ErrorActionPreference = "Stop"
$ProjectRoot = Get-Location
$Target = Join-Path $ProjectRoot "src\pages\LeaderProfile.tsx"
$Source = Join-Path $ProjectRoot "LeaderProfile.tsx"

if (-not (Test-Path $Target)) {
    Write-Host "ERROR: src\pages\LeaderProfile.tsx not found." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $Source)) {
    Write-Host "ERROR: Put the downloaded LeaderProfile.tsx beside this script." -ForegroundColor Red
    exit 1
}

$Backup = "$Target.sizing-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $Target $Backup -Force
Copy-Item $Source $Target -Force

Write-Host "LeaderProfile.tsx replaced with standardised version." -ForegroundColor Green
Write-Host "Backup: $Backup" -ForegroundColor Cyan
Write-Host "Now run: npm run build" -ForegroundColor Yellow
