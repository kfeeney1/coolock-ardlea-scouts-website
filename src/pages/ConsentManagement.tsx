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
    Divider,
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
    Link
} from "react-router-dom";

import {
    loadConsentAdminRecords,
    daysUntilExpiry,
    isConsentExpired
} from "../services/consentAdmin";

import type {
    ConsentAdminRecord
} from "../services/consentAdmin";

import {
    brandColours
} from "../theme/theme";

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
        return value.join(", ");
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
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}

function objectField(
    data: Record<string, unknown>,
    key: string
): string {
    const value = data[key];

    if (
        value === null ||
        value === undefined ||
        value === ""
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

    return String(value);
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
        return `Expired ${Math.abs(
            days
        )} day(s) ago`;
    }

    if (days === 0) {
        return "Expires today";
    }

    return `Expires in ${days} day(s)`;
}

type InfoValueProps = {
    value: string;
};

function InfoValue({
    value
}: InfoValueProps) {
    if (!value) {
        return (
            <Typography
                color="text.secondary"
                sx={{
                    fontStyle: "italic"
                }}
            >
                Not provided
            </Typography>
        );
    }

    return (
        <Typography
            sx={{
                fontWeight: 600,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
            }}
        >
            {value}
        </Typography>
    );
}

type SectionHeadingProps = {
    children: string;
};

function SectionHeading({
    children
}: SectionHeadingProps) {
    return (
        <Typography
            variant="h6"
            color="secondary"
            sx={{
                mb: 1.5,
                fontWeight: 800
            }}
        >
            {children}
        </Typography>
    );
}

type MedicationRowProps = {
    label: string;
    value: string;
    highlight?: boolean;
};

function MedicationRow({
    label,
    value,
    highlight = false
}: MedicationRowProps) {
    return (
        <TableRow>
            <TableCell
                sx={{
                    width: "38%",
                    fontWeight: 700,
                    color: "secondary.main",
                    backgroundColor:
                        highlight
                            ? brandColours.navyLight
                            : "background.default"
                }}
            >
                {label}
            </TableCell>

            <TableCell
                sx={{
                    backgroundColor:
                        highlight
                            ? brandColours.navyLight
                            : "background.paper"
                }}
            >
                <InfoValue value={value} />
            </TableCell>
        </TableRow>
    );
}

type MedicationManagementPanelProps = {
    value: Record<string, unknown>;
};

