$ErrorActionPreference = "Stop"

$ProjectRoot = Get-Location
$Target = Join-Path $ProjectRoot "src\pages\AdminDashboard.tsx"

if (-not (Test-Path $Target)) {
    Write-Host "ERROR: Could not find src\pages\AdminDashboard.tsx" -ForegroundColor Red
    exit 1
}

$Backup = "$Target.button-layout-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $Target $Backup -Force

$text = Get-Content $Target -Raw

# Find the top dashboard action Stack. We identify it by the presence of the known buttons.
$pattern = '(?s)<Stack\s+direction=\{\{\s*xs:\s*"column",\s*sm:\s*"row"\s*\}\}\s+spacing=\{1\.5\}\s*>\s*(?<buttons>.*?to="/leader/members".*?Sign Out.*?</Button>)\s*</Stack>'

$match = [regex]::Match($text, $pattern)

if (-not $match.Success) {
    Write-Host "ERROR: Could not find the dashboard action button Stack." -ForegroundColor Red
    Write-Host "Backup created at: $Backup" -ForegroundColor Yellow
    exit 1
}

$buttons = $match.Groups["buttons"].Value

# Add consistent button sizing to every Button in the action block if it doesn't already have sx.
$buttonPattern = '(?s)<Button(?<attrs>.*?)(?=>)>'

$buttons = [regex]::Replace(
    $buttons,
    $buttonPattern,
    {
        param($m)

        $attrs = $m.Groups["attrs"].Value

        if ($attrs -match '\bsx=') {
            return $m.Value
        }

        return '<Button' + $attrs + @'
                            sx={{
                                width: "100%",
                                minHeight: 42,
                                whiteSpace: "nowrap"
                            }}
'@
    }
)

$replacement = @'
<Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: {
                                    xs: "1fr",
                                    sm: "repeat(2, minmax(0, 1fr))",
                                    lg: "repeat(4, minmax(0, 1fr))"
                                },
                                gap: 1.5,
                                width: {
                                    xs: "100%",
                                    md: "auto"
                                },
                                minWidth: {
                                    lg: 620
                                },
                                alignItems: "stretch"
                            }}
                        >
'@ + $buttons + @'
                        </Box>
'@

$text = $text.Remove(
    $match.Index,
    $match.Length
).Insert(
    $match.Index,
    $replacement
)

Set-Content -Path $Target -Value $text -Encoding UTF8

Write-Host ""
Write-Host "Leader Dashboard button layout updated." -ForegroundColor Green
Write-Host "Backup: $Backup" -ForegroundColor Cyan
Write-Host ""
Write-Host "The action buttons now use a responsive grid:" -ForegroundColor Cyan
Write-Host "  1 column on small screens"
Write-Host "  2 columns on medium screens"
Write-Host "  4 columns on large screens"
Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build" -ForegroundColor Yellow
