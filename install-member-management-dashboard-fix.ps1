$ErrorActionPreference = "Stop"

$ProjectRoot = Get-Location
$Target = Join-Path $ProjectRoot "src\pages\MemberManagement.tsx"
$Source = Join-Path $ProjectRoot "MemberManagement-with-dashboard.tsx"

if (-not (Test-Path $Target)) {
    Write-Host "ERROR: src\pages\MemberManagement.tsx not found." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $Source)) {
    Write-Host "ERROR: Put MemberManagement-with-dashboard.tsx beside this script." -ForegroundColor Red
    exit 1
}

$Backup = "$Target.dashboard-restore-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Copy-Item $Target $Backup -Force
Copy-Item $Source $Target -Force

Write-Host ""
Write-Host "Member Management dashboard header restored." -ForegroundColor Green
Write-Host "The empty legacy bar was removed." -ForegroundColor Green
Write-Host "Backup: $Backup" -ForegroundColor Cyan
Write-Host ""
Write-Host "Verification:" -ForegroundColor Cyan

Select-String `
    -Path $Target `
    -Pattern "LeaderDashboardHeader","MEMBER_MANAGEMENT_TOP_NAV" |
    ForEach-Object {
        Write-Host ("{0}:{1}" -f $_.LineNumber, $_.Line.Trim())
    }

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build" -ForegroundColor Yellow
