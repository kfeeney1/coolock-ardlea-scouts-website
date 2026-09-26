import { Box, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableRow, Typography } from "@mui/material";

import { MEDICATION_EMPTY_STATE, formatDateOnly, medicationManagementHasInformation, normalizeMedicationManagement, objectField } from "../../services/consentManagementLogic";

const mobileCell = {
  display: { xs: "block", sm: "table-cell" },
  width: { xs: "100%", sm: "auto" },
  overflowWrap: "anywhere"
} as const;

export default function MedicationManagementPanel({ value }: { value: unknown }) {
  const normalized = normalizeMedicationManagement(value) ?? {};
  const rows = [
    ["Medicine", objectField(normalized, "medicineName")],
    ["Dosage", objectField(normalized, "dosage")],
    ["Frequency", objectField(normalized, "frequency")],
    ["Method", objectField(normalized, "method")],
    ["Self Administration", objectField(normalized, "selfAdmin")],
    ["Additional Information", objectField(normalized, "otherInfo")],
    ["Quantity Supplied", objectField(normalized, "quantitySupplied")],
    ["Authorised From", formatDateOnly(objectField(normalized, "authFrom"))],
    ["Authorised Until", formatDateOnly(objectField(normalized, "authTo"))],
    ["Doctor", objectField(normalized, "doctorName")],
    ["Doctor Telephone", objectField(normalized, "doctorTel")],
    ["Pharmacy", objectField(normalized, "pharmacyName")],
    ["Pharmacy Telephone", objectField(normalized, "pharmacyTel")],
    ["Scouter 1", objectField(normalized, "scouter1")],
    ["Scouter 2", objectField(normalized, "scouter2")],
    ["Member", objectField(normalized, "memberName")],
    ["Date of Birth", formatDateOnly(objectField(normalized, "dateOfBirth"))],
    ["Address", objectField(normalized, "address")],
    ["Signed By", objectField(normalized, "signature")],
    ["Signature Date", formatDateOnly(objectField(normalized, "signatureDate"))]
  ];

  const hasInformation = medicationManagementHasInformation(value);
  const visibleRows = rows.filter(([, text]) => Boolean(text));

  return <Paper data-testid="medication-management-panel" variant="outlined" sx={{ gridColumn: { xs: "1", md: "1 / -1" }, overflow: "hidden", borderWidth: 2, borderColor: "error.light", minWidth: 0 }}>
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 2, borderBottom: "1px solid", borderColor: "error.light" }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography variant="h5" color="error.main" sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>Medication Management</Typography><Chip label="SIF 20/10" color="error" size="small" /></Stack>
    </Box>
    {!hasInformation ? <Typography role="status" sx={{ p: 3 }}>{MEDICATION_EMPTY_STATE}</Typography> : <TableContainer><Table size="small" sx={{ tableLayout: { sm: "fixed" } }}><TableBody>{visibleRows.map(([label, text]) => <TableRow data-testid="medication-management-row" key={label} sx={{ display: { xs: "block", sm: "table-row" } }}><TableCell sx={{ ...mobileCell, width: { xs: "100%", sm: "38%" }, pb: { xs: .5, sm: 1 }, fontWeight: 700, color: "secondary.main", verticalAlign: "top", borderBottom: { xs: 0, sm: "1px solid" } }}>{label}</TableCell><TableCell sx={{ ...mobileCell, pt: { xs: 0, sm: 1 } }}>{text}</TableCell></TableRow>)}</TableBody></Table></TableContainer>}
  </Paper>;
}
