$ErrorActionPreference = "Stop"

$ProjectRoot = Get-Location
$Target = Join-Path $ProjectRoot "src\pages\JoinManagement.tsx"

if (-not (Test-Path $Target)) {
    Write-Host "ERROR: Could not find src\pages\JoinManagement.tsx" -ForegroundColor Red
    exit 1
}

$Backup = "$Target.status-buttons-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $Target $Backup -Force

$text = Get-Content $Target -Raw

$old = @'
                                sx={{
                                    p: 2.5,
                                    textAlign:
                                        "center",
                                    cursor:
                                        status ===
                                        "waiting-list"
                                            ? "pointer"
                                            : "default"
                                }}
                                onClick={() => {
                                    if (
                                        status ===
                                        "waiting-list"
                                    ) {
                                        setViewMode(
                                            "waiting-list"
                                        );
                                    }
                                }}
'@

$new = @'
                                role="button"
                                tabIndex={0}
                                sx={{
                                    p: 2.5,
                                    textAlign:
                                        "center",
                                    cursor: "pointer",
                                    userSelect: "none",
                                    transition:
                                        "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
                                    borderWidth:
                                        (
                                            status === "waiting-list" &&
                                            viewMode === "waiting-list"
                                        ) ||
                                        (
                                            status !== "waiting-list" &&
                                            viewMode === "all" &&
                                            statusFilter === status
                                        )
                                            ? 2
                                            : 1,
                                    borderColor:
                                        (
                                            status === "waiting-list" &&
                                            viewMode === "waiting-list"
                                        ) ||
                                        (
                                            status !== "waiting-list" &&
                                            viewMode === "all" &&
                                            statusFilter === status
                                        )
                                            ? status === "waiting-list"
                                                ? "warning.main"
                                                : "secondary.main"
                                            : "divider",
                                    "&:hover": {
                                        transform:
                                            "translateY(-2px)",
                                        boxShadow: 3
                                    },
                                    "&:focus-visible": {
                                        outline:
                                            "3px solid",
                                        outlineColor:
                                            "primary.main",
                                        outlineOffset:
                                            "2px"
                                    }
                                }}
                                onClick={() => {
                                    if (
                                        status ===
                                        "waiting-list"
                                    ) {
                                        setViewMode(
                                            "waiting-list"
                                        );
                                        setWaitingSectionFilter(
                                            "all"
                                        );
                                        setWaitingSearch(
                                            ""
                                        );
                                    } else {
                                        setViewMode(
                                            "all"
                                        );
                                        setStatusFilter(
                                            status
                                        );
                                    }
                                }}
                                onKeyDown={(event) => {
                                    if (
                                        event.key ===
                                            "Enter" ||
                                        event.key ===
                                            " "
                                    ) {
                                        event.preventDefault();

                                        if (
                                            status ===
                                            "waiting-list"
                                        ) {
                                            setViewMode(
                                                "waiting-list"
                                            );
                                            setWaitingSectionFilter(
                                                "all"
                                            );
                                            setWaitingSearch(
                                                ""
                                            );
                                        } else {
                                            setViewMode(
                                                "all"
                                            );
                                            setStatusFilter(
                                                status
                                            );
                                        }
                                    }
                                }}
'@

if (-not $text.Contains($old)) {
    Write-Host "ERROR: Could not find the Stage 5 summary-card block to patch." -ForegroundColor Red
    Write-Host "Backup created at: $Backup" -ForegroundColor Yellow
    exit 1
}

$text = $text.Replace($old, $new)

Set-Content -Path $Target -Value $text -Encoding UTF8

Write-Host ""
Write-Host "Join Management summary cards are now clickable." -ForegroundColor Green
Write-Host "Backup: $Backup" -ForegroundColor Cyan
Write-Host ""
Write-Host "Behaviour:" -ForegroundColor Cyan
Write-Host "  New          -> filters All Enquiries to New"
Write-Host "  Contacted    -> filters All Enquiries to Contacted"
Write-Host "  Waiting List -> opens the dedicated Waiting List view"
Write-Host "  Accepted     -> filters All Enquiries to Accepted"
Write-Host "  Closed       -> filters All Enquiries to Closed"
Write-Host ""
Write-Host "Now run: npm run build" -ForegroundColor Yellow
