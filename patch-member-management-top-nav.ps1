$ErrorActionPreference = "Stop"

$ProjectRoot = Get-Location
$Target = Join-Path $ProjectRoot "src\pages\MemberManagement.tsx"

if (-not (Test-Path $Target)) {
    Write-Host "ERROR: Could not find src\pages\MemberManagement.tsx" -ForegroundColor Red
    exit 1
}

$Backup = "$Target.nav-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $Target $Backup -Force

$text = Get-Content $Target -Raw

if ($text -match 'MEMBER_MANAGEMENT_TOP_NAV') {
    Write-Host "Member Management top navigation is already installed." -ForegroundColor Yellow
    exit 0
}

$needle = '<Container maxWidth="xl">'

if (-not $text.Contains($needle)) {
    Write-Host "ERROR: Could not find the Member Management Container." -ForegroundColor Red
    Write-Host "Backup created at: $Backup" -ForegroundColor Yellow
    exit 1
}

$navigation = @'
<Container maxWidth="xl">
        {/* MEMBER_MANAGEMENT_TOP_NAV */}
        <Paper
          elevation={2}
          sx={{
            p: 2,
            mb: 3
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(6, minmax(0, 1fr))"
              },
              gap: 1.25
            }}
          >
            <Button
              component={Link}
              to="/leader"
              variant="outlined"
              color="secondary"
              sx={{
                width: "100%",
                minHeight: 42
              }}
            >
              Dashboard
            </Button>

            <Button
              component={Link}
              to="/leader/members"
              variant="contained"
              color="secondary"
              sx={{
                width: "100%",
                minHeight: 42
              }}
            >
              Member Management
            </Button>

            <Button
              component={Link}
              to="/leader/join"
              variant="outlined"
              color="secondary"
              sx={{
                width: "100%",
                minHeight: 42
              }}
            >
              Join Us Management
            </Button>

            <Button
              component={Link}
              to="/leader/consents"
              variant="outlined"
              color="secondary"
              sx={{
                width: "100%",
                minHeight: 42
              }}
            >
              Consent Management
            </Button>

            <Button
              component={Link}
              to="/leader/info"
              variant="outlined"
              color="secondary"
              sx={{
                width: "100%",
                minHeight: 42
              }}
            >
              Info & FAQ
            </Button>

            <Button
              component={Link}
              to="/leader/profile"
              variant="outlined"
              color="secondary"
              sx={{
                width: "100%",
                minHeight: 42
              }}
            >
              My Profile
            </Button>
          </Box>
        </Paper>
'@

$text = $text.Replace($needle, $navigation)

# Remove the redundant Dashboard button from the Member Management page header.
$dashboardButtonPattern = '(?s)\s*<Button\s+component=\{\s*Link\s*\}\s+to="/leader"\s+variant="outlined"\s+color="secondary"\s*>\s*Dashboard\s*</Button>\s*'

$text = [regex]::Replace(
    $text,
    $dashboardButtonPattern,
    "`r`n",
    1
)

Set-Content -Path $Target -Value $text -Encoding UTF8

Write-Host ""
Write-Host "Member Management top navigation installed." -ForegroundColor Green
Write-Host "Backup: $Backup" -ForegroundColor Cyan
Write-Host ""
Write-Host "The Member Management content now opens below the persistent leader navigation buttons." -ForegroundColor Cyan
Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build" -ForegroundColor Yellow