function MedicationManagementPanel({
    value
}: MedicationManagementPanelProps) {
    const selfAdmin =
        objectField(
            value,
            "selfAdmin"
        );

    const authFrom =
        objectField(
            value,
            "authFrom"
        );

    const authTo =
        objectField(
            value,
            "authTo"
        );

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
                    px: {
                        xs: 2.5,
                        md: 3
                    },
                    py: 2,
                    backgroundColor: "#FDECEC",
                    borderBottom: "1px solid",
                    borderColor: "error.light"
                }}
            >
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                        alignItems: "center",
                        flexWrap: "wrap",
                        rowGap: 1
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

                    <Chip
                        label="Required"
                        color="error"
                        variant="outlined"
                        size="small"
                    />
                </Stack>
            </Box>

            <Box
                sx={{
                    p: {
                        xs: 2.5,
                        md: 3
                    }
                }}
            >
                <SectionHeading>
                    Member
                </SectionHeading>

                <TableContainer
                    component={Paper}
                    variant="outlined"
                >
                    <Table size="small">
                        <TableBody>
                            <MedicationRow
                                label="Name"
                                value={objectField(
                                    value,
                                    "memberName"
                                )}
                            />

                            <MedicationRow
                                label="Date of Birth"
                                value={formatDateOnly(
                                    objectField(
                                        value,
                                        "dateOfBirth"
                                    )
                                )}
                            />

                            <MedicationRow
                                label="Address"
                                value={objectField(
                                    value,
                                    "address"
                                )}
                            />
                        </TableBody>
                    </Table>
                </TableContainer>

                <Box sx={{ mt: 3.5 }}>
                    <SectionHeading>
                        Medication
                    </SectionHeading>

                    <TableContainer
                        component={Paper}
                        variant="outlined"
                    >
                        <Table size="small">
                            <TableBody>
                                <MedicationRow
                                    label="Medicine"
                                    value={objectField(
                                        value,
                                        "medicineName"
                                    )}
                                    highlight
                                />

                                <MedicationRow
                                    label="Dosage"
                                    value={objectField(
                                        value,
                                        "dosage"
                                    )}
                                    highlight
                                />

                                <MedicationRow
                                    label="Frequency"
                                    value={objectField(
                                        value,
                                        "frequency"
                                    )}
                                    highlight
                                />

                                <MedicationRow
                                    label="Method"
                                    value={objectField(
                                        value,
                                        "method"
                                    )}
                                />

                                <MedicationRow
                                    label="Quantity Supplied"
                                    value={objectField(
                                        value,
                                        "quantitySupplied"
                                    )}
                                />

                                <TableRow>
                                    <TableCell
                                        sx={{
                                            width: "38%",
                                            fontWeight: 700,
                                            color: "secondary.main",
                                            backgroundColor:
                                                "background.default"
                                        }}
                                    >
                                        Self Administration
                                    </TableCell>

                                    <TableCell>
                                        {selfAdmin ? (
                                            <Chip
                                                label={
                                                    selfAdmin.toUpperCase()
                                                }
                                                size="small"
                                                color={
                                                    selfAdmin === "Yes"
                                                        ? "success"
                                                        : "warning"
                                                }
                                            />
                                        ) : (
                                            <Typography
                                                color="text.secondary"
                                                sx={{
                                                    fontStyle: "italic"
                                                }}
                                            >
                                                Not provided
                                            </Typography>
                                        )}
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>

                <Box
                    sx={{
                        mt: 3.5,
                        p: {
                            xs: 2,
                            sm: 2.5
                        },
                        borderRadius: 3,
                        backgroundColor:
                            brandColours.navyLight,
                        border: "1px solid",
                        borderColor:
                            "secondary.light"
                    }}
                >
                    <Typography
                        variant="h6"
                        color="secondary"
                        sx={{
                            fontWeight: 800,
                            mb: 1.5
                        }}
                    >
                        Authorisation
                    </Typography>

                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: {
                                xs: "1fr",
                                sm: "1fr 1fr"
                            },
                            gap: 2
                        }}
                    >
                        <Box>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                    fontWeight: 700
                                }}
                            >
                                AUTHORISED FROM
                            </Typography>

                            <InfoValue
                                value={
                                    authFrom
                                        ? formatDateOnly(
                                              authFrom
                                          )
                                        : ""
                                }
                            />
                        </Box>

                        <Box>
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                    fontWeight: 700
                                }}
                            >
                                AUTHORISED UNTIL
                            </Typography>

                            <InfoValue
                                value={
                                    authTo
                                        ? formatDateOnly(
                                              authTo
                                          )
                                        : ""
                                }
                            />
                        </Box>
                    </Box>
                </Box>

                <Box sx={{ mt: 3.5 }}>
                    <SectionHeading>
                        Medical Contacts
                    </SectionHeading>

                    <TableContainer
                        component={Paper}
                        variant="outlined"
                    >
                        <Table size="small">
                            <TableBody>
                                <MedicationRow
                                    label="Doctor"
                                    value={objectField(
                                        value,
                                        "doctorName"
                                    )}
                                />

                                <MedicationRow
                                    label="Doctor Telephone"
                                    value={objectField(
                                        value,
                                        "doctorTel"
                                    )}
                                />

                                <MedicationRow
                                    label="Pharmacy"
                                    value={objectField(
                                        value,
                                        "pharmacyName"
                                    )}
                                />

                                <MedicationRow
                                    label="Pharmacy Telephone"
                                    value={objectField(
                                        value,
                                        "pharmacyTel"
                                    )}
                                />
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>

                <Box sx={{ mt: 3.5 }}>
                    <SectionHeading>
                        Authorised Scouters
                    </SectionHeading>

                    <TableContainer
                        component={Paper}
                        variant="outlined"
                    >
                        <Table size="small">
                            <TableBody>
                                <MedicationRow
                                    label="Scouter 1"
                                    value={objectField(
                                        value,
                                        "scouter1"
                                    )}
                                />

                                <MedicationRow
                                    label="Scouter 2"
                                    value={objectField(
                                        value,
                                        "scouter2"
                                    )}
                                />
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>

                <Box sx={{ mt: 3.5 }}>
                    <SectionHeading>
                        Additional Information
                    </SectionHeading>

                    <Paper
                        variant="outlined"
                        sx={{
                            p: 2,
                            minHeight: 72,
                            backgroundColor:
                                "background.default"
                        }}
                    >
                        <InfoValue
                            value={objectField(
                                value,
                                "otherInfo"
                            )}
                        />
                    </Paper>
                </Box>

                <Box sx={{ mt: 3.5 }}>
                    <SectionHeading>
                        Signature
                    </SectionHeading>

                    <TableContainer
                        component={Paper}
                        variant="outlined"
                    >
                        <Table size="small">
                            <TableBody>
                                <MedicationRow
                                    label="Signed By"
                                    value={objectField(
                                        value,
                                        "signature"
                                    )}
                                />

                                <MedicationRow
                                    label="Date"
                                    value={formatDateOnly(
                                        objectField(
                                            value,
                                            "signatureDate"
                                        )
                                    )}
                                />
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            </Box>
        </Paper>
    );
}

