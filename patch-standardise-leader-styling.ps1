$ErrorActionPreference = "Stop"

$ProjectRoot = Get-Location
$HeaderPath = Join-Path $ProjectRoot "src\components\admin\LeaderDashboardHeader.tsx"

if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
    Write-Host "ERROR: Run this script from the coolock-ardlea-scouts project root." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $HeaderPath)) {
    Write-Host "ERROR: Could not find src\components\admin\LeaderDashboardHeader.tsx" -ForegroundColor Red
    exit 1
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $ProjectRoot ("leader-style-backup-" + $timestamp)

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$FilesToBackup = @(
    "src\components\admin\LeaderDashboardHeader.tsx",
    "src\pages\AdminDashboard.tsx",
    "src\pages\MemberManagement.tsx",
    "src\pages\JoinManagement.tsx",
    "src\pages\ConsentManagement.tsx",
    "src\pages\LeaderInfo.tsx",
    "src\pages\LeaderProfile.tsx"
)

foreach ($relative in $FilesToBackup) {
    $source = Join-Path $ProjectRoot $relative

    if (Test-Path $source) {
        $destination = Join-Path $backupDir $relative
        New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
        Copy-Item $source $destination -Force
    }
}

# -------------------------------------------------------------------
# Shared Leader Dashboard header/menu
# -------------------------------------------------------------------

$Header = @'
import {
    Box,
    Button,
    Paper,
    Typography
} from "@mui/material";

import {
    Link,
    useLocation
} from "react-router-dom";

type NavItem = {
    label: string;
    path: string;
};

const navItems: NavItem[] = [
    {
        label: "Member Management",
        path: "/leader/members"
    },
    {
        label: "Join Us Management",
        path: "/leader/join"
    },
    {
        label: "Consent Management",
        path: "/leader/consents"
    },
    {
        label: "Info & FAQ",
        path: "/leader/info"
    },
    {
        label: "My Profile",
        path: "/leader/profile"
    }
];

export default function LeaderDashboardHeader() {
    const location = useLocation();

    return (
        <Paper
            elevation={3}
            sx={{
                p: {
                    xs: 2.5,
                    md: 3
                },
                mb: 3,
                borderRadius: 2,
                borderTop: "6px solid",
                borderTopColor: "secondary.main"
            }}
        >
            <Typography
                variant="h3"
                color="secondary"
                sx={{
                    fontWeight: 800,
                    mb: 0.75
                }}
            >
                Leader Dashboard
            </Typography>

            <Typography
                color="text.secondary"
                sx={{
                    mb: 2.5
                }}
            >
                Manage members, joining enquiries, consent records and leader settings.
            </Typography>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: {
                        xs: "1fr",
                        sm: "repeat(2, minmax(0, 1fr))",
                        lg: "repeat(5, minmax(0, 1fr))"
                    },
                    gap: 1.25,
                    alignItems: "stretch"
                }}
            >
                {navItems.map((item) => {
                    const active =
                        location.pathname === item.path;

                    return (
                        <Button
                            key={item.path}
                            component={Link}
                            to={item.path}
                            variant={
                                active
                                    ? "contained"
                                    : "outlined"
                            }
                            color="secondary"
                            sx={{
                                width: "100%",
                                minHeight: 44,
                                px: 2,
                                whiteSpace: "nowrap",
                                fontWeight: 700
                            }}
                        >
                            {item.label}
                        </Button>
                    );
                })}
            </Box>
        </Paper>
    );
}
'@

Set-Content -Path $HeaderPath -Value $Header -Encoding UTF8
Write-Host "Standardised shared Leader Dashboard header." -ForegroundColor Green

# -------------------------------------------------------------------
# Standardise each page's first section/header Paper AFTER the shared
# LeaderDashboardHeader. This keeps each page title consistent without
# rewriting any functional controls.
# -------------------------------------------------------------------

$Pages = @(
    @{
        File = "src\pages\MemberManagement.tsx"
        Title = "Member Management"
    },
    @{
        File = "src\pages\JoinManagement.tsx"
        Title = "Join Us Management"
    },
    @{
        File = "src\pages\ConsentManagement.tsx"
        Title = "Consent Management"
    },
    @{
        File = "src\pages\LeaderInfo.tsx"
        Title = "Leader Portal Information"
    },
    @{
        File = "src\pages\LeaderProfile.tsx"
        Title = "My Profile"
    }
)

