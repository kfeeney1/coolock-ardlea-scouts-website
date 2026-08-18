$ErrorActionPreference = "Stop"

$ProjectRoot = Get-Location
$Target = Join-Path $ProjectRoot "src\pages\JoinManagement.tsx"

if (-not (Test-Path $Target)) {
    Write-Host "ERROR: Could not find src\pages\JoinManagement.tsx" -ForegroundColor Red
    exit 1
}

$Backup = "$Target.tabs-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $Target $Backup -Force

$text = Get-Content $Target -Raw

# Remove Tabs/Tab imports.
$text = $text -replace '(\r?\n\s*)Tab,', ''
$text = $text -replace '(\r?\n\s*)Tabs,', ''

# Remove the All Enquiries / Waiting List tab container.
$pattern = '(?s)\s*<Paper\s+elevation=\{2\}\s+sx=\{\{\s*mb:\s*3\s*\}\}\s*>\s*<Tabs.*?</Tabs>\s*</Paper>\s*'

$matches = [regex]::Matches($text, $pattern)

if ($matches.Count -eq 0) {
    Write-Host "ERROR: Could not find the All Enquiries / Waiting List tab block." -ForegroundColor Red
    Write-Host "Backup created at: $Backup" -ForegroundColor Yellow
    exit 1
}

$text = [regex]::Replace(
    $text,
    $pattern,
    "`r`n",
    1
)

Set-Content -Path $Target -Value $text -Encoding UTF8

Write-Host ""
Write-Host "Removed All Enquiries / Waiting List tabs." -ForegroundColor Green
Write-Host "Backup: $Backup" -ForegroundColor Cyan
Write-Host ""
Write-Host "The five status summary cards remain the navigation/filter controls." -ForegroundColor Cyan
Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build" -ForegroundColor Yellow
