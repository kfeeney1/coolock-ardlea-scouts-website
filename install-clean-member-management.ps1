$ErrorActionPreference = "Stop"

$ProjectRoot = Get-Location
$Target = Join-Path $ProjectRoot "src\pages\MemberManagement.tsx"
$Source = Join-Path $ProjectRoot "MemberManagement.tsx"

if (-not (Test-Path $Target)) {
    Write-Host "ERROR: src\pages\MemberManagement.tsx not found." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $Source)) {
    Write-Host "ERROR: Put the downloaded MemberManagement.tsx beside this script." -ForegroundColor Red
    exit 1
}

$Backup = "$Target.empty-bar-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $Target $Backup -Force
Copy-Item $Source $Target -Force

Write-Host "MemberManagement.tsx replaced with cleaned version." -ForegroundColor Green
Write-Host "Backup: $Backup" -ForegroundColor Cyan
Write-Host "Now run: npm run build" -ForegroundColor Yellow
