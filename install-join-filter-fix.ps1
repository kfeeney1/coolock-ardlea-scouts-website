$ErrorActionPreference="Stop"
$Target=Join-Path (Get-Location) "src\pages\JoinManagement.tsx"
$Source=Join-Path (Get-Location) "JoinManagement-fixed.tsx"
if(!(Test-Path $Target)){throw "Run from project root."}
if(!(Test-Path $Source)){throw "Put JoinManagement-fixed.tsx beside this script."}
$Backup="$Target.filter-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $Target $Backup -Force
Copy-Item $Source $Target -Force
Write-Host "Fixed Waiting List filter behaviour." -ForegroundColor Green
Write-Host "Backup: $Backup" -ForegroundColor Cyan
Write-Host "Run: npm run build" -ForegroundColor Yellow
