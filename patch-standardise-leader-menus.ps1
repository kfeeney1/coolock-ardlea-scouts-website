$ErrorActionPreference = "Stop"

$ProjectRoot = Get-Location
$HeaderPath = Join-Path $ProjectRoot "src\components\admin\LeaderDashboardHeader.tsx"

if (-not (Test-Path (Join-Path $ProjectRoot "package.json"))) {
    Write-Host "ERROR: Run this script from the project root." -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path (Split-Path $HeaderPath) | Out-Null

# -------------------------------------------------------------------
# 1. Standard shared Leader Dashboard menu
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
                borderRadius: 2
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
                                whiteSpace: "nowrap"
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
Write-Host "Standardised LeaderDashboardHeader.tsx" -ForegroundColor Green

# -------------------------------------------------------------------
# 2. Clean all leader pages
# -------------------------------------------------------------------

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
        Write-Host "Skipping missing page: $PageName" -ForegroundColor Yellow
        continue
    }

    $Backup = "$Path.standardise-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $Path $Backup -Force

    $Text = Get-Content $Path -Raw

    # ---------------------------------------------------------------
    # Remove any duplicate LeaderDashboardHeader imports.
    # ---------------------------------------------------------------
    $Text = [regex]::Replace(
        $Text,
        '(?m)^import LeaderDashboardHeader from "\.\./components/admin/LeaderDashboardHeader";\r?\n',
        ''
    )

    $Text =
        'import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";' +
        "`r`n" +
        $Text

    # ---------------------------------------------------------------
    # Remove every existing instance, then insert exactly one below
    # the first Container. This guarantees no double shared menus.
    # ---------------------------------------------------------------
    $Text = [regex]::Replace(
        $Text,
        '\s*<LeaderDashboardHeader\s*/>\s*',
        "`r`n"
    )

    $ContainerMatch = [regex]::Match(
        $Text,
        '<Container(?<attrs>[^>]*)>'
    )

    if ($ContainerMatch.Success) {
        $Insert =
            $ContainerMatch.Value +
            "`r`n                <LeaderDashboardHeader />"

        $Text =
            $Text.Remove(
                $ContainerMatch.Index,
                $ContainerMatch.Length
            ).Insert(
                $ContainerMatch.Index,
                $Insert
            )
    } else {
        Write-Host "WARNING: Could not find Container in $PageName" -ForegroundColor Yellow
    }

    # ---------------------------------------------------------------
    # Remove old Member Management temporary top-nav block, if the
    # earlier patch added it.
    # ---------------------------------------------------------------
    $Text = [regex]::Replace(
        $Text,
        '(?s)\s*<Paper\s+elevation=\{2\}\s+sx=\{\{.*?\}\}\s*>\s*<Box\s+sx=\{\{.*?\}\}\s*>\s*.*?MEMBER_MANAGEMENT_TOP_NAV.*?</Paper>\s*',
        "`r`n"
    )

    # Alternate marker shape: marker directly inside Paper.
    $Text = [regex]::Replace(
        $Text,
        '(?s)\s*<Paper[^>]*>\s*\{/\*\s*MEMBER_MANAGEMENT_TOP_NAV\s*\*/\}.*?</Paper>\s*',
        "`r`n"
    )

    # ---------------------------------------------------------------
    # Remove old page-level navigation Buttons.
    # The shared header is now the only navigation menu.
    # Do NOT remove non-navigation buttons such as Refresh, Manage,
    # Print, Save, Approve, Sign Out, etc.
    # ---------------------------------------------------------------
    $LeaderPaths = @(
        "/leader",
        "/leader/members",
        "/leader/join",
        "/leader/consents",
        "/leader/info",
        "/leader/profile"
    )

    foreach ($LeaderPath in $LeaderPaths) {
        $Escaped = [regex]::Escape($LeaderPath)

        $Text = [regex]::Replace(
            $Text,
            '(?s)\s*<Button\b(?:(?!</Button>).)*?\bto="' +
            $Escaped +
            '"(?:(?!</Button>).)*?</Button>\s*',
            "`r`n"
        )
    }

    # ---------------------------------------------------------------
    # AdminDashboard previously had its own Leader Dashboard title.
    # The shared header now owns that title, so remove the old exact
    # heading to avoid a duplicated heading.
    # ---------------------------------------------------------------
    if ($PageName -eq "AdminDashboard.tsx") {
        $Text = [regex]::Replace(
            $Text,
            '(?s)\s*<Typography\b(?:(?!</Typography>).)*?>\s*Leader Dashboard\s*</Typography>\s*',
            "`r`n",
            1
        )
    }

    # ---------------------------------------------------------------
    # Clean empty Stack/Box wrappers that can be left behind after
    # old navigation buttons are removed.
    # ---------------------------------------------------------------
    for ($i = 0; $i -lt 3; $i++) {
        $Text = [regex]::Replace(
            $Text,
            '(?s)\s*<Stack\b[^>]*>\s*</Stack>\s*',
            "`r`n"
        )

        $Text = [regex]::Replace(
            $Text,
            '(?s)\s*<Box\b[^>]*>\s*</Box>\s*',
            "`r`n"
        )
    }

    Set-Content -Path $Path -Value $Text -Encoding UTF8
    Write-Host "Standardised $PageName" -ForegroundColor Green
}

Write-Host ""
Write-Host "Leader menu standardisation complete." -ForegroundColor Green
Write-Host ""
Write-Host "Result:" -ForegroundColor Cyan
Write-Host "  - One shared Leader Dashboard heading"
Write-Host "  - One shared navigation menu on every leader page"
Write-Host "  - Same button sizes and spacing everywhere"
Write-Host "  - Active menu item highlighted"
Write-Host "  - Old duplicate navigation buttons removed"
Write-Host "  - Page-specific controls such as Refresh / Manage remain"
Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "npm run build" -ForegroundColor Yellow