foreach ($page in $Pages) {
    $path = Join-Path $ProjectRoot $page.File

    if (-not (Test-Path $path)) {
        Write-Host "Skipping missing file: $($page.File)" -ForegroundColor Yellow
        continue
    }

    $text = Get-Content $path -Raw

    # Make sure exactly one shared dashboard header exists.
    $text = [regex]::Replace(
        $text,
        '\s*<LeaderDashboardHeader\s*/>\s*',
        "`r`n"
    )

    $containerMatch = [regex]::Match(
        $text,
        '<Container(?<attrs>[^>]*)>'
    )

    if ($containerMatch.Success) {
        $insert =
            $containerMatch.Value +
            "`r`n                <LeaderDashboardHeader />"

        $text =
            $text.Remove(
                $containerMatch.Index,
                $containerMatch.Length
            ).Insert(
                $containerMatch.Index,
                $insert
            )
    }

    # Normalise the first Paper after LeaderDashboardHeader.
    # We only replace the opening Paper tag/sx, leaving all page content
    # and controls untouched.
    $headerIndex = $text.IndexOf("<LeaderDashboardHeader />")

    if ($headerIndex -ge 0) {
        $paperIndex = $text.IndexOf("<Paper", $headerIndex)

        if ($paperIndex -ge 0) {
            $paperEnd = $text.IndexOf(">", $paperIndex)

            if ($paperEnd -ge 0) {
                $oldPaperOpen = $text.Substring(
                    $paperIndex,
                    $paperEnd - $paperIndex + 1
                )

                $newPaperOpen = @'
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
'@

                $text =
                    $text.Remove(
                        $paperIndex,
                        $oldPaperOpen.Length
                    ).Insert(
                        $paperIndex,
                        $newPaperOpen
                    )
            }
        }
    }

    # Standardise page-title Typography where the literal title exists.
    $escapedTitle = [regex]::Escape($page.Title)

    $text = [regex]::Replace(
        $text,
        '(?s)<Typography\b(?<attrs>[^>]*)>\s*' +
        $escapedTitle +
        '\s*</Typography>',
        @"
<Typography
                        variant="h4"
                        color="secondary"
                        sx={{
                            fontWeight: 800
                        }}
                    >
                        $($page.Title)
                    </Typography>
"@,
        1
    )

    Set-Content -Path $path -Value $text -Encoding UTF8
    Write-Host "Standardised $($page.File)" -ForegroundColor Green
}

# -------------------------------------------------------------------
# Dashboard page: keep only the shared dashboard header as the top
# navigation area. Do not alter the functional dashboard content.
# -------------------------------------------------------------------

$DashboardPath = Join-Path $ProjectRoot "src\pages\AdminDashboard.tsx"

if (Test-Path $DashboardPath) {
    $text = Get-Content $DashboardPath -Raw

    $text = [regex]::Replace(
        $text,
        '\s*<LeaderDashboardHeader\s*/>\s*',
        "`r`n"
    )

    $containerMatch = [regex]::Match(
        $text,
        '<Container(?<attrs>[^>]*)>'
    )

    if ($containerMatch.Success) {
        $insert =
            $containerMatch.Value +
            "`r`n                <LeaderDashboardHeader />"

        $text =
            $text.Remove(
                $containerMatch.Index,
                $containerMatch.Length
            ).Insert(
                $containerMatch.Index,
                $insert
            )
    }

    Set-Content -Path $DashboardPath -Value $text -Encoding UTF8
    Write-Host "Standardised AdminDashboard.tsx" -ForegroundColor Green
}

Write-Host ""
Write-Host "Leader styling standardisation complete." -ForegroundColor Green
Write-Host "Backup: $backupDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "This standardises:" -ForegroundColor Cyan
Write-Host "  - Leader Dashboard header"
Write-Host "  - Navigation button sizes"
Write-Host "  - Navigation spacing"
Write-Host "  - Active menu styling"
Write-Host "  - Section header cards"
Write-Host "  - Page-title typography"
Write-Host "  - Margins and border treatment"
Write-Host ""
Write-Host "It does not remove or rewrite functional controls such as Refresh, Manage, Print or Save." -ForegroundColor Cyan
Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build" -ForegroundColor Yellow
