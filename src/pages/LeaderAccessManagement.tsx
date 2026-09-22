import {
  Alert,
  Box,
  Button,
  Checkbox,
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
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import type { SystemRole } from "../components/admin/AdminAuthProvider";
import { SectionIdentityChip, SectionOptionLabel, SectionSelect, SectionToggleButton, sectionCardSx } from "../components/SectionIdentityControls";
import { loadLeaderAccessRecords, updateLeaderAccess } from "../services/leaderAccess";
import type { LeaderAccessRecord } from "../services/leaderAccess";
import { canonicalOrganisationSection } from "../services/leaderAccessLogic";
import { CANONICAL_SCOUTING_APPOINTMENTS } from "../security/scoutingAppointments";
import { appointmentsActorMayAssign, canChangeSystemRole, canManageSectionScope, canOpenLeaderAccess } from "../security/leaderDelegationPolicy";

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
  if (JSON.stringify(previous.appointments) !== JSON.stringify(next.appointments)) {
    changes.push(`Scouting appointments will change from ${previous.appointments.map((item) => item.appointment).join(", ") || "none"} to ${next.appointments.map((item) => item.appointment).join(", ") || "none"}.`);
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
  }
  return changes;
}

export default function LeaderAccessManagement() {
  const { user, adminProfile } = useAdminAuth();
  const navigate = useNavigate();
  const { leaderUid } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [records, setRecords] = useState<LeaderAccessRecord[]>([]);
  const [baselineByUid, setBaselineByUid] = useState<Record<string, LeaderAccessRecord>>({});
  const [pendingSave, setPendingSave] = useState<{ record: LeaderAccessRecord; changes: string[] } | null>(null);
  const [workingUid, setWorkingUid] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const search = searchParams.get("q") || "";
  const sectionFilter = searchParams.get("section") || "";
  const activeFilter = searchParams.get("active") || "active";

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

  const selectedRecord = leaderUid ? records.find((record) => record.uid === leaderUid) : undefined;
  const filteredRecords = useMemo(() => records.filter((record) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [record.displayName, record.email, ...record.sections, ...record.appointments.map((item) => item.appointment)].some((value) => value.toLowerCase().includes(term));
    const matchesSection = !sectionFilter || record.sections.includes(sectionFilter) || record.organisationSection === sectionFilter;
    const matchesActive = activeFilter === "all" || (activeFilter === "active" ? record.active : !record.active);
    return matchesSearch && matchesSection && matchesActive;
  }).sort((a, b) => a.displayName.localeCompare(b.displayName) || a.uid.localeCompare(b.uid)), [records, search, sectionFilter, activeFilter]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const actor = adminProfile ? { uid: adminProfile.uid, systemRole: adminProfile.role, scoutingAppointment: adminProfile.scoutingRole, scoutingAppointments: adminProfile.appointments } : null;
  if (!actor || !canOpenLeaderAccess(actor)) {
    return <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}><Alert severity="error">Group Leadership or Administrator access is required.</Alert></Container>;
  }
  const isAdminActor = actor.systemRole === "admin" || actor.systemRole === "super-admin";
  const actorEmail = user?.email || adminProfile?.email || "";

  const save = async (record: LeaderAccessRecord) => {
    if (!user) return;
    setWorkingUid(record.uid);
    try {
      setError("");
      setMessage("");
      await updateLeaderAccess(record, user.uid, actorEmail);
      setMessage(`${record.displayName} updated.`);
      await refresh();
      navigate({ pathname: "/leader/access", search: searchParams.toString() ? `?${searchParams.toString()}` : "" });
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Unable to update this leader. Check that your role permits this change.");
    } finally {
      setWorkingUid("");
    }
  };

  const requestSave = (record: LeaderAccessRecord) => {
    if (workingUid === record.uid) return;
    const changes = accessChangeSummary(baselineByUid[record.uid], record);
    if (changes.length === 0) return;
    setPendingSave({ record, changes });
  };

  const confirmSave = () => {
    if (!pendingSave) return;
    const record = pendingSave.record;
    setPendingSave(null);
    void save(record);
  };

  const isDirty = (record: LeaderAccessRecord) => accessChangeSummary(baselineByUid[record.uid], record).length > 0;

  const patch = (uid: string, change: Partial<LeaderAccessRecord>) => setRecords((items) => items.map((item) => item.uid === uid ? { ...item, ...change } : item));
  const toggleSection = (record: LeaderAccessRecord, section: string) => {
    const nextSections = record.sections.includes(section)
      ? record.sections.filter((value) => value !== section)
      : [...record.sections, section];
    patch(record.uid, {
      sections: nextSections,
      organisationSection: canonicalOrganisationSection(nextSections, record.organisationSection)
    });
  };
  const appointmentScope = (record: LeaderAccessRecord) => record.sections.find((section) => section !== "Group") || record.sections[0] || "Group";
  const toggleAppointment = (record: LeaderAccessRecord, appointment: string) => {
    const scope = appointmentScope(record);
    const existing = record.appointments.find((item) => item.appointment === appointment && item.scope === scope);
    const appointments = existing
      ? record.appointments.filter((item) => item.id !== existing.id)
      : [...record.appointments, { id: `${appointment.toLowerCase().replace(/[^a-z0-9]+/g, "-")}--${scope.toLowerCase()}`, appointment: appointment as typeof record.appointments[number]["appointment"], scope, active: true }];
    patch(record.uid, { appointments, scoutingRole: appointments[0]?.appointment || "", organisationSection: scope });
  };

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}><Container maxWidth="xl">
    <LeaderDashboardHeader />
    <LeaderPageHeader title="Leader Access & Organisation" description="Manage permitted leader assignments. System access roles remain Super Admin-only; Group Leadership can delegate ordinary operational appointments and section scope only." actions={<Button variant="outlined" color="secondary" onClick={() => void refresh()}>Refresh</Button>} />
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
    {!leaderUid && <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" }, gap: 2, mb: 2 }}>
        <TextField label="Search leaders" value={search} onChange={(e) => updateFilter("q", e.target.value)} />
        <SectionSelect id="leader-access-section-filter" label="Filter by section" value={sectionFilter} options={["", ...sections]} onChange={(e) => updateFilter("section", e.target.value)} />
        <TextField select label="Status" value={activeFilter} onChange={(e) => updateFilter("active", e.target.value)}><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem><MenuItem value="all">All</MenuItem></TextField>
      </Box>
      <Stack spacing={1.5} data-testid="leader-access-summary-list">
        {filteredRecords.map((record) => <Paper key={record.uid} component="button" type="button" data-testid={`leader-access-tile-${record.uid}`} data-section={record.organisationSection} onClick={() => navigate(`/leader/access/${encodeURIComponent(record.uid)}?${searchParams.toString()}`)} aria-label={`Edit leader access for ${record.displayName}`} variant="outlined" sx={[{ p: 2, borderRadius: 2, width: "100%", textAlign: "left", cursor: "pointer", color: "text.primary", backgroundColor: "background.paper", font: "inherit", "&:focus-visible": { outline: "3px solid", outlineColor: "primary.main", outlineOffset: 2 } }, sectionCardSx(record.organisationSection)]}>
          <Box sx={{ display: "flex", gap: 1.5, justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" }}>
            <Box><Typography variant="h6" sx={{ fontWeight: 700 }}>{record.displayName}</Typography><Typography variant="body2" color="text.secondary">{record.sections.join(", ") || record.organisationSection}</Typography><Typography variant="body2">{record.appointments.map((item) => `${item.appointment} · ${item.scope}`).join(", ") || "Programme Scouter baseline"}</Typography></Box>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}><SectionIdentityChip section={record.organisationSection} /><Chip size="small" label={record.active ? "Active" : "Inactive"} /><Chip size="small" label={record.showPublicly ? "Public" : "Not public"} /></Stack>
          </Box>
        </Paper>)}
        {filteredRecords.length === 0 && <Alert severity="info">No authorised leaders match these filters.</Alert>}
      </Stack>
    </>}
    {leaderUid && !selectedRecord && records.length > 0 && <Alert severity="warning" action={<Button onClick={() => navigate("/leader/access")}>Back to leaders</Button>}>Leader record not found or is not available to you.</Alert>}
    {selectedRecord && <>
      <Button sx={{ mb: 2 }} onClick={() => navigate({ pathname: "/leader/access", search: searchParams.toString() ? `?${searchParams.toString()}` : "" })}>Back to leaders</Button>
      <Stack spacing={2}>
      {[selectedRecord].map((record) => <Paper key={record.uid} data-testid={`leader-access-${record.uid}`} data-section={record.organisationSection} variant="outlined" sx={[{ p: { xs: 2, md: 3 }, borderRadius: 2 }, sectionCardSx(record.organisationSection)]}>
        <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between" }}>
          <Box><Typography variant="h6" sx={{ fontWeight: 700 }}>{record.displayName}</Typography><Typography color="text.secondary">{record.email}</Typography></Box>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}><SectionIdentityChip section={record.organisationSection} /><Chip label={record.role} /></Stack>
        </Box>
        <Box sx={{ display: "flex", gap: 2, flexDirection: { xs: "column", sm: "row" }, flexWrap: "wrap", mt: 2 }}>
          <Select size="small" value={record.role} disabled={!canChangeSystemRole(actor, { uid: record.uid, systemRole: record.role, scoutingAppointment: record.scoutingRole })} onChange={(e) => patch(record.uid, { role: e.target.value as SystemRole })} sx={{ minWidth: 180 }}><MenuItem value="leader">Leader</MenuItem><MenuItem value="admin">Admin</MenuItem>{record.role === "super-admin" && <MenuItem value="super-admin">Super Admin</MenuItem>}</Select>
          <FormControlLabel control={<Switch checked={record.active} disabled={!isAdminActor || record.role === "super-admin"} onChange={(e) => patch(record.uid, { active: e.target.checked })} />} label="Active" />
        </Box>
        {record.role === "leader" && <Box sx={{ mt: 2 }}><Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>Account sections</Typography><Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(6, 1fr)" }, gap: 1 }}>{sections.map((section) => <SectionToggleButton key={section} section={section} selected={record.sections.includes(section)} size="small" disabled={!canManageSectionScope(actor, { uid: record.uid, systemRole: record.role, scoutingAppointment: record.scoutingRole })} onClick={() => toggleSection(record, section)}>{section}</SectionToggleButton>)}</Box></Box>}
        <Typography variant="h6" color="secondary" sx={{ mt: 3, mb: 1.5 }}>Organisational chart</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr 2fr" }, gap: 2 }}>
          <Box sx={{ gridColumn: { md: "span 1" } }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 700 }}>Scouting appointments</Typography>
            <Typography variant="caption" color="text.secondary">Active Leaders include the Programme Scouter baseline. Appointment scope follows the leader&apos;s Account sections.</Typography>
            <Stack role="group" aria-label={`Scouting appointments for ${record.displayName}`} sx={{ mt: 1, maxHeight: 260, overflowY: "auto" }}>
              {CANONICAL_SCOUTING_APPOINTMENTS.filter((appointment) => appointmentsActorMayAssign(actor).includes(appointment) || record.appointments.some((item) => item.appointment === appointment)).map((appointment) => {
                const selected = record.appointments.some((item) => item.appointment === appointment && item.scope === appointmentScope(record));
                return <FormControlLabel key={appointment} control={<Checkbox checked={selected} disabled={record.role !== "leader" || record.uid === actor.uid} onChange={() => toggleAppointment(record, appointment)} />} label={appointment} />;
              })}
            </Stack>
          </Box>
          <TextField disabled={!isAdminActor} label="Display order" type="number" value={record.organisationOrder} onChange={(e) => patch(record.uid, { organisationOrder: Number(e.target.value) || 0 })} slotProps={{ htmlInput: { min: 0, max: 999 } }} />
          <TextField select disabled={!isAdminActor} label="Reports to" value={record.reportsToUid} onChange={(e) => patch(record.uid, { reportsToUid: e.target.value })}><MenuItem value="">Top level / none</MenuItem>{records.filter((leader) => leader.uid !== record.uid && leader.active).map((leader) => <MenuItem key={leader.uid} value={leader.uid}><SectionOptionLabel section={leader.organisationSection} label={<>{leader.displayName} · {leader.scoutingRole || "Leader"}</>} /></MenuItem>)}</TextField>
        </Box>
        <FormControlLabel
          sx={{ alignItems: "flex-start", mt: 2 }}
          control={<Switch checked={record.showPublicly} disabled={!isAdminActor} onChange={(e) => patch(record.uid, { showPublicly: e.target.checked })} />}
          label={<Box><Typography sx={{ fontWeight: 700 }}>Show on public Who's Who</Typography><Typography variant="body2" color="text.secondary">Publishes name, scouting role, section and hierarchy only. Email, phone and account role remain private.</Typography></Box>}
        />
        <Button variant="contained" color="secondary" sx={{ mt: 2 }} disabled={workingUid === record.uid || !isDirty(record)} onClick={() => requestSave(record)}>{workingUid === record.uid ? "Saving…" : "Save Leader"}</Button>
      </Paper>)}
      </Stack>
    </>}
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
