import { Alert, Box, Button, Chip, Container, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import OperationalSearchField from "../components/admin/OperationalSearchField";
import { OperationalEmptyState, OperationalLoading } from "../components/admin/OperationalStates";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { loadAuditLog, type AuditLogEntry } from "../services/auditLog";

function formatDate(value: Date | null) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function auditDescription(entry: AuditLogEntry) {
  if (entry.category === "system" && entry.action === "meeting-record-update") {
    return "Updated meeting record; previous version retained.";
  }
  return entry.description;
}

export default function ActivityLog() {
  const { adminProfile } = useAdminAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
  const isGroupOfficer = adminProfile?.scoutingRole === "Group Leader" || adminProfile?.scoutingRole === "Group Secretary";
  const canViewActivityLog = isAdmin || isGroupOfficer;

  const refresh = async () => {
    if (!canViewActivityLog) return;
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

  useEffect(() => { void refresh(); }, [canViewActivityLog]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) => [entry.category, entry.action, entry.actorEmail, entry.targetLabel, auditDescription(entry), entry.section].join(" ").toLowerCase().includes(q));
  }, [entries, search]);

  if (!canViewActivityLog) {
    return <Container maxWidth="md" sx={{ py: 6 }}><Alert severity="error">Admin, Group Leader or Group Secretary access is required to view the Activity Log.</Alert></Container>;
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
          <OperationalSearchField
            label="Search activity"
            value={search}
            onChange={setSearch}
            placeholder="Search actions, people, sections or targets"
            testId="activity-log-search"
          />
        </Paper>

        {loading ? (
          <OperationalLoading minHeight={260} label="Loading activity log" />
        ) : (
          <Stack spacing={1.5} data-testid="activity-log-list">
            {visible.length === 0 && <OperationalEmptyState>No activity matches the current search.</OperationalEmptyState>}
            {visible.map((entry) => (
              <Paper key={entry.id} variant="outlined" sx={{ p: 2.25 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center", mb: 0.75 }}>
                      <Chip size="small" label={entry.category} variant="outlined" />
                      <Typography sx={{ fontWeight: 800 }}>{entry.action}</Typography>
                    </Stack>
                    <Typography>{auditDescription(entry)}</Typography>
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
