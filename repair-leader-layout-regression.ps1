$ErrorActionPreference = "Stop"

$ProjectRoot = Get-Location

if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
    Write-Host "ERROR: Run this script from the coolock-ardlea-scouts project root." -ForegroundColor Red
    exit 1
}

$backupDirs = Get-ChildItem -Path $ProjectRoot -Directory -Filter "leader-layout-fix-backup-*" |
    Sort-Object LastWriteTime -Descending

if ($backupDirs.Count -eq 0) {
    Write-Host "ERROR: No leader-layout-fix-backup-* folder was found." -ForegroundColor Red
    Write-Host "The previous layout script should have created one in the project root." -ForegroundColor Yellow
    exit 1
}

$backupDir = $backupDirs[0]

Write-Host "Using backup:" -ForegroundColor Cyan
Write-Host $backupDir.FullName
Write-Host ""

$restoreFiles = @(
    "src\pages\LeaderInfo.tsx",
    "src\pages\LeaderProfile.tsx",
    "src\pages\MemberManagement.tsx"
)

foreach ($relative in $restoreFiles) {
    $source = Join-Path $backupDir.FullName $relative
    $target = Join-Path $ProjectRoot $relative

    if (-not (Test-Path $source)) {
        Write-Host "WARNING: Backup does not contain $relative - skipping." -ForegroundColor Yellow
        continue
    }

    # Preserve the currently broken version too, just in case.
    if (Test-Path $target) {
        $brokenBackup = "$target.pre-repair-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item $target $brokenBackup -Force
    }

    Copy-Item $source $target -Force
    Write-Host "Restored $relative" -ForegroundColor Green
}

# ------------------------------------------------------------------
# Make sure each restored page has exactly one shared dashboard header.
# This is intentionally conservative: it does not replace whole Paper
# blocks or remove any form/profile content.
# ------------------------------------------------------------------

$pages = @(
    "src\pages\LeaderInfo.tsx",
    "src\pages\LeaderProfile.tsx",
    "src\pages\MemberManagement.tsx"
)

foreach ($relative in $pages) {
    $path = Join-Path $ProjectRoot $relative

    if (-not (Test-Path $path)) {
        continue
    }

    $text = Get-Content $path -Raw

    # Ensure import exists exactly once.
    $text = [regex]::Replace(
        $text,
        '(?m)^import LeaderDashboardHeader from "\.\./components/admin/LeaderDashboardHeader";\r?\n',
        ''
    )

    $text =
        'import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";' +
        "`r`n" +
        $text

    # Remove duplicate component instances.
    $text = [regex]::Replace(
        $text,
        '\s*<LeaderDashboardHeader\s*/>\s*',
        "`r`n"
    )

    # Insert one shared header immediately after the first Container.
    $container = [regex]::Match(
        $text,
        '<Container(?<attrs>[^>]*)>'
    )

    if ($container.Success) {
        $insert =
            $container.Value +
            "`r`n                <LeaderDashboardHeader />"

        $text =
            $text.Remove(
                $container.Index,
                $container.Length
            ).Insert(
                $container.Index,
                $insert
            )
    }

    # Remove only the old temporary Member Management navigation block
    # if its explicit marker is present. Do not touch other Paper blocks.
    if ($relative -like "*MemberManagement.tsx") {
        $markerStart = $text.IndexOf("{/* MEMBER_MANAGEMENT_TOP_NAV */}")

        if ($markerStart -ge 0) {
            $paperStart = $text.LastIndexOf("<Paper", $markerStart)
            $paperClose = $text.IndexOf("</Paper>", $markerStart)

            if (
                $paperStart -ge 0 -and
                $paperClose -ge 0
            ) {
                $paperClose += "</Paper>".Length

                $text =
                    $text.Remove(
                        $paperStart,
                        $paperClose - $paperStart
                    )
            }
        }
    }

    Set-Content -Path $path -Value $text -Encoding UTF8
    Write-Host "Checked shared header in $relative" -ForegroundColor Green
}

Write-Host ""
Write-Host "Repair complete." -ForegroundColor Green
Write-Host "The full Leader Profile functionality has been restored from backup." -ForegroundColor Cyan
Write-Host "No large JSX/Paper blocks were rewritten by this repair." -ForegroundColor Cyan
Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build" -ForegroundColor Yellow