function buildMedicationPrintHtml(
    value: Record<string, unknown>
): string {
    const row = (
        label: string,
        valueText: string
    ) => `
        <tr>
            <th>${escapeHtml(label)}</th>
            <td>${escapeHtml(
                valueText ||
                    "Not provided"
            )}</td>
        </tr>
    `;

    const selfAdmin =
        objectField(
            value,
            "selfAdmin"
        );

    return `
        <section class="medication-panel">

            <div class="medication-header">
                <strong>
                    Medication Management
                </strong>

                <span class="badge">
                    SIF 20/10
                </span>

                <span class="badge-outline">
                    Required
                </span>
            </div>

            <h3>Member</h3>

            <table>
                ${row(
                    "Name",
                    objectField(
                        value,
                        "memberName"
                    )
                )}

                ${row(
                    "Date of Birth",
                    formatDateOnly(
                        objectField(
                            value,
                            "dateOfBirth"
                        )
                    )
                )}

                ${row(
                    "Address",
                    objectField(
                        value,
                        "address"
                    )
                )}
            </table>

            <h3>Medication</h3>

            <table>
                ${row(
                    "Medicine",
                    objectField(
                        value,
                        "medicineName"
                    )
                )}

                ${row(
                    "Dosage",
                    objectField(
                        value,
                        "dosage"
                    )
                )}

                ${row(
                    "Frequency",
                    objectField(
                        value,
                        "frequency"
                    )
                )}

                ${row(
                    "Method",
                    objectField(
                        value,
                        "method"
                    )
                )}

                ${row(
                    "Quantity Supplied",
                    objectField(
                        value,
                        "quantitySupplied"
                    )
                )}

                ${row(
                    "Self Administration",
                    selfAdmin
                )}
            </table>

            <div class="authorisation-strip">

                <div>
                    <span>
                        Authorised From
                    </span>

                    <strong>
                        ${escapeHtml(
                            formatDateOnly(
                                objectField(
                                    value,
                                    "authFrom"
                                )
                            )
                        )}
                    </strong>
                </div>

                <div>
                    <span>
                        Authorised Until
                    </span>

                    <strong>
                        ${escapeHtml(
                            formatDateOnly(
                                objectField(
                                    value,
                                    "authTo"
                                )
                            )
                        )}
                    </strong>
                </div>

            </div>

            <h3>Medical Contacts</h3>

            <table>
                ${row(
                    "Doctor",
                    objectField(
                        value,
                        "doctorName"
                    )
                )}

                ${row(
                    "Doctor Telephone",
                    objectField(
                        value,
                        "doctorTel"
                    )
                )}

                ${row(
                    "Pharmacy",
                    objectField(
                        value,
                        "pharmacyName"
                    )
                )}

                ${row(
                    "Pharmacy Telephone",
                    objectField(
                        value,
                        "pharmacyTel"
                    )
                )}
            </table>

            <h3>Authorised Scouters</h3>

            <table>
                ${row(
                    "Scouter 1",
                    objectField(
                        value,
                        "scouter1"
                    )
                )}

                ${row(
                    "Scouter 2",
                    objectField(
                        value,
                        "scouter2"
                    )
                )}
            </table>

            <h3>Additional Information</h3>

            <div class="additional-info">
                ${escapeHtml(
                    objectField(
                        value,
                        "otherInfo"
                    ) ||
                        "Not provided"
                )}
            </div>

            <h3>Signature</h3>

            <table>
                ${row(
                    "Signed By",
                    objectField(
                        value,
                        "signature"
                    )
                )}

                ${row(
                    "Date",
                    formatDateOnly(
                        objectField(
                            value,
                            "signatureDate"
                        )
                    )
                )}
            </table>

        </section>
    `;
}

function buildPrintRows(
    record: ConsentAdminRecord
): string {
    return Object.entries(
        record.data
    )
        .filter(
            ([key]) =>
                key !== "submittedAt" &&
                key !==
                    "authorisedScouters" &&
                key !==
                    "medicationManagement"
        )
        .map(
            ([key, value]) => {
                const text =
                    displayValue(
                        value
                    );

                if (!text) {
                    return "";
                }

                return `
                    <tr>
                        <th>
                            ${escapeHtml(
                                formatFieldName(
                                    key
                                )
                            )}
                        </th>

                        <td>
                            <div class="value">
                                ${escapeHtml(
                                    text
                                )}
                            </div>
                        </td>
                    </tr>
                `;
            }
        )
        .join("");
}

