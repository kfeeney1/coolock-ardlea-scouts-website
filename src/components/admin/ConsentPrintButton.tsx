import { Alert, Button, Stack } from "@mui/material";
import { useState } from "react";
import { useAdminAuth } from "./AdminAuthProvider";
import { canPrintYouthConsent } from "../../security/consentPrintAccess";
import { loadConsentPrint } from "../../services/consentPrint";
import { recordAuditEvent } from "../../services/auditLog";
import { applicationErrorMessage } from "../../services/applicationErrors";

export default function ConsentPrintButton({ id, section }: { id: string; section: string }) {
  const { adminProfile } = useAdminAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!canPrintYouthConsent(adminProfile, section)) return null;

  async function openPrintView() {
    setError("");
    const popup = window.open("", "_blank", "width=1000,height=800");
    if (!popup) {
      setError("Allow pop-ups for this site to open the print view.");
      return;
    }
    popup.opener = null;
    setBusy(true);
    try {
      const { html, section: verifiedSection } = await loadConsentPrint(id);
      if (popup.closed) return;
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      void recordAuditEvent({
        category: "system", action: "Consent print view opened", targetId: id, targetLabel: "Youth consent",
        description: "Opened the authorised individual youth consent print view.", section: verifiedSection
      });
    } catch (failure) {
      popup.close();
      setError(applicationErrorMessage(failure, "Unable to open the consent print view.", "ConsentPrintButton"));
    } finally {
      setBusy(false);
    }
  }

  return <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
    <Button variant="outlined" disabled={busy} onClick={() => void openPrintView()}>Print / Save PDF</Button>
    {error && <Alert severity="error">{error}</Alert>}
  </Stack>;
}
