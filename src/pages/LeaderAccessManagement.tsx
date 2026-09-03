import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import type { SystemRole } from "../components/admin/AdminAuthProvider";
import { loadLeaderAccessRecords, updateLeaderAccess } from "../services/leaderAccess";
import type { LeaderAccessRecord } from "../services/leaderAccess";
import { recordAuditEvent } from "../services/auditLog";

const sections = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group"];

function sortedSections(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function accessChangeSummary(previous: LeaderAccessRecord | undefined, next: LeaderAccessRecord) {
  if (!previous) return [];
  const changes: string[] = [];
  if (previous.role !== next.role) {
    changes.push(`System role will change from ${previous.role} to ${next.role}.`);
  }
  if (previous.active !== next.active) {
    changes.push(next.active ? "Account access will be re-enabled." : "Account access will be disabled.");
  }
  if (JSON.stringify(sortedSections(previous.sections)) !== JSON.stringify(sortedSections(next.sections))) {
    changes.push(`Permitted account sections will change from ${previous.sections.join(", ")} to ${next.sections.join(", ")}.`);
  }
  if (previous.showPublicly !== next.showPublicly) {
    changes.push(next.showPublicly
      ? "Name, scouting role, section and hierarchy will be published on the public Who's Who."
      : "The leader will be removed from the public Who's Who.");
  } else if (previous.role === "leader" && previous.showPublicly && next.role !== "leader") {
    changes.push("The public Who's Who listing will be removed because the account is no longer a Leader role.");
  }
  return changes;
}

export default function LeaderAccessManagement() {
  const { user, adminProfile } = useAdminAuth();
  const [records, setRecords] = useState<LeaderAccessRecord[]>([]);
  const [baselineByUid, setBaselineByUid] = useState<Record<string, LeaderAccessRecord>>({});
  const [pendingSave, setPendingSave] = useState<{ record: LeaderAccessRecord; changes: string[] } | null>(null);
  const [workingUid, setWorkingUid] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = async () => {
    try {
      const loaded = await loadLeaderAccessRecords();
      setRecords(loaded);
      setBaselineByUid(Object.fromEntries(loaded.map((record) => [record.uid, record])));
      setError("");
    } catch (e) {
      console.error(e);
      setError("Unable to load leader access records.");
    }
  };
  useEffect(() => { void refresh(); }, []);

  if (!adminProfile || !["admin", "super-admin"].includes(adminProfile.role)) {
    return <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}><Alert severity="error">Administrator access is required.</Alert></Container>;
  }

  const save = async (record: LeaderAccessRecord) => {
    if (!user) return;
    setWorkingUid(record.uid);
    try {
      setError("");
      setMessage("");
      await updateLeaderAccess(record, user.uid);
      await recordAuditEvent({ category: "leader-access", action: "Leader access and organisation updated", targetId: record.uid, targetLabel: record.displayName || record.email, section: record.organisationSection, description: `Saved system role ${record.role}; scouting role ${record.scoutingRole || "Leader"}; organisation section ${record.organisationSection}; public listing ${record.showPublicly ? "enabled" : "disabled"}.` });
      setMessage(`${record.displayName} updated.`);
      await refresh();
    } catch (e) {
      console.error(e);
      setError("Unable to update this leader. Check that your role permits this change.");
    } finally {
      setWorkingUid("");
    }
  };

  const requestSave = (record: LeaderAccessRecord) => {
    const changes = accessChangeSummary(baselineByUid[record.uid], record);
    if (changes.length > 0) {
      setPendingSave({ record, changes });
      return;
    }
    void save(record);
  };

  const confirmSave = () => {
    if (!pendingSave) return;
    const record = pendingSave.record;
    setPendingSave(null);
    void save(record);
  };

  const patch = (uid: string, change: Partial<LeaderAccessRecord>) => setRecords((items) => items.map((item) => item.uid === uid ? { ...item, ...change } : item));
  const toggleSection = (record: LeaderAccessRecord, section: string) => patch(record.uid, { sections: record.sections.includes(section) ? record.sections.filter((value) => value !== section) : [...record.sections, section] });

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}><Container maxWidth="xl">
    <LeaderDashboardHeader />
    <LeaderPageHeader title="Leader Access & Organisation" description="Manage account access and each leader's place in the scouting hierarchy. Only a Super Admin can grant or remove Admin access. Public Who's Who publication is opt-in." actions={<Button variant="outlined" color="secondary" onClick={() => void refresh()}>Refresh</Button>} />
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
    <Stack spacing={2}>
      {records.map((record) => <Paper key={record.uid} data-testid={`leader-access-${record.uid}`} variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between" }}>
          <Box><Typography variant="h6" sx={{ fontWeight: 700 }}>{record.displayName}</Typography><Typography color="text.secondary">{record.email}</Typography></Box>
          <Chip label={record.role} />
        </Box>
        <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" }, flexWrap: "wrap", mt: 2 }}>
          <Select size="small" value={record.role} disabled={adminProfile.role !== "super-admin" || record.role === "super-admin"} onChange={(e) => patch(record.uid, { role: e.target.value as SystemRole })} sx={{ minWidth: 180 }}><MenuItem value="leader">Leader</MenuItem><MenuItem value="admin">Admin</MenuItem>{record.role === "super-admin" && <MenuItem value="super-admin">Super Admin</MenuItem>}</Select>
          <FormControlLabel control={<Switch checked={record.active} disabled={record.role === "super-admin"} onChange={(e) => patch(record.uid, { active: e.target.checked })} />} label="Active" />
        </Box>
        {record.role === "leader" && <Box sx={{ mt: 2 }}><Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Account sections</Typography><Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(6, 1fr)" }, gap: 1 }}>{sections.map((section) => <Button key={section} variant={record.sections.includes(section) ? "contained" : "outlined"} color="secondary" size="small" onClick={() => toggleSection(record, section)}>{section}</Button>)}</Box></Box>}
        <Typography variant="h6" color="secondary" sx={{ mt: 3, mb: 1.5 }}>Organisational chart</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr 2fr" }, gap: 2 }}>
          <TextField label="Scouting role / title" value={record.scoutingRole} onChange={(e) => patch(record.uid, { scoutingRole: e.target.value })} placeholder="e.g. Cub Section Leader" />
          <TextField select label="Organisation section" value={record.organisationSection} onChange={(e) => patch(record.uid, { organisationSection: e.target.value })}>{sections.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}</TextField>
          <TextField label="Display order" type="number" value={record.organisationOrder} onChange={(e) => patch(record.uid, { organisationOrder: Number(e.target.value) || 0 })} slotProps={{ htmlInput: { min: 0, max: 999 } }} />
          <TextField select label="Reports to" value={record.reportsToUid} onChange={(e) => patch(record.uid, { reportsToUid: e.target.value })}><MenuItem value="">Top level / none</MenuItem>{records.filter((leader) => leader.uid !== record.uid && leader.active).map((leader) => <MenuItem key={leader.uid} value={leader.uid}>{leader.displayName} · {leader.scoutingRole || "Leader"}</MenuItem>)}</TextField>
        </Box>
        <FormControlLabel
          sx={{ alignItems: "flex-start", mt: 2 }}
          control={<Switch checked={record.showPublicly} onChange={(e) => patch(record.uid, { showPublicly: e.target.checked })} />}
          label={<Box><Typography sx={{ fontWeight: 700 }}>Show on public Who's Who</Typography><Typography variant="body2" color="text.secondary">Publishes name, scouting role, section and hierarchy only. Email, phone and account role remain private.</Typography></Box>}
        />
        <Button variant="contained" color="secondary" sx={{ mt: 2 }} disabled={workingUid === record.uid} onClick={() => requestSave(record)}>Save Leader</Button>
      </Paper>)}
    </Stack>
  </Container>

  <Dialog
    open={Boolean(pendingSave)}
    onClose={() => setPendingSave(null)}
    aria-labelledby="leader-access-confirm-title"
    aria-describedby="leader-access-confirm-description"
  >
    <DialogTitle id="leader-access-confirm-title">Confirm leader access changes?</DialogTitle>
    <DialogContent>
      <DialogContentText id="leader-access-confirm-description">
        Review the access or public-visibility changes for {pendingSave?.record.displayName || pendingSave?.record.email} before saving.
      </DialogContentText>
      <Box component="ul" sx={{ pl: 3, mb: 0 }}>
        {pendingSave?.changes.map((change) => <Typography component="li" key={change} sx={{ mt: 1 }}>{change}</Typography>)}
      </Box>
    </DialogContent>
    <DialogActions>
      <Button onClick={() => setPendingSave(null)}>Cancel</Button>
      <Button color="error" variant="contained" onClick={confirmSave}>Confirm Changes</Button>
    </DialogActions>
  </Dialog>
  </Box>;
}