function printRecord(
    record: ConsentAdminRecord
) {
    const printWindow =
        window.open(
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

    const memberName =
        escapeHtml(
            record.memberName ||
                "Consent Record"
        );

    const section =
        escapeHtml(
            record.section ||
                "Unknown section"
        );

    const submitted =
        escapeHtml(
            formatDate(
                record.submittedAt
            )
        );

    const status =
        escapeHtml(
            record.status
        );

    const consentFrom =
        escapeHtml(
            record.consentFrom
                ? formatDateOnly(
                      record.consentFrom
                  )
                : "Not specified"
        );

    const consentTo =
        escapeHtml(
            record.consentTo
                ? formatDateOnly(
                      record.consentTo
                  )
                : "Not specified"
        );

    const expiry =
        escapeHtml(
            expiryLabel(
                record
            )
        );

    const rows =
        buildPrintRows(
            record
        );

    const medication =
        record.data
            .medicationManagement;

    const medicationHtml =
        medication &&
        typeof medication ===
            "object" &&
        !Array.isArray(
            medication
        ) &&
        record.hasMedicationManagement
            ? buildMedicationPrintHtml(
                  medication as Record<
                      string,
                      unknown
                  >
              )
            : "";

    const medicalWarning =
        record.hasMedicalAlert
            ? `
                <div class="warning">
                    <strong>
                        Medical information recorded
                    </strong>
                    <br />
                    Review the medical information in this
                    consent record before relevant activities.
                </div>
            `
            : "";

    const medicationWarning =
        record.hasMedicationManagement
            ? `
                <div class="danger">
                    <strong>
                        Medication Management Required
                    </strong>
                    <br />
                    A Managing Medications SIF 20/10
                    record is attached to this consent.
                </div>
            `
            : "";

    const html = `
        <!doctype html>

        <html lang="en">

        <head>

            <meta charset="utf-8" />

            <title>
                ${memberName} - Consent Record
            </title>

            <style>

                * {
                    box-sizing:
                        border-box;
                }

                body {
                    font-family:
                        Arial,
                        Helvetica,
                        sans-serif;

                    margin: 0;

                    padding: 32px;

                    color: #1f2937;

                    background:
                        white;
                }

                .header {
                    border-bottom:
                        5px solid #F52D45;

                    padding-bottom:
                        18px;

                    margin-bottom:
                        24px;
                }

                h1 {
                    margin: 0;

                    color: #081E67;

                    font-size:
                        30px;
                }

                h2 {
                    margin:
                        8px 0 0 0;

                    font-size:
                        20px;

                    color:
                        #081E67;
                }

                h3 {
                    color:
                        #081E67;

                    margin:
                        24px 0 8px;
                }

                .group-name {
                    margin-top:
                        6px;

                    color:
                        #555;
                }

                .summary {
                    display:
                        grid;

                    grid-template-columns:
                        1fr 1fr;

                    gap: 10px;

                    margin-bottom:
                        24px;

                    padding:
                        16px;

                    background:
                        #F8F9FA;

                    border:
                        1px solid #ddd;

                    border-radius:
                        8px;
                }

                .summary-item {
                    font-size:
                        14px;
                }

                .summary-label {
                    display:
                        block;

                    font-size:
                        11px;

                    font-weight:
                        bold;

                    text-transform:
                        uppercase;

                    color:
                        #6b7280;

                    margin-bottom:
                        3px;
                }

                .warning {
                    padding:
                        14px;

                    margin-bottom:
                        16px;

                    background:
                        #fff8e1;

                    border-left:
                        5px solid #ed6c02;

                    page-break-inside:
                        avoid;
                }

                .danger {
                    padding:
                        14px;

                    margin-bottom:
                        16px;

                    background:
                        #fdecec;

                    border-left:
                        5px solid #d32f2f;

                    page-break-inside:
                        avoid;
                }

                table {
                    width:
                        100%;

                    border-collapse:
                        collapse;

                    font-size:
                        13px;
                }

                tr {
                    page-break-inside:
                        avoid;
                }

                th,
                td {
                    border:
                        1px solid #d1d5db;

                    padding:
                        10px;

                    text-align:
                        left;

                    vertical-align:
                        top;
                }

                th {
                    width:
                        34%;

                    background:
                        #EEF1FA;

                    color:
                        #081E67;
                }

                td {
                    background:
                        white;
                }

                .value {
                    white-space:
                        pre-wrap;

                    word-break:
                        break-word;
                }

                .medication-panel {
                    margin-top:
                        28px;

                    border:
                        2px solid #d32f2f;

                    border-radius:
                        8px;

                    overflow:
                        hidden;

                    padding-bottom:
                        18px;

                    page-break-inside:
                        avoid;
                }

                .medication-header {
                    padding:
                        14px 16px;

                    background:
                        #fdecec;

                    color:
                        #b71c1c;

                    font-size:
                        20px;
                }

                .badge,
                .badge-outline {
                    display:
                        inline-block;

                    margin-left:
                        8px;

                    padding:
                        3px 8px;

                    border-radius:
                        12px;

                    font-size:
                        11px;

                    vertical-align:
                        middle;
                }

                .badge {
                    background:
                        #d32f2f;

                    color:
                        white;
                }

                .badge-outline {
                    border:
                        1px solid #d32f2f;

                    color:
                        #d32f2f;

                    background:
                        white;
                }

                .medication-panel h3,
                .medication-panel table,
                .medication-panel .additional-info {
                    margin-left:
                        16px;

                    margin-right:
                        16px;
                }

                .authorisation-strip {
                    display:
                        grid;

                    grid-template-columns:
                        1fr 1fr;

                    gap:
                        18px;

                    margin:
                        24px 16px;

                    padding:
                        16px;

                    background:
                        #EEF1FA;

                    border:
                        1px solid #cfd8ea;

                    border-radius:
                        8px;
                }

                .authorisation-strip span {
                    display:
                        block;

                    font-size:
                        10px;

                    font-weight:
                        bold;

                    color:
                        #6b7280;

                    text-transform:
                        uppercase;

                    margin-bottom:
                        4px;
                }

                .additional-info {
                    border:
                        1px solid #d1d5db;

                    padding:
                        12px;

                    white-space:
                        pre-wrap;

                    word-break:
                        break-word;
                }

                .footer {
                    margin-top:
                        24px;

                    padding-top:
                        12px;

                    border-top:
                        1px solid #ddd;

                    font-size:
                        11px;

                    color:
                        #666;
                }

                .print-controls {
                    margin-bottom:
                        24px;
                }

                .print-button {
                    border: 0;

                    border-radius:
                        20px;

                    padding:
                        10px 22px;

                    background:
                        #00B050;

                    color:
                        white;

                    font-size:
                        14px;

                    font-weight:
                        bold;

                    cursor:
                        pointer;
                }

                .close-button {
                    border:
                        1px solid #081E67;

                    border-radius:
                        20px;

                    padding:
                        9px 22px;

                    margin-left:
                        10px;

                    background:
                        white;

                    color:
                        #081E67;

                    font-size:
                        14px;

                    font-weight:
                        bold;

                    cursor:
                        pointer;
                }

                @media print {

                    body {
                        padding:
                            0;
                    }

                    .print-controls {
                        display:
                            none;
                    }

                    .summary {
                        background:
                            white;
                    }

                    @page {
                        margin:
                            15mm;
                    }

                }

            </style>

        </head>

        <body>

            <div class="print-controls">

                <button
                    class="print-button"
                    onclick="window.print()"
                >
                    Print / Save as PDF
                </button>

                <button
                    class="close-button"
                    onclick="window.close()"
                >
                    Close
                </button>

            </div>

            <div class="header">

                <h1>
                    Consent Record
                </h1>

                <h2>
                    ${memberName}
                </h2>

                <div class="group-name">
                    80th 160th Coolock Ardlea Scout Group
                </div>

            </div>

            <div class="summary">

                <div class="summary-item">

                    <span class="summary-label">
                        Member
                    </span>

                    ${memberName}

                </div>

                <div class="summary-item">

                    <span class="summary-label">
                        Section
                    </span>

                    ${section}

                </div>

                <div class="summary-item">

                    <span class="summary-label">
                        Status
                    </span>

                    ${status}

                </div>

                <div class="summary-item">

                    <span class="summary-label">
                        Submitted
                    </span>

                    ${submitted}

                </div>

                <div class="summary-item">

                    <span class="summary-label">
                        Consent From
                    </span>

                    ${consentFrom}

                </div>

                <div class="summary-item">

                    <span class="summary-label">
                        Consent To
                    </span>

                    ${consentTo}

                </div>

                <div class="summary-item">

                    <span class="summary-label">
                        Expiry
                    </span>

                    ${expiry}

                </div>

            </div>

            ${medicalWarning}

            ${medicationWarning}

            <table>

                <tbody>
                    ${rows}
                </tbody>

            </table>

            ${medicationHtml}

            <div class="footer">

                Generated from the
                80th 160th Coolock Ardlea Scout Group
                Leader Portal.

                <br />

                This document may contain confidential
                personal and medical information.

            </div>

        </body>

        </html>
    `;

    printWindow.document.open();

    printWindow.document.write(
        html
    );

    printWindow.document.close();

    window.setTimeout(
        () => {
            try {
                printWindow.focus();
                printWindow.print();
            } catch (
                printError
            ) {
                console.error(
                    "Unable to open print dialog:",
                    printError
                );
            }
        },
        500
    );
}

export default function ConsentManagement() {
    const [
        records,
        setRecords
    ] =
        useState<ConsentAdminRecord[]>(
            []
        );

    const [
        loading,
        setLoading
    ] =
        useState(true);

    const [
        error,
        setError
    ] =
        useState("");

    const [
        search,
        setSearch
    ] =
        useState("");

    const [
        typeFilter,
        setTypeFilter
    ] =
        useState<TypeFilter>(
            "all"
        );

    const [
        sectionFilter,
        setSectionFilter
    ] =
        useState("all");

    const [
        alertFilter,
        setAlertFilter
    ] =
        useState<AlertFilter>(
            "all"
        );

    const [
        selected,
        setSelected
    ] =
        useState<
            ConsentAdminRecord | null
        >(
            null
        );

    const load =
        async () => {
            setLoading(
                true
            );

            setError("");

            try {
                setRecords(
                    await loadConsentAdminRecords()
                );
            } catch (
                loadError
            ) {
                console.error(
                    "Unable to load consent management records:",
                    loadError
                );

                setError(
                    "Unable to load consent records."
                );
            } finally {
                setLoading(
                    false
                );
            }
        };

    useEffect(
        () => {
            void load();
        },
        []
    );

    const filteredRecords =
        useMemo(
            () =>
                records.filter(
                    (
                        record
                    ) => {
                        if (
                            typeFilter !==
                                "all" &&
                            record.type !==
                                typeFilter
                        ) {
                            return false;
                        }

                        if (
                            sectionFilter !==
                                "all" &&
                            record.section !==
                                sectionFilter
                        ) {
                            return false;
                        }

                        const days =
                            daysUntilExpiry(
                                record.consentTo
                            );

                        if (
                            alertFilter ===
                                "medical" &&
                            !record.hasMedicalAlert
                        ) {
                            return false;
                        }

                        if (
                            alertFilter ===
                                "medication" &&
                            !record.hasMedicationManagement
                        ) {
                            return false;
                        }

                        if (
                            alertFilter ===
                                "expired" &&
                            !isConsentExpired(
                                record.consentTo
                            )
                        ) {
                            return false;
                        }

                        if (
                            alertFilter ===
                                "expiring" &&
                            !(
                                days !==
                                    null &&
                                days >=
                                    0 &&
                                days <=
                                    30
                            )
                        ) {
                            return false;
                        }

                        const queryText =
                            search
                                .trim()
                                .toLowerCase();

                        if (
                            !queryText
                        ) {
                            return true;
                        }

                        return [
                            record.memberName,
                            record.section,
                            record.status,
                            JSON.stringify(
                                record.data
                            )
                        ]
                            .join(
                                " "
                            )
                            .toLowerCase()
                            .includes(
                                queryText
                            );
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

    const totals =
        useMemo(
            () => ({
                total:
                    records.length,

                youth:
                    records.filter(
                        (
                            record
                        ) =>
                            record.type ===
                            "youth"
                    ).length,

                scouter:
                    records.filter(
                        (
                            record
                        ) =>
                            record.type ===
                            "scouter"
                    ).length,

                medication:
                    records.filter(
                        (
                            record
                        ) =>
                            record.hasMedicationManagement
                    ).length,

                medical:
                    records.filter(
                        (
                            record
                        ) =>
                            record.hasMedicalAlert
                    ).length,

                expired:
                    records.filter(
                        (
                            record
                        ) =>
                            isConsentExpired(
                                record.consentTo
                            )
                    ).length
            }),
            [
                records
            ]
        );

    return (
        <Box
            sx={{
                minHeight:
                    "100vh",

                backgroundColor:
                    "background.default",

                py: {
                    xs: 4,
                    md: 6
                }
            }}
        >
            <Container
                maxWidth="xl"
            >
                <Paper
                    elevation={3}
                    sx={{
                        p: {
                            xs: 3,
                            md: 4
                        },

                        mb: 3,

                        borderTop:
                            `6px solid ${brandColours.coral}`
                    }}
                >
                    <Box
                        sx={{
                            display:
                                "flex",

                            flexDirection:
                                {
                                    xs: "column",
                                    md: "row"
                                },

                            justifyContent:
                                "space-between",

                            alignItems:
                                {
                                    xs: "stretch",
                                    md: "center"
                                },

                            gap: 2
                        }}
                    >
                        <Box>
                            <Typography
                                variant="h3"
                                color="secondary"
                            >
                                Consent Management
                            </Typography>

                            <Typography
                                color="text.secondary"
                                sx={{
                                    mt: 0.5
                                }}
                            >
                                Youth consent,
                                Scouter ES3 and
                                medication
                                information.
                            </Typography>
                        </Box>

                        <Stack
                            direction={{
                                xs: "column",
                                sm: "row"
                            }}
                            spacing={
                                1.5
                            }
                        >
                            <Button
                                component={
                                    Link
                                }
                                to="/leader"
                                variant="outlined"
                                color="secondary"
                            >
                                Dashboard
                            </Button>

                            <Button
                                variant="contained"
                                color="success"
                                onClick={() =>
                                    void load()
                                }
                            >
                                Refresh
                            </Button>
                        </Stack>
                    </Box>
                </Paper>

                <Box
                    sx={{
                        display:
                            "grid",

                        gridTemplateColumns:
                            {
                                xs: "1fr 1fr",
                                md: "repeat(6, 1fr)"
                            },

                        gap: 2,

                        mb: 3
                    }}
                >
                    {[
                        [
                            "Total",
                            totals.total
                        ],
                        [
                            "Youth",
                            totals.youth
                        ],
                        [
                            "Scouters",
                            totals.scouter
                        ],
                        [
                            "Medication",
                            totals.medication
                        ],
                        [
                            "Medical Alerts",
                            totals.medical
                        ],
                        [
                            "Expired",
                            totals.expired
                        ]
                    ].map(
                        ([
                            label,
                            value
                        ]) => (
                            <Paper
                                key={
                                    String(
                                        label
                                    )
                                }
                                variant="outlined"
                                sx={{
                                    p: 2.5,

                                    textAlign:
                                        "center"
                                }}
                            >
                                <Typography
                                    variant="h4"
                                    color="secondary"
                                >
                                    {
                                        value
                                    }
                                </Typography>

                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                >
                                    {
                                        label
                                    }
                                </Typography>
                            </Paper>
                        )
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
                            display:
                                "grid",

                            gridTemplateColumns:
                                {
                                    xs: "1fr",
                                    md: "2fr 1fr 1fr 1fr"
                                },

                            gap: 2
                        }}
                    >
                        <TextField
                            label="Search consent records"
                            value={
                                search
                            }
                            onChange={(
                                event
                            ) =>
                                setSearch(
                                    event
                                        .target
                                        .value
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
                                value={
                                    typeFilter
                                }
                                onChange={(
                                    event
                                ) =>
                                    setTypeFilter(
                                        event
                                            .target
                                            .value as TypeFilter
                                    )
                                }
                            >
                                <MenuItem
                                    value="all"
                                >
                                    All
                                </MenuItem>

                                <MenuItem
                                    value="youth"
                                >
                                    Youth
                                </MenuItem>

                                <MenuItem
                                    value="scouter"
                                >
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
                                value={
                                    sectionFilter
                                }
                                onChange={(
                                    event
                                ) =>
                                    setSectionFilter(
                                        event
                                            .target
                                            .value
                                    )
                                }
                            >
                                {sections.map(
                                    (
                                        section
                                    ) => (
                                        <MenuItem
                                            key={
                                                section
                                            }
                                            value={
                                                section
                                            }
                                        >
                                            {section ===
                                            "all"
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
                                value={
                                    alertFilter
                                }
                                onChange={(
                                    event
                                ) =>
                                    setAlertFilter(
                                        event
                                            .target
                                            .value as AlertFilter
                                    )
                                }
                            >
                                <MenuItem
                                    value="all"
                                >
                                    All
                                </MenuItem>

                                <MenuItem
                                    value="medical"
                                >
                                    Medical alerts
                                </MenuItem>

                                <MenuItem
                                    value="medication"
                                >
                                    Medication
                                    management
                                </MenuItem>

                                <MenuItem
                                    value="expiring"
                                >
                                    Expires in
                                    30 days
                                </MenuItem>

                                <MenuItem
                                    value="expired"
                                >
                                    Expired
                                </MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </Paper>

                {error && (
                    <Alert
                        severity="error"
                        sx={{
                            mb: 3
                        }}
                    >
                        {error}
                    </Alert>
                )}

                {loading ? (
                    <Box
                        sx={{
                            minHeight:
                                300,

                            display:
                                "flex",

                            justifyContent:
                                "center",

                            alignItems:
                                "center"
                        }}
                    >
                        <CircularProgress
                            color="success"
                        />
                    </Box>
                ) : (
                    <Box
                        sx={{
                            display:
                                "grid",

                            gap: 2
                        }}
                    >
                        {filteredRecords.length ===
                            0 && (
                            <Alert
                                severity="info"
                            >
                                No consent
                                records match
                                the current
                                filters.
                            </Alert>
                        )}

                        {filteredRecords.map(
                            (
                                record
                            ) => {
                                const expired =
                                    isConsentExpired(
                                        record
                                            .consentTo
                                    );

                                const days =
                                    daysUntilExpiry(
                                        record
                                            .consentTo
                                    );

                                const expiringSoon =
                                    days !==
                                        null &&
                                    days >=
                                        0 &&
                                    days <=
                                        30;

                                return (
                                    <Paper
                                        key={
                                            record.id
                                        }
                                        variant="outlined"
                                        sx={{
                                            p: 2.5,

                                            borderLeft:
                                                record.hasMedicationManagement
                                                    ? `6px solid ${brandColours.coral}`
                                                    : undefined
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display:
                                                    "flex",

                                                flexDirection:
                                                    {
                                                        xs: "column",
                                                        lg: "row"
                                                    },

                                                justifyContent:
                                                    "space-between",

                                                gap: 2
                                            }}
                                        >
                                            <Box>
                                                <Stack
                                                    direction="row"
                                                    spacing={
                                                        1
                                                    }
                                                    sx={{
                                                        flexWrap:
                                                            "wrap",

                                                        rowGap:
                                                            1,

                                                        alignItems:
                                                            "center"
                                                    }}
                                                >
                                                    <Typography
                                                        variant="h5"
                                                        color="secondary"
                                                    >
                                                        {
                                                            record.memberName
                                                        }
                                                    </Typography>

                                                    <Chip
                                                        size="small"
                                                        label={
                                                            record.type ===
                                                            "youth"
                                                                ? "Youth"
                                                                : "Scouter ES3"
                                                        }
                                                        color={
                                                            record.type ===
                                                            "youth"
                                                                ? "primary"
                                                                : "secondary"
                                                        }
                                                    />

                                                    <Chip
                                                        size="small"
                                                        variant="outlined"
                                                        label={
                                                            record.section
                                                        }
                                                    />

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
                                                    sx={{
                                                        mt: 1
                                                    }}
                                                >
                                                    Submitted{" "}
                                                    {formatDate(
                                                        record
                                                            .submittedAt
                                                    )}
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
                                                                expired ||
                                                                expiringSoon
                                                                    ? 700
                                                                    : 400
                                                        }}
                                                    >
                                                        {expiryLabel(
                                                            record
                                                        )}
                                                    </Typography>
                                                )}
                                            </Box>

                                            <Stack
                                                direction={{
                                                    xs: "column",
                                                    sm: "row"
                                                }}
                                                spacing={
                                                    1.5
                                                }
                                            >
                                                <Button
                                                    variant="outlined"
                                                    color="secondary"
                                                    onClick={() =>
                                                        printRecord(
                                                            record
                                                        )
                                                    }
                                                >
                                                    Print
                                                </Button>

                                                <Button
                                                    variant="contained"
                                                    color="success"
                                                    onClick={() =>
                                                        setSelected(
                                                            record
                                                        )
                                                    }
                                                >
                                                    View
                                                    Details
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
                    open={
                        Boolean(
                            selected
                        )
                    }
                    onClose={() =>
                        setSelected(
                            null
                        )
                    }
                    maxWidth="lg"
                    fullWidth
                >
                    {selected && (
                        <>
                            <DialogTitle>
                                Consent
                                Record —{" "}
                                {
                                    selected.memberName
                                }
                            </DialogTitle>

                            <DialogContent
                                dividers
                            >
                                <Stack
                                    direction="row"
                                    spacing={
                                        1
                                    }
                                    sx={{
                                        flexWrap:
                                            "wrap",

                                        rowGap:
                                            1,

                                        mb: 3
                                    }}
                                >
                                    <Chip
                                        label={
                                            selected.type ===
                                            "youth"
                                                ? "Youth Consent"
                                                : "Scouter ES3"
                                        }
                                        color="secondary"
                                    />

                                    <Chip
                                        label={
                                            selected.section
                                        }
                                        variant="outlined"
                                    />

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

                                {selected.hasMedicationManagement && (
                                    <Alert
                                        severity="error"
                                        sx={{
                                            mb: 3
                                        }}
                                    >
                                        This member
                                        has a Managing
                                        Medications
                                        SIF 20/10
                                        record.
                                    </Alert>
                                )}

                                {selected.hasMedicalAlert && (
                                    <Alert
                                        severity="warning"
                                        sx={{
                                            mb: 3
                                        }}
                                    >
                                        Medical or
                                        allergy
                                        information
                                        has been
                                        recorded.
                                    </Alert>
                                )}

                                <Divider
                                    sx={{
                                        mb: 3
                                    }}
                                />

                                <Box
                                    sx={{
                                        display:
                                            "grid",

                                        gridTemplateColumns:
                                            {
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
                                            ([
                                                key
                                            ]) =>
                                                key !==
                                                    "submittedAt" &&
                                                key !==
                                                    "authorisedScouters"
                                        )
                                        .map(
                                            ([
                                                key,
                                                value
                                            ]) => {
                                                if (
                                                    key ===
                                                        "medicationManagement" &&
                                                    value &&
                                                    typeof value ===
                                                        "object" &&
                                                    !Array.isArray(
                                                        value
                                                    )
                                                ) {
                                                    if (
                                                        (
                                                            value as Record<
                                                                string,
                                                                unknown
                                                            >
                                                        )
                                                            .enabled !==
                                                        true
                                                    ) {
                                                        return null;
                                                    }

                                                    return (
                                                        <MedicationManagementPanel
                                                            key={
                                                                key
                                                            }
                                                            value={
                                                                value as Record<
                                                                    string,
                                                                    unknown
                                                                >
                                                            }
                                                        />
                                                    );
                                                }

                                                const text =
                                                    displayValue(
                                                        value
                                                    );

                                                if (
                                                    !text
                                                ) {
                                                    return null;
                                                }

                                                const wide =
                                                    typeof value ===
                                                        "object" &&
                                                    value !==
                                                        null;

                                                return (
                                                    <Paper
                                                        key={
                                                            key
                                                        }
                                                        variant="outlined"
                                                        sx={{
                                                            p: 2,

                                                            gridColumn:
                                                                wide
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
                                                                fontWeight:
                                                                    700
                                                            }}
                                                        >
                                                            {formatFieldName(
                                                                key
                                                            )}
                                                        </Typography>

                                                        <Typography
                                                            sx={{
                                                                mt: 0.5,

                                                                whiteSpace:
                                                                    "pre-wrap",

                                                                wordBreak:
                                                                    "break-word"
                                                            }}
                                                        >
                                                            {
                                                                text
                                                            }
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
                                        printRecord(
                                            selected
                                        )
                                    }
                                >
                                    Print /
                                    Save PDF
                                </Button>

                                <Button
                                    onClick={() =>
                                        setSelected(
                                            null
                                        )
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
