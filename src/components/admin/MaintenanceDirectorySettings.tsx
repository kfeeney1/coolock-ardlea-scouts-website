import { Alert, Button, Paper, Stack, Typography } from "@mui/material";
import { useRef, useState } from "react";
import { auth, db } from "../../firebase";
import { applicationErrorMessage } from "../../services/applicationErrors";
import { rebuildMaintenanceDirectory } from "../../services/maintenanceDirectoryStore";

export default function MaintenanceDirectorySettings({ canRefresh }: { canRefresh: boolean }) {
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    const uid = auth.currentUser?.uid;
    if (!canRefresh || !uid || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const count = await rebuildMaintenanceDirectory(db, uid);
      setMessage(`Responsible leader directory refreshed: ${count} eligible leaders.`);
    } catch (failure) {
      setError(applicationErrorMessage(failure, "Unable to refresh responsible leaders.", "MaintenanceDirectorySettings"));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <Paper component="section" aria-labelledby="maintenance-directory-heading" aria-busy={saving}
      variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, maxWidth: 760, my: 3 }}>
      <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
        <Typography id="maintenance-directory-heading" component="h2" variant="h5" color="secondary" sx={{ fontWeight: 800 }}>
          Maintenance directory
        </Typography>
        {canRefresh && (
          <Button variant="outlined" disabled={saving} sx={{ minHeight: 44 }} onClick={() => void refresh()}>
            {saving ? "Refreshing responsible leaders…" : "Refresh responsible leaders"}
          </Button>
        )}
        {message && <Alert severity="success" role="status">{message}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </Paper>
  );
}
