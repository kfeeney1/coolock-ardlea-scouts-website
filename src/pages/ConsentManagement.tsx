import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";

import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableRow,
    TextField,
    Typography
} from "@mui/material";

import {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    daysUntilExpiry,
    isConsentExpired,
    loadConsentAdminRecords
} from "../services/consentAdmin";

import type {
    ConsentAdminRecord
} from "../services/consentAdmin";

type TypeFilter =
    | "all"
    | "youth"
    | "scouter";

type AlertFilter =
    | "all"
    | "medical"
    | "medication"
    | "expiring"
    | "expired";

type SummaryFilter =
    | "total"
    | "youth"
    | "scouter"
    | "medication"
    | "medical"
    | "expired";

const sections = [
    "all",
    "Beavers",
    "Cubs",
    "Scouts",
    "Ventures",
    "Rovers",
    "Scouter"
];

function formatDate(
    date: Date | null
): string {
    if (!date) {
        return "Unknown";
    }

    return new Intl.DateTimeFormat(
        "en-IE",
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    ).format(date);
}

function formatDateOnly(
    value: string
): string {
    if (!value) {
        return "Not provided";
    }

    const date = new Date(
        `${value}T00:00:00`
    );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }

    return new Intl.DateTimeFormat(
        "en-IE",
        {
            dateStyle: "medium"
        }
    ).format(date);
}

function formatFieldName(
    key: string
): string {
    return key
        .replace(
            /([a-z])([A-Z])/g,
            "$1 $2"
        )
        .replace(
            /_/g,
            " "
        )
        .replace(
            /\b\w/g,
            (character) =>
                character.toUpperCase()
        );
}

function displayValue(
    value: unknown
): string {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    if (
        typeof value === "boolean"
    ) {
        return value
            ? "Yes"
            : "No";
    }

    if (
        typeof value === "string" ||
        typeof value === "number"
    ) {
        return String(value);
    }

    if (
        Array.isArray(value)
    ) {
        return value
            .map(displayValue)
            .filter(Boolean)
            .join(", ");
    }

    if (
        typeof value === "object"
    ) {
        if (
            "seconds" in value ||
            "nanoseconds" in value
        ) {
            return "";
        }

        return JSON.stringify(
            value,
            null,
            2
        );
    }

    return String(value);
}

function escapeHtml(
    value: string
): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function objectField(
    data: Record<string, unknown>,
    key: string
): string {
    return displayValue(
        data[key]
    );
}

function expiryLabel(
    record: ConsentAdminRecord
): string {
    if (!record.consentTo) {
        return "No expiry date";
    }

    const days =
        daysUntilExpiry(
            record.consentTo
        );

    if (days === null) {
        return record.consentTo;
    }

    if (days < 0) {
        return `Expired ${Math.abs(days)} day(s) ago`;
    }

    if (days === 0) {
        return "Expires today";
    }

    return `Expires in ${days} day(s)`;
}

