$ErrorActionPreference = "Stop"

$ProjectRoot = Get-Location
$PagesDir = Join-Path $ProjectRoot "src\pages"
$Target = Join-Path $PagesDir "AdminDashboard.tsx"

if (-not (Test-Path $Target)) {
    Write-Host "ERROR: Could not find src\pages\AdminDashboard.tsx" -ForegroundColor Red
    exit 1
}

$backups = Get-ChildItem -Path $PagesDir -Filter "AdminDashboard.tsx.button-layout-backup-*" -File |
    Sort-Object LastWriteTime -Descending

if ($backups.Count -eq 0) {
    Write-Host "ERROR: No AdminDashboard button-layout backup was found." -ForegroundColor Red
    Write-Host "Expected a file named similar to:" -ForegroundColor Yellow
    Write-Host "AdminDashboard.tsx.button-layout-backup-YYYYMMDD-HHMMSS"
    exit 1
}

$backup = $backups[0]

Write-Host "Restoring:" -ForegroundColor Cyan
Write-Host $backup.FullName

Copy-Item $backup.FullName $Target -Force

Write-Host ""
Write-Host "AdminDashboard.tsx restored successfully." -ForegroundColor Green

# Apply a deliberately small/safe layout improvement:
# only replace the known Stack opening block. No Button JSX is rewritten.
$text = Get-Content $Target -Raw

$old = @'
                        <Stack
                            direction={{
                                xs: "column",
                                sm: "row"
                            }}
                            spacing={1.5}
                        >
'@

$new = @'
                        <Stack
                            direction="row"
                            spacing={1.5}
                            useFlexGap
                            sx={{
                                flexWrap: "wrap",
                                justifyContent: {
                                    xs: "stretch",
                                    md: "flex-end"
                                },
                                width: {
                                    xs: "100%",
                                    md: "auto"
                                },
                                "& > .MuiButton-root": {
                                    minHeight: 42,
                                    flex: {
                                        xs: "1 1 100%",
                                        sm: "1 1 180px",
                                        lg: "0 1 auto"
                                    },
                                    whiteSpace: "nowrap"
                                }
                            }}
                        >
'@

if ($text.Contains($old)) {
    $text = $text.Replace($old, $new)
    Set-Content -Path $Target -Value $text -Encoding UTF8
    Write-Host "Applied safe responsive button alignment." -ForegroundColor Green
} else {
    Write-Host "The dashboard was restored, but the expected action Stack was not found." -ForegroundColor Yellow
    Write-Host "No layout changes were made after restoration." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build" -ForegroundColor Yellow
