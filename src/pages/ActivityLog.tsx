import { Alert, Box, Button, Chip, CircularProgress, Container, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { loadAuditLog, type AuditLogEntry } from "../services/auditLog";

function formatDate(value: Date | null) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

export default function ActivityLog() {
  const { adminProfile } = useAdminAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";

  const refresh = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    try {
      setEntries(await loadAuditLog());
    } catch (err) {
      console.error(err);
      setError("Unable to load the activity log.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [isAdmin]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => [entry.category, entry.action, entry.actorEmail, entry.targetLabel, entry.description, entry.section].join(" ").toLowerCase().includes(q));
  }, [entries, search]);

  if (!isAdmin) {
    return <Container maxWidth="md" sx={{ py: 6 }}><Alert severity="error">Administrator access is required to view the Activity Log.</Alert></Container>;
  }

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
      <Container maxWidth="xl">
        <LeaderDashboardHeader />
        <LeaderPageHeader
          title="Activity Log"
          description="Read-only history of important administrative and leader actions. Entries cannot be edited or deleted from the website."
          actions={<Button variant="outlined" color="secondary" onClick={() => void refresh()}>Refresh</Button>}
        />

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <TextField fullWidth label="Search activity" value={search} onChange={(event) => setSearch(event.target.value)} />
        </Paper>

        {loading ? (
          <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}><CircularProgress color="secondary" /></Box>
        ) : (
          <Stack spacing={1.5} data-testid="activity-log-list">
            {visible.length === 0 && <Alert severity="info">No activity has been recorded yet.</Alert>}
            {visible.map((entry) => (
              <Paper key={entry.id} variant="outlined" sx={{ p: 2.25 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center", mb: 0.75 }}>
                      <Chip size="small" label={entry.category} variant="outlined" />
                      <Typography sx={{ fontWeight: 800 }}>{entry.action}</Typography>
                    </Stack>
                    <Typography>{entry.description}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                      {entry.targetLabel || entry.targetId}{entry.section ? ` · ${entry.section}` : ""}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: { xs: "left", sm: "right" } }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{entry.actorEmail || entry.actorUid}</Typography>
                    <Typography variant="body2" color="text.secondary">{formatDate(entry.createdAt)}</Typography>
                  </Box>
                </Box>
              </Paper>
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  );
}
