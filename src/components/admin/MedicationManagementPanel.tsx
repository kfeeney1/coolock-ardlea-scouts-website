import { Box, Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableRow, Typography } from "@mui/material";

import { formatDateOnly, objectField } from "../../services/consentManagementLogic";

const mobileCell = {
  display: { xs: "block", sm: "table-cell" },
  width: { xs: "100%", sm: "auto" },
  overflowWrap: "anywhere"
} as const;

export default function MedicationManagementPanel({ value }: { value: Record<string, unknown> }) {
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

  return <Paper data-testid="medication-management-panel" variant="outlined" sx={{ gridColumn: { xs: "1", md: "1 / -1" }, overflow: "hidden", borderWidth: 2, borderColor: "error.light", minWidth: 0 }}>
    <Box sx={{ px: { xs: 2, sm: 3 }, py: 2, borderBottom: "1px solid", borderColor: "error.light" }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography variant="h5" color="error.main" sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>Medication Management</Typography><Chip label="SIF 20/10" color="error" size="small" /></Stack>
    </Box>
    <TableContainer><Table size="small" sx={{ tableLayout: { sm: "fixed" } }}><TableBody>{rows.map(([label, text]) => <TableRow data-testid="medication-management-row" key={label} sx={{ display: { xs: "block", sm: "table-row" } }}><TableCell sx={{ ...mobileCell, width: { xs: "100%", sm: "38%" }, pb: { xs: .5, sm: 1 }, fontWeight: 700, color: "secondary.main", verticalAlign: "top", borderBottom: { xs: 0, sm: "1px solid" } }}>{label}</TableCell><TableCell sx={{ ...mobileCell, pt: { xs: 0, sm: 1 } }}>{text || "Not provided"}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
  </Paper>;
}
