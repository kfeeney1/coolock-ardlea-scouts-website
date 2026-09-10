import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { isGroupLeadershipAppointment } from "../../security/scoutingAppointments";
import { loadMembers, type MemberRecord } from "../../services/memberAdmin";
import { loadSubsAssignments, loadSubsPolicies, saveSubsPolicy } from "../../services/subsLedger";
import { AGREED_SUBS_2026_27, parseEuroToCents, type SubsAssignment, type SubsRatePolicy } from "../../services/subsLogic";
import { useAdminAuth } from "./AdminAuthProvider";
import SubsFamilyAccountPanel from "./SubsFamilyAccountPanel";

const euroValue = (cents: number) => (cents / 100).toFixed(2);

export default function SubsSettingsPanel() {
  const { adminProfile } = useAdminAuth();
  const canManage = adminProfile?.role === "admin"
    || adminProfile?.role === "super-admin"
    || adminProfile?.scoutingRole === "Group Treasurer"
    || isGroupLeadershipAppointment(adminProfile?.scoutingRole);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [policies, setPolicies] = useState<SubsRatePolicy[]>([]);
  const [assignments, setAssignments] = useState<SubsAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [period, setPeriod] = useState(AGREED_SUBS_2026_27.period);
  const [periodStart, setPeriodStart] = useState(AGREED_SUBS_2026_27.periodStart);
  const [periodEnd, setPeriodEnd] = useState(AGREED_SUBS_2026_27.periodEnd);
  const [version, setVersion] = useState("1");
  const [standardRates, setStandardRates] = useState(AGREED_SUBS_2026_27.standardFamilyRatesCents.map(euroValue));
  const [leaderRates, setLeaderRates] = useState(AGREED_SUBS_2026_27.leaderFamilyRatesCents.map(euroValue));

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError("");
    try {
      const [memberRows, policyRows, assignmentRows] = await Promise.all([loadMembers(), loadSubsPolicies(), loadSubsAssignments()]);
      setMembers(memberRows.filter((member) => member.status === "active"));
      setPolicies(policyRows);
      setAssignments(assignmentRows);
    } catch (loadError) {
      console.error("Unable to load subs settings:", loadError);
      setError("Unable to load subs rates and classifications.");
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => { void load(); }, [load]);

  const setRate = (type: "standard" | "leader", index: number, value: string) => {
    const setter = type === "standard" ? setStandardRates : setLeaderRates;
    setter((current) => current.map((entry, currentIndex) => currentIndex === index ? value : entry));
    setMessage(""); setError("");
  };
  const addRate = (type: "standard" | "leader") => {
    const setter = type === "standard" ? setStandardRates : setLeaderRates;
    setter((current) => [...current, ""]); setMessage(""); setError("");
  };
  const removeLastRate = (type: "standard" | "leader") => {
    const setter = type === "standard" ? setStandardRates : setLeaderRates;
    setter((current) => current.length > 1 ? current.slice(0, -1) : current); setMessage(""); setError("");
  };
  const savePolicy = async () => {
    setSaving(true); setMessage(""); setError("");
    try {
      const standardFamilyRatesCents = standardRates.map(parseEuroToCents);
      const leaderFamilyRatesCents = leaderRates.map(parseEuroToCents);
      const siblingCents = standardFamilyRatesCents.length > 1 ? standardFamilyRatesCents[1] - standardFamilyRatesCents[0] : standardFamilyRatesCents[0];
      await saveSubsPolicy({
        period, effectiveFrom: periodStart, periodStart, periodEnd, version: Number(version),
        standardFamilyRatesCents, leaderFamilyRatesCents,
        standardCents: standardFamilyRatesCents[0], leaderChildCents: leaderFamilyRatesCents[0], siblingCents
      });
      setMessage(`Subs policy ${period} saved. The period runs ${periodStart} to ${periodEnd}.`);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save subs policy.");
    } finally { setSaving(false); }
  };

  if (!canManage) return null;
  return <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mt: 3 }} data-testid="subs-settings-panel">
    <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Subs rates &amp; classification</Typography>
    <Typography color="text.secondary" sx={{ mt: 0.75 }}>Configure Scout-year family rates and create one billing account for each family. Access is restricted to the Treasurer, Group Leader, Deputy Group Leader and admins.</Typography>
    {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>Rate policy</Typography>
      <Alert severity="info" sx={{ mt: 1.5, mb: 2 }}>2026/27 is prefilled with the agreed rates. The Scout subs year runs from September through June. Policies are immutable once saved; a correction is made by creating a later version.</Alert>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
        <TextField label="Scout year" value={period} onChange={(event) => setPeriod(event.target.value)} />
        <TextField type="date" label="Starts" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField type="date" label="Ends" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField type="number" label="Policy version" value={version} onChange={(event) => setVersion(event.target.value)} slotProps={{ htmlInput: { min: 1, step: 1 } }} />
      </Box>
      <Typography sx={{ mt: 3, mb: 1, fontWeight: 800 }}>Standard family total</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 2 }}>
        {standardRates.map((value, index) => <TextField key={`standard-${index}`} data-testid={`subs-standard-rate-${index + 1}`} label={`${index + 1} member${index ? "s" : ""} (EUR)`} value={value} onChange={(event) => setRate("standard", index, event.target.value)} />)}
      </Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
        <Button variant="outlined" onClick={() => addRate("standard")} data-testid="subs-add-standard-rate">Add standard member rate</Button>
        <Button variant="text" disabled={standardRates.length <= 1} onClick={() => removeLastRate("standard")}>Remove last standard rate</Button>
      </Stack>
      <Typography sx={{ mt: 3, mb: 1, fontWeight: 800 }}>Leader family total</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 2 }}>
        {leaderRates.map((value, index) => <TextField key={`leader-${index}`} data-testid={`subs-leader-rate-${index + 1}`} label={`${index + 1} member${index ? "s" : ""} (EUR)`} value={value} onChange={(event) => setRate("leader", index, event.target.value)} />)}
      </Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
        <Button variant="outlined" onClick={() => addRate("leader")} data-testid="subs-add-leader-rate">Add leader family member rate</Button>
        <Button variant="text" disabled={leaderRates.length <= 1} onClick={() => removeLastRate("leader")}>Remove last leader rate</Button>
      </Stack>
      <Alert severity="warning" sx={{ mt: 2 }}>If a family has more active members than this policy defines, no amount is inferred. Add the exact approved family-size rate before classification.</Alert>
      <Button variant="contained" sx={{ mt: 2.5 }} disabled={saving} onClick={() => void savePolicy()}>{saving ? "Saving…" : "Save immutable rate policy"}</Button>
    </Box>
    {loading ? <Typography color="text.secondary" sx={{ mt: 5 }}>Loading subs settings…</Typography> : <SubsFamilyAccountPanel members={members} policies={policies} assignments={assignments} defaultPolicyId={policies[0]?.id ?? ""} saving={saving} onSaving={setSaving} onMessage={setMessage} onError={setError} onReload={load} />}
  </Paper>;
}
