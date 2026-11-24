import { Alert, Button, Stack } from "@mui/material";
import { useState } from "react";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { recordAuditEvent } from "../../services/auditLog";
import { downloadCsv } from "../../services/downloadCsv";
import { loadGuardianContactExport } from "../../services/guardianContactExport";

export default function GuardianContactExportButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function exportContacts() {
    setBusy(true);
    setError("");
    try {
      const { csv, count, scope } = await loadGuardianContactExport();
      downloadCsv(`member-report-${new Date().toISOString().slice(0, 10)}.csv`, csv);
      void recordAuditEvent({
        category: "system", action: "Member report exported", targetId: "member-report", targetLabel: "Member report",
        description: `Exported ${count} member rows with approved guardian contact fields.`, section: scope
      });
    } catch (failure) {
      setError(applicationErrorMessage(failure, "Unable to export guardian contacts.", "GuardianContactExportButton"));
    } finally {
      setBusy(false);
    }
  }

  return <Stack spacing={1} alignItems="flex-start">
    <Button variant="outlined" disabled={busy} onClick={() => void exportContacts()}>
      {busy ? "Exporting…" : "Export Member CSV"}
    </Button>
    {error && <Alert severity="error">{error}</Alert>}
  </Stack>;
}
