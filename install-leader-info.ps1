$ErrorActionPreference = "Stop"

$ProjectRoot = $PSScriptRoot
$ZipFile = Join-Path $ProjectRoot "leader-info-page.zip"
$TempDir = Join-Path $ProjectRoot "_leader_info_temp"
$BackupDir = Join-Path $ProjectRoot ("leader-info-backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
    Write-Host "ERROR: Run this script from the project root." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $ZipFile)) {
    Write-Host "ERROR: leader-info-page.zip was not found beside this script." -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

foreach ($relative in @(
    "src\App.tsx",
    "src\pages\AdminDashboard.tsx",
    "src\pages\LeaderInfo.tsx"
)) {
    $source = Join-Path $ProjectRoot $relative

    if (Test-Path $source) {
        $destination = Join-Path $BackupDir $relative
        New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
        Copy-Item $source $destination -Force
    }
}

if (Test-Path $TempDir) {
    Remove-Item $TempDir -Recurse -Force
}

Expand-Archive -Path $ZipFile -DestinationPath $TempDir -Force

$source = Join-Path $TempDir "src\pages\LeaderInfo.tsx"
$destination = Join-Path $ProjectRoot "src\pages\LeaderInfo.tsx"

New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
Copy-Item $source $destination -Force

$AppPath = Join-Path $ProjectRoot "src\App.tsx"
$app = Get-Content $AppPath -Raw

if ($app -notmatch 'from "\./pages/LeaderInfo"') {
    $app = 'import LeaderInfo from "./pages/LeaderInfo";' + "`r`n" + $app
}

if ($app -notmatch 'path="/leader/info"') {
    $route = @'
                <Route
                    path="/leader/info"
                    element={
                        <ProtectedAdminRoute>
                            <LeaderInfo />
                        </ProtectedAdminRoute>
                    }
                />

'@

    $app = $app -replace '</Routes>', ($route + '            </Routes>')
}

Set-Content -Path $AppPath -Value $app -Encoding UTF8

$DashboardPath = Join-Path $ProjectRoot "src\pages\AdminDashboard.tsx"

if (Test-Path $DashboardPath) {
    $dashboard = Get-Content $DashboardPath -Raw

    if ($dashboard -notmatch 'to="/leader/info"') {
        $needle = @'
                            <Button
                                component={Link}
                                to="/leader/profile"
                                variant="outlined"
                                color="secondary"
                            >
                                My Profile
                            </Button>
'@

        $replacement = @'
                            <Button
                                component={Link}
                                to="/leader/info"
                                variant="outlined"
                                color="secondary"
                            >
                                Info & FAQ
                            </Button>

                            <Button
                                component={Link}
                                to="/leader/profile"
                                variant="outlined"
                                color="secondary"
                            >
                                My Profile
                            </Button>
'@

        $dashboard = $dashboard.Replace($needle, $replacement)
    }

    Set-Content -Path $DashboardPath -Value $dashboard -Encoding UTF8
}

Remove-Item $TempDir -Recurse -Force

Write-Host ""
Write-Host "Leader Info & FAQ page installed." -ForegroundColor Green
Write-Host "Backup: $BackupDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build" -ForegroundColor Yellow
