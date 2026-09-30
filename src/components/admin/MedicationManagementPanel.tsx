import { Box, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableRow, Typography } from "@mui/material";

import { MEDICATION_EMPTY_STATE, formatDateOnly, medicationManagementHasInformation, normalizeMedicationManagement, objectField } from "../../services/consentManagementLogic";
import { medicationEntries } from "../consent/MedicationManagementForm";
import type { MedicationManagementData } from "../../services/consentApplications";

const mobileCell = {
  display: { xs: "block", sm: "table-cell" },
  width: { xs: "100%", sm: "auto" },
  overflowWrap: "anywhere"
} as const;

export default function MedicationManagementPanel({ value }: { value: unknown }) {
  const normalized = normalizeMedicationManagement(value) ?? {};
  const medication = normalized as unknown as MedicationManagementData;
  const entries = medicationEntries(medication);
  const sharedRows = [
    ["Doctor", objectField(normalized, "doctorName")], ["Doctor Telephone", objectField(normalized, "doctorTel")],
    ["Pharmacy", objectField(normalized, "pharmacyName")], ["Pharmacy Telephone", objectField(normalized, "pharmacyTel")],
    ["Scouter 1", objectField(normalized, "scouter1")], ["Scouter 2", objectField(normalized, "scouter2")],
    ["Member", objectField(normalized, "memberName")], ["Date of Birth", formatDateOnly(objectField(normalized, "dateOfBirth"))],
    ["Address", objectField(normalized, "address")], ["Signed By", objectField(normalized, "signature")],
    ["Signature Date", formatDateOnly(objectField(normalized, "signatureDate"))]
  ];

  const hasInformation = medicationManagementHasInformation(value);
  const visibleRows = sharedRows.filter(([, text]) => Boolean(text));

  return <Paper data-testid="medication-management-panel" variant="outlined" sx={{ gridColumn: { xs: "1", md: "1 / -1" }, overflow: "hidden", borderWidth: 2, borderColor: "error.light", minWidth: 0 }}>
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 2, borderBottom: "1px solid", borderColor: "error.light" }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography variant="h5" color="error.main" sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>Medication Management</Typography><Chip label="SIF 20/10" color="error" size="small" /></Stack>
    </Box>
    {!hasInformation ? <Typography role="status" sx={{ p: 3 }}>{MEDICATION_EMPTY_STATE}</Typography> : <><Stack spacing={2} sx={{ p: 2 }}>{entries.map((entry, index) => <Paper key={index} variant="outlined" sx={{ p: 2 }} data-testid={`medication-display-entry-${index}`}><Typography variant="h6" sx={{ mb: 1 }}>Medication {index + 1}</Typography><Typography><strong>Medicine</strong>: {entry.medicineName || "Not provided"}</Typography><Typography><strong>Dosage:</strong> {entry.dosage || "Not provided"}</Typography><Typography><strong>Frequency:</strong> {entry.frequency || "Not provided"}</Typography><Typography><strong>Method:</strong> {entry.method || "Not provided"}</Typography></Paper>)}</Stack><TableContainer><Table size="small" sx={{ tableLayout: { sm: "fixed" } }}><TableBody>{visibleRows.map(([label, text]) => <TableRow data-testid="medication-management-row" key={label} sx={{ display: { xs: "block", sm: "table-row" } }}><TableCell sx={{ ...mobileCell, width: { xs: "100%", sm: "38%" }, pb: { xs: .5, sm: 1 }, fontWeight: 700, color: "secondary.main", verticalAlign: "top", borderBottom: { xs: 0, sm: "1px solid" } }}>{label}</TableCell><TableCell sx={{ ...mobileCell, pt: { xs: 0, sm: 1 } }}>{text}</TableCell></TableRow>)}</TableBody></Table></TableContainer></>}
  </Paper>;
}
