$ErrorActionPreference = "Stop"

$ProjectRoot = Get-Location
$Target = Join-Path $ProjectRoot "src\pages\JoinManagement.tsx"

if (-not (Test-Path $Target)) {
    Write-Host "ERROR: Could not find src\pages\JoinManagement.tsx" -ForegroundColor Red
    exit 1
}

$Backup = "$Target.phone-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $Target $Backup -Force

$text = Get-Content $Target -Raw

if ($text -notmatch "PHONE_DISPLAY_FIX_2026_08_18") {
    $text = "// PHONE_DISPLAY_FIX_2026_08_18`r`n" + $text
}

$pattern = '(?s)(<Typography\s+sx=\{\{\s+mt:\s*1\s+\}\}\s*>\s*Parent\s*/\s*Guardian:\{" "\}\s*\{\s*record\.parentName\s*\|\|\s*"Not provided"\s*\}\s*</Typography>)'

$replacement = @'
$1

                                                    <Typography
                                                        sx={{
                                                            mt: 0.5
                                                        }}
                                                    >
                                                        Phone:{" "}
                                                        {
                                                            record.mobileNumber ||
                                                            "Not provided"
                                                        }
                                                    </Typography>
'@

$matches = [regex]::Matches($text, $pattern)

if ($matches.Count -eq 0) {
    Write-Host "ERROR: Could not find the Parent / Guardian card blocks to patch." -ForegroundColor Red
    Write-Host "Backup created at: $Backup" -ForegroundColor Yellow
    exit 1
}

# Avoid duplicating the phone block if it is already there.
if ($text -notmatch 'Phone:\{" "\}') {
    $text = [regex]::Replace($text, $pattern, $replacement)
}

Set-Content -Path $Target -Value $text -Encoding UTF8

Write-Host ""
Write-Host "Phone display patch complete." -ForegroundColor Green
Write-Host "Backup: $Backup" -ForegroundColor Cyan
Write-Host ""
Write-Host "Verification:" -ForegroundColor Cyan
Select-String -Path $Target -Pattern "PHONE_DISPLAY_FIX_2026_08_18","Phone:" |
    ForEach-Object {
        Write-Host ("{0}:{1}" -f $_.LineNumber, $_.Line.Trim())
    }