function MedicationPanel({
    value
}: {
    value: Record<string, unknown>;
}) {
    const rows = [
        ["Member", objectField(value, "memberName")],
        ["Date of Birth", formatDateOnly(objectField(value, "dateOfBirth"))],
        ["Address", objectField(value, "address")],
        ["Medicine", objectField(value, "medicineName")],
        ["Dosage", objectField(value, "dosage")],
        ["Frequency", objectField(value, "frequency")],
        ["Method", objectField(value, "method")],
        ["Quantity Supplied", objectField(value, "quantitySupplied")],
        ["Self Administration", objectField(value, "selfAdmin")],
        ["Authorised From", formatDateOnly(objectField(value, "authFrom"))],
        ["Authorised Until", formatDateOnly(objectField(value, "authTo"))],
        ["Doctor", objectField(value, "doctorName")],
        ["Doctor Telephone", objectField(value, "doctorTel")],
        ["Pharmacy", objectField(value, "pharmacyName")],
        ["Pharmacy Telephone", objectField(value, "pharmacyTel")],
        ["Scouter 1", objectField(value, "scouter1")],
        ["Scouter 2", objectField(value, "scouter2")],
        ["Additional Information", objectField(value, "otherInfo")],
        ["Signed By", objectField(value, "signature")],
        ["Signature Date", formatDateOnly(objectField(value, "signatureDate"))]
    ];

    return (
        <Paper
            variant="outlined"
            sx={{
                gridColumn: {
                    xs: "1",
                    md: "1 / -1"
                },
                overflow: "hidden",
                borderWidth: 2,
                borderColor: "error.light"
            }}
        >
            <Box
                sx={{
                    px: 3,
                    py: 2,
                    backgroundColor: "error.50",
                    borderBottom: "1px solid",
                    borderColor: "error.light"
                }}
            >
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                        alignItems: "center",
                        flexWrap: "wrap"
                    }}
                >
                    <Typography
                        variant="h5"
                        color="error.main"
                        sx={{
                            fontWeight: 800
                        }}
                    >
                        Medication Management
                    </Typography>
                    <Chip
                        label="SIF 20/10"
                        color="error"
                        size="small"
                    />
                </Stack>
            </Box>

            <TableContainer>
                <Table size="small">
                    <TableBody>
                        {rows.map(
                            ([label, valueText]) => (
                                <TableRow key={label}>
                                    <TableCell
                                        sx={{
                                            width: "38%",
                                            fontWeight: 700,
                                            color: "secondary.main",
                                            verticalAlign: "top"
                                        }}
                                    >
                                        {label}
                                    </TableCell>
                                    <TableCell>
                                        {valueText || "Not provided"}
                                    </TableCell>
                                </TableRow>
                            )
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}

function printRecord(
    record: ConsentAdminRecord
) {
    const printWindow = window.open(
        "",
        "_blank",
        "width=1000,height=800"
    );

    if (!printWindow) {
        window.alert(
            "The print window was blocked by your browser. Please allow pop-ups for this site and try again."
        );
        return;
    }

    const rows = Object.entries(
        record.data
    )
        .filter(
            ([key]) =>
                key !== "submittedAt"
        )
        .map(
            ([key, value]) => {
                const text = displayValue(value);
                if (!text) return "";
                return `<tr><th>${escapeHtml(formatFieldName(key))}</th><td><pre>${escapeHtml(text)}</pre></td></tr>`;
            }
        )
        .join("");

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(record.memberName || "Consent Record")} - Consent Record</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:32px;color:#1f2937;background:white}
h1,h2{color:#081E67}h1{border-bottom:5px solid #F52D45;padding-bottom:14px}
.summary{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:16px;background:#f8f9fa;border:1px solid #ddd;margin-bottom:24px}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #d1d5db;padding:10px;text-align:left;vertical-align:top}th{width:34%;background:#EEF1FA;color:#081E67}pre{white-space:pre-wrap;word-break:break-word;margin:0;font:inherit}.controls{margin-bottom:20px}button{padding:10px 18px;margin-right:10px;cursor:pointer}@media print{.controls{display:none}body{padding:0}@page{margin:15mm}}
</style>
</head>
<body>
<div class="controls"><button onclick="window.print()">Print / Save as PDF</button><button onclick="window.close()">Close</button></div>
<h1>Consent Record</h1>
<h2>${escapeHtml(record.memberName || "Unknown member")}</h2>
<div class="summary">
<div><strong>Section:</strong> ${escapeHtml(record.section || "Not provided")}</div>
<div><strong>Type:</strong> ${escapeHtml(record.type === "youth" ? "Youth" : "Scouter ES3")}</div>
<div><strong>Submitted:</strong> ${escapeHtml(formatDate(record.submittedAt))}</div>
<div><strong>Expiry:</strong> ${escapeHtml(expiryLabel(record))}</div>
</div>
<table><tbody>${rows}</tbody></table>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    window.setTimeout(
        () => {
            printWindow.focus();
            printWindow.print();
        },
        500
    );
}

export default function ConsentManagement() {
    const [records, setRecords] =
        useState<ConsentAdminRecord[]>([]);
    const [loading, setLoading] =
        useState(true);
    const [error, setError] =
        useState("");
    const [search, setSearch] =
        useState("");
    const [typeFilter, setTypeFilter] =
        useState<TypeFilter>("all");
    const [sectionFilter, setSectionFilter] =
        useState("all");
    const [alertFilter, setAlertFilter] =
        useState<AlertFilter>("all");
    const [selected, setSelected] =
        useState<ConsentAdminRecord | null>(null);

    const load = async () => {
        setLoading(true);
        setError("");

        try {
            setRecords(
                await loadConsentAdminRecords()
            );
        } catch (loadError) {
            console.error(
                "Unable to load consent management records:",
                loadError
            );
            setError(
                "Unable to load consent records."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(
        () => {
            void load();
        },
        []
    );

    const filteredRecords = useMemo(
        () =>
            records.filter(
                (record) => {
                    if (
                        typeFilter !== "all" &&
                        record.type !== typeFilter
                    ) {
                        return false;
                    }

                    if (
                        sectionFilter !== "all" &&
                        record.section !== sectionFilter
                    ) {
                        return false;
                    }

                    const days = daysUntilExpiry(
                        record.consentTo
                    );

                    if (
                        alertFilter === "medical" &&
                        !record.hasMedicalAlert
                    ) {
                        return false;
                    }

                    if (
                        alertFilter === "medication" &&
                        !record.hasMedicationManagement
                    ) {
                        return false;
                    }

                    if (
                        alertFilter === "expired" &&
                        !isConsentExpired(record.consentTo)
                    ) {
                        return false;
                    }

                    if (
                        alertFilter === "expiring" &&
                        !(
                            days !== null &&
                            days >= 0 &&
                            days <= 30
                        )
                    ) {
                        return false;
                    }

                    const queryText =
                        search
                            .trim()
                            .toLowerCase();

                    if (!queryText) {
                        return true;
                    }

                    return [
                        record.memberName,
                        record.section,
                        record.status,
                        JSON.stringify(record.data)
                    ]
                        .join(" ")
                        .toLowerCase()
                        .includes(queryText);
                }
            ),
        [
            records,
            typeFilter,
            sectionFilter,
            alertFilter,
            search
        ]
    );

    const totals = useMemo(
        () => ({
            total: records.length,
            youth:
                records.filter(
                    (record) =>
                        record.type === "youth"
                ).length,
            scouter:
                records.filter(
                    (record) =>
                        record.type === "scouter"
                ).length,
            medication:
                records.filter(
                    (record) =>
                        record.hasMedicationManagement
                ).length,
            medical:
                records.filter(
                    (record) =>
                        record.hasMedicalAlert
                ).length,
            expired:
                records.filter(
                    (record) =>
                        isConsentExpired(
                            record.consentTo
                        )
                ).length
        }),
        [records]
    );

    const activeSummaryFilter: SummaryFilter | "" = (() => {
        if (
            typeFilter === "youth" &&
            alertFilter === "all"
        ) {
            return "youth";
        }

        if (
            typeFilter === "scouter" &&
            alertFilter === "all"
        ) {
            return "scouter";
        }

        if (
            typeFilter === "all" &&
            alertFilter === "medication"
        ) {
            return "medication";
        }

        if (
            typeFilter === "all" &&
            alertFilter === "medical"
        ) {
            return "medical";
        }

        if (
            typeFilter === "all" &&
            alertFilter === "expired"
        ) {
            return "expired";
        }

        if (
            typeFilter === "all" &&
            alertFilter === "all"
        ) {
            return "total";
        }

        return "";
    })();

    const applySummaryFilter = (
        filter: SummaryFilter
    ) => {
        if (filter === "youth") {
            setTypeFilter("youth");
            setAlertFilter("all");
            return;
        }

        if (filter === "scouter") {
            setTypeFilter("scouter");
            setAlertFilter("all");
            return;
        }

        setTypeFilter("all");

        if (filter === "medication") {
            setAlertFilter("medication");
        } else if (filter === "medical") {
            setAlertFilter("medical");
        } else if (filter === "expired") {
            setAlertFilter("expired");
        } else {
            setAlertFilter("all");
        }
    };

    const summaryCards: Array<[
        string,
        number,
        SummaryFilter
    ]> = [
        ["Total", totals.total, "total"],
        ["Youth", totals.youth, "youth"],
        ["Scouters", totals.scouter, "scouter"],
        ["Medication", totals.medication, "medication"],
        ["Medical Alerts", totals.medical, "medical"],
        ["Expired", totals.expired, "expired"]
    ];

    return (
        <Box
            sx={{
                minHeight: "100vh",
                backgroundColor: "background.default",
                py: {
                    xs: 4,
                    md: 6
                }
            }}
        >
            <Container maxWidth="xl">
                <LeaderDashboardHeader />

                <LeaderPageHeader
                    title="Consent Management"
                    description="Youth consent, Scouter ES3 and medication information."
                    actions={
                        <Button
                            variant="contained"
                            color="success"
                            onClick={() =>
                                void load()
                            }
                        >
                            Refresh
                        </Button>
                    }
                />

                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "1fr 1fr",
                            md: "repeat(6, 1fr)"
                        },
                        gap: 2,
                        mb: 3
                    }}
                >
                    {summaryCards.map(
                        ([label, value, filter]) => {
                            const active =
                                activeSummaryFilter === filter;

                            return (
                                <Paper
                                    key={filter}
                                    variant="outlined"
                                    role="button"
                                    tabIndex={0}
                                    onClick={() =>
                                        applySummaryFilter(filter)
                                    }
                                    onKeyDown={(event) => {
                                        if (
                                            event.key === "Enter" ||
                                            event.key === " "
                                        ) {
                                            event.preventDefault();
                                            applySummaryFilter(filter);
                                        }
                                    }}
                                    sx={{
                                        p: 2.5,
                                        textAlign: "center",
                                        cursor: "pointer",
                                        userSelect: "none",
                                        borderWidth: active
                                            ? 2
                                            : 1,
                                        borderColor: active
                                            ? filter === "expired" ||
                                              filter === "medication"
                                                ? "error.main"
                                                : filter === "medical"
                                                  ? "warning.main"
                                                  : "secondary.main"
                                            : "divider",
                                        transition:
                                            "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
                                        "&:hover": {
                                            transform: "translateY(-2px)",
                                            boxShadow: 3
                                        },
                                        "&:focus-visible": {
                                            outline: "3px solid",
                                            outlineColor: "primary.main",
                                            outlineOffset: "2px"
                                        }
                                    }}
                                >
                                    <Typography
                                        variant="h4"
                                        color="secondary"
                                    >
                                        {value}
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        {label}
                                    </Typography>
                                </Paper>
                            );
                        }
                    )}
                </Box>

                <Paper
                    elevation={2}
                    sx={{
                        p: 3,
                        mb: 3
                    }}
                >
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                md: "2fr 1fr 1fr 1fr"
                            },
                            gap: 2
                        }}
                    >
                        <TextField
                            label="Search consent records"
                            value={search}
                            onChange={(event) =>
                                setSearch(
                                    event.target.value
                                )
                            }
                            placeholder="Name, section, medical information..."
                        />

                        <FormControl>
                            <InputLabel>
                                Form type
                            </InputLabel>
                            <Select
                                label="Form type"
                                value={typeFilter}
                                onChange={(event) =>
                                    setTypeFilter(
                                        event.target.value as TypeFilter
                                    )
                                }
                            >
                                <MenuItem value="all">
                                    All
                                </MenuItem>
                                <MenuItem value="youth">
                                    Youth
                                </MenuItem>
                                <MenuItem value="scouter">
                                    Scouter ES3
                                </MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl>
                            <InputLabel>
                                Section
                            </InputLabel>
                            <Select
                                label="Section"
                                value={sectionFilter}
                                onChange={(event) =>
                                    setSectionFilter(
                                        event.target.value
                                    )
                                }
                            >
                                {sections.map(
                                    (section) => (
                                        <MenuItem
                                            key={section}
                                            value={section}
                                        >
                                            {section === "all"
                                                ? "All sections"
                                                : section}
                                        </MenuItem>
                                    )
                                )}
                            </Select>
                        </FormControl>

                        <FormControl>
                            <InputLabel>
                                Attention
                            </InputLabel>
                            <Select
                                label="Attention"
                                value={alertFilter}
                                onChange={(event) =>
                                    setAlertFilter(
                                        event.target.value as AlertFilter
                                    )
                                }
                            >
                                <MenuItem value="all">
                                    All
                                </MenuItem>
                                <MenuItem value="medical">
                                    Medical alerts
                                </MenuItem>
                                <MenuItem value="medication">
                                    Medication management
                                </MenuItem>
                                <MenuItem value="expiring">
                                    Expires in 30 days
                                </MenuItem>
                                <MenuItem value="expired">
                                    Expired
                                </MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </Paper>

                {error && (
                    <Alert
                        severity="error"
                        sx={{ mb: 3 }}
                    >
                        {error}
                    </Alert>
                )}

                {loading ? (
                    <Box
                        sx={{
                            minHeight: 300,
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center"
                        }}
                    >
                        <CircularProgress color="success" />
                    </Box>
                ) : (
                    <Box
                        sx={{
                            display: "grid",
                            gap: 2
                        }}
                    >
                        {filteredRecords.length === 0 && (
                            <Alert severity="info">
                                No consent records match the current filters.
                            </Alert>
                        )}

                        {filteredRecords.map(
                            (record) => {
                                const expired =
                                    isConsentExpired(
                                        record.consentTo
                                    );
                                const days =
                                    daysUntilExpiry(
                                        record.consentTo
                                    );
                                const expiringSoon =
                                    days !== null &&
                                    days >= 0 &&
                                    days <= 30;

                                return (
                                    <Paper
                                        key={record.id}
                                        variant="outlined"
                                        sx={{
                                            p: 2.5,
                                            borderLeft: record.hasMedicationManagement
                                                ? "6px solid"
                                                : undefined,
                                            borderLeftColor: record.hasMedicationManagement
                                                ? "error.main"
                                                : undefined
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                flexDirection: {
                                                    xs: "column",
                                                    lg: "row"
                                                },
                                                justifyContent: "space-between",
                                                gap: 2
                                            }}
                                        >
                                            <Box>
                                                <Stack
                                                    direction="row"
                                                    spacing={1}
                                                    sx={{
                                                        flexWrap: "wrap",
                                                        rowGap: 1,
                                                        alignItems: "center"
                                                    }}
                                                >
                                                    <Typography
                                                        variant="h5"
                                                        color="secondary"
                                                    >
                                                        {record.memberName}
                                                    </Typography>
                                                    <Chip
                                                        size="small"
                                                        label={
                                                            record.type === "youth"
                                                                ? "Youth"
                                                                : "Scouter ES3"
                                                        }
                                                        color={
                                                            record.type === "youth"
                                                                ? "primary"
                                                                : "secondary"
                                                        }
                                                    />
                                                    {record.section && (
                                                        <Chip
                                                            size="small"
                                                            variant="outlined"
                                                            label={record.section}
                                                        />
                                                    )}
                                                    {record.hasMedicalAlert && (
                                                        <Chip
                                                            size="small"
                                                            color="warning"
                                                            label="Medical"
                                                        />
                                                    )}
                                                    {record.hasMedicationManagement && (
                                                        <Chip
                                                            size="small"
                                                            color="error"
                                                            label="Medication"
                                                        />
                                                    )}
                                                    {expired && (
                                                        <Chip
                                                            size="small"
                                                            color="error"
                                                            label="Expired"
                                                        />
                                                    )}
                                                    {!expired &&
                                                        expiringSoon && (
                                                            <Chip
                                                                size="small"
                                                                color="warning"
                                                                label="Expiring soon"
                                                            />
                                                        )}
                                                </Stack>

                                                <Typography
                                                    color="text.secondary"
                                                    sx={{ mt: 1 }}
                                                >
                                                    Submitted {formatDate(record.submittedAt)}
                                                </Typography>

                                                {record.consentTo && (
                                                    <Typography
                                                        variant="body2"
                                                        color={
                                                            expired
                                                                ? "error.main"
                                                                : expiringSoon
                                                                  ? "warning.main"
                                                                  : "text.secondary"
                                                        }
                                                        sx={{
                                                            mt: 0.5,
                                                            fontWeight:
                                                                expired || expiringSoon
                                                                    ? 700
                                                                    : 400
                                                        }}
                                                    >
                                                        {expiryLabel(record)}
                                                    </Typography>
                                                )}
                                            </Box>

                                            <Stack
                                                direction={{
                                                    xs: "column",
                                                    sm: "row"
                                                }}
                                                spacing={1.5}
                                            >
                                                <Button
                                                    variant="outlined"
                                                    color="secondary"
                                                    onClick={() =>
                                                        printRecord(record)
                                                    }
                                                >
                                                    Print
                                                </Button>
                                                <Button
                                                    variant="contained"
                                                    color="success"
                                                    onClick={() =>
                                                        setSelected(record)
                                                    }
                                                >
                                                    View Details
                                                </Button>
                                            </Stack>
                                        </Box>
                                    </Paper>
                                );
                            }
                        )}
                    </Box>
                )}

                <Dialog
                    open={Boolean(selected)}
                    onClose={() =>
                        setSelected(null)
                    }
                    maxWidth="lg"
                    fullWidth
                >
                    {selected && (
                        <>
                            <DialogTitle>
                                Consent Record — {selected.memberName}
                            </DialogTitle>

                            <DialogContent dividers>
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    sx={{
                                        flexWrap: "wrap",
                                        rowGap: 1,
                                        mb: 3
                                    }}
                                >
                                    <Chip
                                        label={
                                            selected.type === "youth"
                                                ? "Youth Consent"
                                                : "Scouter ES3"
                                        }
                                        color="secondary"
                                    />
                                    {selected.section && (
                                        <Chip
                                            label={selected.section}
                                            variant="outlined"
                                        />
                                    )}
                                    {selected.hasMedicalAlert && (
                                        <Chip
                                            label="Medical information present"
                                            color="warning"
                                        />
                                    )}
                                    {selected.hasMedicationManagement && (
                                        <Chip
                                            label="Medication management required"
                                            color="error"
                                        />
                                    )}
                                </Stack>

                                <Box
                                    sx={{
                                        display: "grid",
                                        gridTemplateColumns: {
                                            xs: "1fr",
                                            md: "1fr 1fr"
                                        },
                                        gap: 2
                                    }}
                                >
                                    {Object.entries(
                                        selected.data
                                    )
                                        .filter(
                                            ([key]) =>
                                                key !== "submittedAt" &&
                                                key !== "authorisedScouters"
                                        )
                                        .map(
                                            ([key, value]) => {
                                                if (
                                                    key === "medicationManagement" &&
                                                    value &&
                                                    typeof value === "object" &&
                                                    !Array.isArray(value) &&
                                                    (value as Record<string, unknown>).enabled === true
                                                ) {
                                                    return (
                                                        <MedicationPanel
                                                            key={key}
                                                            value={
                                                                value as Record<string, unknown>
                                                            }
                                                        />
                                                    );
                                                }

                                                const text =
                                                    displayValue(value);

                                                if (!text) {
                                                    return null;
                                                }

                                                return (
                                                    <Paper
                                                        key={key}
                                                        variant="outlined"
                                                        sx={{
                                                            p: 2,
                                                            gridColumn:
                                                                typeof value === "object" &&
                                                                value !== null
                                                                    ? {
                                                                          md: "1 / -1"
                                                                      }
                                                                    : undefined
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="caption"
                                                            color="text.secondary"
                                                            sx={{
                                                                fontWeight: 700
                                                            }}
                                                        >
                                                            {formatFieldName(key)}
                                                        </Typography>
                                                        <Typography
                                                            sx={{
                                                                mt: 0.5,
                                                                whiteSpace: "pre-wrap",
                                                                wordBreak: "break-word"
                                                            }}
                                                        >
                                                            {text}
                                                        </Typography>
                                                    </Paper>
                                                );
                                            }
                                        )}
                                </Box>
                            </DialogContent>

                            <DialogActions>
                                <Button
                                    onClick={() =>
                                        printRecord(selected)
                                    }
                                >
                                    Print / Save PDF
                                </Button>
                                <Button
                                    onClick={() =>
                                        setSelected(null)
                                    }
                                >
                                    Close
                                </Button>
                            </DialogActions>
                        </>
                    )}
                </Dialog>
            </Container>
        </Box>
    );
}
