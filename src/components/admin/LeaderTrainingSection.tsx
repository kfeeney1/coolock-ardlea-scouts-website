import { Alert, Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useAdminAuth } from "./AdminAuthProvider";
import { canManageOperationalAssignments } from "../../security/leaderDelegationPolicy";
import type { SystemRole } from "./AdminAuthProvider";
import { watchLeaderTrainingExperience } from "../../services/leaderTrainingExperienceSettings";
import { loadLeaderTraining } from "../../services/leaderTraining";
import { trainingCategories, trainingLabels, trainingStatus, type TrainingCategory, type LeaderTrainingRecord } from "../../services/leaderTrainingLogic";
import { formatDateRangeInput } from "../../services/dateRangeLogic";
import { groupLocalDate } from "../../services/groupLocalDate";
import LeaderTrainingEditor from "./LeaderTrainingEditor";

export default function LeaderTrainingSection({ leaderUid, targetRole, readOnly = false }: { leaderUid: string; targetRole: SystemRole; readOnly?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setEnabled(false); setError(false); return watchLeaderTrainingExperience(version => setEnabled(version === "redesigned"), () => { setEnabled(false); setError(true); }); }, [attempt]);
  if (error) return <Alert severity="error" action={<Button sx={{ minHeight: 44 }} onClick={() => setAttempt(value => value + 1)}>Retry</Button>}>Unable to check training availability.</Alert>;
  return enabled ? <TrainingRecords key={leaderUid} leaderUid={leaderUid} targetRole={targetRole} readOnly={readOnly} /> : null;
}

function TrainingRecords({ leaderUid, targetRole, readOnly }: { leaderUid: string; targetRole: SystemRole; readOnly: boolean }) {
  const { adminProfile } = useAdminAuth();
  const [records, setRecords] = useState<Partial<Record<TrainingCategory, LeaderTrainingRecord>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<{ category: TrainingCategory; renewal: boolean } | null>(null);
  useEffect(() => {
    let active = true; setLoading(true); setError(false); setRecords({});
    void loadLeaderTraining(leaderUid).then(data => { if (active) setRecords(data); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [leaderUid, revision]);
  useEffect(() => {
    if (!loading && !error && /^#training-(garda-vetting|first-aid|child-protection)$/.test(window.location.hash)) document.getElementById(window.location.hash.slice(1))?.focus();
  }, [loading, error]);
  const actor = adminProfile ? { uid: adminProfile.uid, systemRole: adminProfile.role, scoutingAppointment: adminProfile.scoutingRole, scoutingAppointments: adminProfile.appointments } : null;
  const editable = !readOnly && Boolean(actor && (actor.systemRole === "admin" || actor.systemRole === "super-admin" || canManageOperationalAssignments(actor, { uid: leaderUid, systemRole: targetRole })));
  const today = groupLocalDate();
  return <Box component="section" aria-labelledby="leader-training-title" sx={{ mt: 3 }}>
    <Typography id="leader-training-title" component="h2" variant="h5" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Training &amp; vetting</Typography>
    {message && <Alert severity="success" role="status" sx={{ mb: 2 }}>{message}</Alert>}
    {loading ? <Typography role="status">Loading training records…</Typography> : error ? <Alert severity="error" action={<Button sx={{ minHeight: 44 }} onClick={() => setRevision(value => value + 1)}>Retry</Button>}>Unable to load training records. Retry to reconnect.</Alert> : <>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
        {trainingCategories.map(category => {
          const record = records[category], status = trainingStatus(record, today);
          return <Paper component="article" id={`training-${category}`} tabIndex={-1} key={category} variant="outlined" aria-label={trainingLabels[category]} sx={{ p: 2, borderRadius: 2, scrollMarginTop: 100, "&:focus-visible": { outline: "3px solid", outlineColor: "secondary.main", outlineOffset: 2 }, borderTop: 4, borderTopColor: "secondary.main" }}>
            <Typography component="h3" variant="h6">{trainingLabels[category]}</Typography><Chip label={status} color={status === "Expired" ? "error" : "default"} size="small" sx={{ my: 1 }} />
            <Box component="dl" sx={{ my: 1 }}><Typography component="dt" color="text.secondary">Completion / issue date</Typography><Typography component="dd" sx={{ ml: 0, mb: 1 }}>{record?.completedDate ? formatDateRangeInput(record.completedDate) : "Not recorded"}</Typography><Typography component="dt" color="text.secondary">Expiry / lapse date</Typography><Typography component="dd" sx={{ ml: 0 }}>{record?.expiryDate ? formatDateRangeInput(record.expiryDate) : "Not recorded"}</Typography></Box>
            <Typography variant="body2">{record?.showOnCalendar ? "Renewal shown on group calendar" : "Renewal not shown on group calendar"}</Typography>
            {editable && <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", mt: 2 }}><Button disabled={Boolean(editing)} color="secondary" sx={{ minHeight: 44 }} onClick={() => { setMessage(""); setEditing({ category, renewal: false }); }}>{record ? "Edit record" : "Add dates"}</Button>{record && <Button disabled={Boolean(editing)} color="secondary" sx={{ minHeight: 44 }} onClick={() => { setMessage(""); setEditing({ category, renewal: true }); }}>Record renewal</Button>}</Stack>}
          </Paper>;
        })}
      </Box>
      {editing && editable && <LeaderTrainingEditor key={editing.category} leaderUid={leaderUid} category={editing.category} initial={records[editing.category]} renewal={editing.renewal} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setMessage("Training record saved."); setRevision(value => value + 1); }} />}
    </>}
  </Box>;
}
