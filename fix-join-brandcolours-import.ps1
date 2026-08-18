$ErrorActionPreference = "Stop"

$ProjectRoot = Get-Location
$Target = Join-Path $ProjectRoot "src\pages\JoinManagement.tsx"

if (-not (Test-Path $Target)) {
    Write-Host "ERROR: Could not find src\pages\JoinManagement.tsx" -ForegroundColor Red
    exit 1
}

$Backup = "$Target.brandColours-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $Target $Backup -Force

$text = Get-Content $Target -Raw

$pattern = '(?ms)^\s*import\s*\{\s*brandColours\s*\}\s*from\s*["'']\.\./theme/theme["''];\s*\r?\n'

if ($text -notmatch $pattern) {
    Write-Host "No brandColours import found. No changes made." -ForegroundColor Yellow
    exit 0
}

$text = [regex]::Replace(
    $text,
    $pattern,
    ''
)

Set-Content -Path $Target -Value $text -Encoding UTF8

Write-Host ""
Write-Host "Removed unused brandColours import from JoinManagement.tsx." -ForegroundColor Green
Write-Host "Backup: $Backup" -ForegroundColor Cyan
Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build" -ForegroundColor Yellow
