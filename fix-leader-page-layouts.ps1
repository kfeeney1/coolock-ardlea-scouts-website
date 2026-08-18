$ErrorActionPreference = "Stop"

$ProjectRoot = Get-Location

if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
    Write-Host "ERROR: Run this script from the coolock-ardlea-scouts project root." -ForegroundColor Red
    exit 1
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $ProjectRoot ("leader-layout-fix-backup-" + $timestamp)

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$Targets = @(
    "src\pages\MemberManagement.tsx",
    "src\pages\LeaderInfo.tsx",
    "src\pages\LeaderProfile.tsx"
)

foreach ($relative in $Targets) {
    $source = Join-Path $ProjectRoot $relative

    if (-not (Test-Path $source)) {
        Write-Host "ERROR: Missing $relative" -ForegroundColor Red
        exit 1
    }

    $destination = Join-Path $backupDir $relative
    New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
    Copy-Item $source $destination -Force
}

# ------------------------------------------------------------
# Member Management:
# Remove any redundant empty/legacy Paper between the shared
# LeaderDashboardHeader and the actual Member Management header.
# ------------------------------------------------------------

$memberPath = Join-Path $ProjectRoot "src\pages\MemberManagement.tsx"
$member = Get-Content $memberPath -Raw

# Remove empty Paper blocks that may remain directly after the shared header.
$member = [regex]::Replace(
    $member,
    '(?s)(<LeaderDashboardHeader\s*/>)\s*<Paper\b[^>]*>\s*</Paper>\s*',
    '$1' + "`r`n",
    1
)

# Remove a legacy header Paper if it contains no title and sits before
# the actual Member Management title block.
$member = [regex]::Replace(
    $member,
    '(?s)(<LeaderDashboardHeader\s*/>)\s*<Paper\b[^>]*>.*?</Paper>\s*(?=<Paper\b[^>]*>.*?Member Management)',
    '$1' + "`r`n",
    1
)

Set-Content -Path $memberPath -Value $member -Encoding UTF8
Write-Host "Cleaned Member Management spacing/bar." -ForegroundColor Green

# ------------------------------------------------------------
# Leader Info:
# Normalise the first page section beneath LeaderDashboardHeader.
# ------------------------------------------------------------

$infoPath = Join-Path $ProjectRoot "src\pages\LeaderInfo.tsx"
$info = Get-Content $infoPath -Raw

$info = [regex]::Replace(
    $info,
    '(?s)(<LeaderDashboardHeader\s*/>)\s*<Paper\b.*?</Paper>',
    @'
$1

                <Paper
                    elevation={2}
                    sx={{
                        p: {
                            xs: 2.5,
                            md: 3
                        },
                        mb: 3,
                        borderRadius: 2,
                        borderLeft: "5px solid",
                        borderLeftColor: "secondary.main"
                    }}
                >
                    <Typography
                        variant="h4"
                        color="secondary"
                        sx={{
                            fontWeight: 800
                        }}
                    >
                        Leader Portal Information
                    </Typography>

                    <Typography
                        color="text.secondary"
                        sx={{
                            mt: 0.75
                        }}
                    >
                        Development roadmap, current stage information and frequently asked questions.
                    </Typography>
                </Paper>
'@,
    1
)

Set-Content -Path $infoPath -Value $info -Encoding UTF8
Write-Host "Standardised Info & FAQ header sizing." -ForegroundColor Green

# ------------------------------------------------------------
# Leader Profile:
# Normalise the first page section beneath LeaderDashboardHeader.
# ------------------------------------------------------------

$profilePath = Join-Path $ProjectRoot "src\pages\LeaderProfile.tsx"
$profile = Get-Content $profilePath -Raw

$profile = [regex]::Replace(
    $profile,
    '(?s)(<LeaderDashboardHeader\s*/>)\s*<Paper\b.*?</Paper>',
    @'
$1

                <Paper
                    elevation={2}
                    sx={{
                        p: {
                            xs: 2.5,
                            md: 3
                        },
                        mb: 3,
                        borderRadius: 2,
                        borderLeft: "5px solid",
                        borderLeftColor: "secondary.main"
                    }}
                >
                    <Typography
                        variant="h4"
                        color="secondary"
                        sx={{
                            fontWeight: 800
                        }}
                    >
                        My Profile
                    </Typography>

                    <Typography
                        color="text.secondary"
                        sx={{
                            mt: 0.75
                        }}
                    >
                        Update your leader details and account settings.
                    </Typography>
                </Paper>
'@,
    1
)

Set-Content -Path $profilePath -Value $profile -Encoding UTF8
Write-Host "Standardised My Profile header sizing." -ForegroundColor Green

Write-Host ""
Write-Host "Leader layout fixes complete." -ForegroundColor Green
Write-Host "Backup: $backupDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build" -ForegroundColor Yellow
