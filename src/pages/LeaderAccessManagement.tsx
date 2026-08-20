import { Alert, Box, Button, Checkbox, Chip, Container, FormControlLabel, MenuItem, Paper, Select, Stack, Switch, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import type { SystemRole } from "../components/admin/AdminAuthProvider";
import { loadLeaderAccessRecords, updateLeaderAccess } from "../services/leaderAccess";
import type { LeaderAccessRecord } from "../services/leaderAccess";

const sections = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group"];

export default function LeaderAccessManagement() {
  const { user, adminProfile } = useAdminAuth();
  const [records, setRecords] = useState<LeaderAccessRecord[]>([]);
  const [error, setError] = useState("");
  const refresh = async () => { try { setRecords(await loadLeaderAccessRecords()); } catch (e) { console.error(e); setError("Unable to load leader access records."); } };
  useEffect(() => { void refresh(); }, []);
  if (!adminProfile || !["admin", "super-admin"].includes(adminProfile.role)) return <Container sx={{ py: 6 }}><Alert severity="error">Administrator access is required.</Alert></Container>;

  const save = async (record: LeaderAccessRecord) => {
    if (!user) return;
    try { await updateLeaderAccess(record.uid, record.role, record.sections, record.active, user.uid); await refresh(); }
    catch (e) { console.error(e); setError("Unable to update this leader. Check that your role permits this change."); }
  };
  const patch = (uid: string, change: Partial<LeaderAccessRecord>) => setRecords((items) => items.map((item) => item.uid === uid ? { ...item, ...change } : item));

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}><Container maxWidth="lg"><LeaderDashboardHeader />
    <Typography variant="h4" color="secondary" sx={{ fontWeight: 800, mb: 1 }}>Leader Access</Typography>
    <Typography color="text.secondary" sx={{ mb: 3 }}>Admins manage leader section assignments. Only a Super Admin can grant or remove Admin access.</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Stack spacing={2}>{records.map((record) => <Paper key={record.uid} variant="outlined" sx={{ p: 2.5 }}>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "space-between" }}><Box><Typography variant="h6" sx={{ fontWeight: 700 }}>{record.displayName}</Typography><Typography color="text.secondary">{record.email}</Typography></Box><Chip label={record.role} color={record.role === "super-admin" ? "error" : record.role === "admin" ? "warning" : "default"} /></Box>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center", mt: 2 }}>
        <Select size="small" value={record.role} disabled={adminProfile.role !== "super-admin" || record.role === "super-admin"} onChange={(e) => patch(record.uid, { role: e.target.value as SystemRole })}><MenuItem value="leader">Leader</MenuItem><MenuItem value="admin">Admin</MenuItem>{record.role === "super-admin" && <MenuItem value="super-admin">Super Admin</MenuItem>}</Select>
        <FormControlLabel control={<Switch checked={record.active} disabled={record.role === "super-admin"} onChange={(e) => patch(record.uid, { active: e.target.checked })} />} label="Active" />
      </Box>
      {record.role === "leader" && <Box sx={{ mt: 1 }}>{sections.map((section) => <FormControlLabel key={section} control={<Checkbox checked={record.sections.includes(section)} onChange={(e) => patch(record.uid, { sections: e.target.checked ? [...record.sections, section] : record.sections.filter((s) => s !== section) })} />} label={section} />)}</Box>}
      <Button variant="contained" color="secondary" sx={{ mt: 2 }} disabled={record.role === "super-admin"} onClick={() => void save(record)}>Save Access</Button>
    </Paper>)}</Stack>
  </Container></Box>;
}
