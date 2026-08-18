$ErrorActionPreference = "Stop"

$ProjectRoot = Get-Location

if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
    Write-Host "ERROR: Run this script from the coolock-ardlea-scouts project root." -ForegroundColor Red
    exit 1
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

function Update-File {
    param(
        [string]$RelativePath,
        [scriptblock]$Transform
    )

    $path = Join-Path $ProjectRoot $RelativePath

    if (-not (Test-Path $path)) {
        Write-Host "ERROR: Could not find $RelativePath" -ForegroundColor Red
        exit 1
    }

    $backup = "$path.import-cleanup-backup-$timestamp"
    Copy-Item $path $backup -Force

    $text = Get-Content $path -Raw
    $updated = & $Transform $text

    if ($updated -eq $text) {
        Write-Host "No change required: $RelativePath" -ForegroundColor Yellow
    }
    else {
        Set-Content -Path $path -Value $updated -Encoding UTF8
        Write-Host "Updated: $RelativePath" -ForegroundColor Green
    }
}

# Remove standalone multiline:
# import {
#     Link
# } from "react-router-dom";
$removeLinkImport = {
    param($text)

    return [regex]::Replace(
        $text,
        '(?ms)^\s*import\s*\{\s*Link\s*\}\s*from\s*["'']react-router-dom["''];\s*\r?\n',
        ''
    )
}

Update-File "src\pages\ConsentManagement.tsx" $removeLinkImport
Update-File "src\pages\JoinManagement.tsx" $removeLinkImport
Update-File "src\pages\LeaderProfile.tsx" $removeLinkImport
Update-File "src\pages\MemberManagement.tsx" $removeLinkImport

# LeaderInfo has both an unused MUI Button import and unused Link import.
Update-File "src\pages\LeaderInfo.tsx" {
    param($text)

    $text = [regex]::Replace(
        $text,
        '(?ms)^\s*import\s*\{\s*Link\s*\}\s*from\s*["'']react-router-dom["''];\s*\r?\n',
        ''
    )

    # Button appears in the @mui/material named import list.
    # Remove only the Button entry, leaving the other MUI imports intact.
    $text = [regex]::Replace(
        $text,
        '(?m)^(\s*)Button,\s*\r?\n',
        ''
    )

    return $text
}

Write-Host ""
Write-Host "Unused leader-page imports removed." -ForegroundColor Green
Write-Host "Timestamped backups were created beside each changed file." -ForegroundColor Cyan
Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build" -ForegroundColor Yellow
