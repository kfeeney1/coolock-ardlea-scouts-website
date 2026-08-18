$ErrorActionPreference = "Stop"

$ProjectRoot = Get-Location
$ComponentsDir = Join-Path $ProjectRoot "src\components\admin"
$HeaderPath = Join-Path $ComponentsDir "LeaderDashboardHeader.tsx"

if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
    Write-Host "ERROR: Run this script from the project root." -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path $ComponentsDir | Out-Null

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
    const location =
        useLocation();

    return (
        <Paper
            elevation={3}
            sx={{
                p: {
                    xs: 2.5,
                    md: 3
                },
                mb: 3
            }}
        >
            <Typography
                variant="h3"
                color="secondary"
                sx={{
                    fontWeight: 800,
                    mb: 2
                }}
            >
                Leader Dashboard
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
                {navItems.map(
                    (
                        item
                    ) => {
                        const active =
                            location.pathname ===
                            item.path;

                        return (
                            <Button
                                key={
                                    item.path
                                }
                                component={
                                    Link
                                }
                                to={
                                    item.path
                                }
                                variant={
                                    active
                                        ? "contained"
                                        : "outlined"
                                }
                                color="secondary"
                                sx={{
                                    width:
                                        "100%",
                                    minHeight:
                                        44,
                                    whiteSpace:
                                        "nowrap"
                                }}
                            >
                                {
                                    item.label
                                }
                            </Button>
                        );
                    }
                )}
            </Box>
        </Paper>
    );
}
'@

Set-Content -Path $HeaderPath -Value $Header -Encoding UTF8
Write-Host "Created src\components\admin\LeaderDashboardHeader.tsx" -ForegroundColor Green

$Pages = @(
    "AdminDashboard.tsx",
    "MemberManagement.tsx",
    "JoinManagement.tsx",
    "ConsentManagement.tsx",
    "LeaderInfo.tsx",
    "LeaderProfile.tsx"
)

foreach ($PageName in $Pages) {
    $Path = Join-Path $ProjectRoot ("src\pages\" + $PageName)

    if (-not (Test-Path $Path)) {
        Write-Host "Skipping missing file: $PageName" -ForegroundColor Yellow
        continue
    }

    $Backup = "$Path.leader-header-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $Path $Backup -Force

    $Text = Get-Content $Path -Raw

    if ($Text -notmatch 'LeaderDashboardHeader') {
        $Text = 'import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";' + "`r`n" + $Text
    }

    if ($Text -notmatch '<LeaderDashboardHeader\s*/>') {
        $ContainerPattern = '<Container(?<attrs>[^>]*)>'

        $Match = [regex]::Match(
            $Text,
            $ContainerPattern
        )

        if ($Match.Success) {
            $Insert =
                $Match.Value +
                "`r`n                <LeaderDashboardHeader />"

            $Text =
                $Text.Remove(
                    $Match.Index,
                    $Match.Length
                ).Insert(
                    $Match.Index,
                    $Insert
                )
        } else {
            Write-Host "Could not find Container in $PageName; header import added but component not inserted." -ForegroundColor Yellow
        }
    }

    Set-Content -Path $Path -Value $Text -Encoding UTF8
    Write-Host "Updated $PageName" -ForegroundColor Green
}

Write-Host ""
Write-Host "Persistent Leader Dashboard header installed." -ForegroundColor Green
Write-Host ""
Write-Host "The Leader Dashboard title now sits above a single aligned row/grid of navigation buttons." -ForegroundColor Cyan
Write-Host "The same Leader Dashboard header is retained when opening Member Management, Join Us Management, Consent Management, Info & FAQ, or My Profile." -ForegroundColor Cyan
Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build" -ForegroundColor Yellow
