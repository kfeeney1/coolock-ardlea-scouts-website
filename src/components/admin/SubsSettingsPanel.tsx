import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";

import { loadMembers, type MemberRecord } from "../../services/memberAdmin";
import {
  assignSubsFamilyRate,
  loadSubsAssignments,
  loadSubsPolicies,
  saveSubsPolicy
} from "../../services/subsLedger";
import {
  AGREED_SUBS_2026_27,
  familyIncrementFor,
  familyTotalFor,
  familyTypeLabel,
  formatEuro,
  parseEuroToCents,
  type SubsAssignment,
  type SubsFamilyType,
  type SubsRatePolicy
} from "../../services/subsLogic";
import { useAdminAuth } from "./AdminAuthProvider";

const euroValue = (cents: number) => (cents / 100).toFixed(2);

export default function SubsSettingsPanel() {
  const { adminProfile } = useAdminAuth();
  const canManage = adminProfile?.role === "admin"
    || adminProfile?.role === "super-admin"
    || adminProfile?.scoutingRole === "Group Treasurer"
    || adminProfile?.scoutingRole === "Group Leader";

  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [policies, setPolicies] = useState<SubsRatePolicy[]>([]);
  const [assignments, setAssignments] = useState<SubsAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [period, setPeriod] = useState<string>(AGREED_SUBS_2026_27.period);
  const [periodStart, setPeriodStart] = useState<string>(AGREED_SUBS_2026_27.periodStart);
  const [periodEnd, setPeriodEnd] = useState<string>(AGREED_SUBS_2026_27.periodEnd);
  const [version, setVersion] = useState("1");
  const [standardRates, setStandardRates] = useState(AGREED_SUBS_2026_27.standardFamilyRatesCents.map(euroValue));
  const [leaderRates, setLeaderRates] = useState(AGREED_SUBS_2026_27.leaderFamilyRatesCents.map(euroValue));

  const [memberId, setMemberId] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [familyType, setFamilyType] = useState<SubsFamilyType>("standard");
  const [familyPosition, setFamilyPosition] = useState("1");

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError("");
    try {
      const [memberRows, policyRows, assignmentRows] = await Promise.all([
        loadMembers(),
        loadSubsPolicies(),
        loadSubsAssignments()
      ]);
      setMembers(memberRows.filter((member) => member.status === "active"));
      setPolicies(policyRows);
      setAssignments(assignmentRows);
      if (!policyId && policyRows[0]) setPolicyId(policyRows[0].id);
    } catch (loadError) {
      console.error("Unable to load subs settings:", loadError);
      setError("Unable to load subs rates and classifications.");
    } finally {
      setLoading(false);
    }
  }, [canManage, policyId]);

  useEffect(() => {
    void load();
  }, []);

  const selectedMember = members.find((member) => member.id === memberId);
  const selectedPolicy = policies.find((policy) => policy.id === policyId);
  const existingAssignment = selectedMember && selectedPolicy
    ? assignments.find((assignment) => assignment.memberId === selectedMember.id && assignment.period === selectedPolicy.period)
    : undefined;

  const maxChildren = selectedPolicy
    ? (familyType === "leader" ? selectedPolicy.leaderFamilyRatesCents?.length : selectedPolicy.standardFamilyRatesCents?.length) ?? 0
    : 0;

  const position = Number(familyPosition);
  const preview = useMemo(() => {
    if (!selectedPolicy || !Number.isInteger(position) || position < 1 || position > maxChildren) return null;
    try {
      return {
        familyTotal: familyTotalFor(selectedPolicy, familyType, position),
        memberDue: familyIncrementFor(selectedPolicy, familyType, position)
      };
    } catch {
      return null;
    }
  }, [selectedPolicy, familyType, position, maxChildren]);

  const setRate = (type: "standard" | "leader", index: number, value: string) => {
    const setter = type === "standard" ? setStandardRates : setLeaderRates;
    setter((current) => current.map((entry, currentIndex) => currentIndex === index ? value : entry));
    setMessage("");
    setError("");
  };

  const savePolicy = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const standardFamilyRatesCents = standardRates.map(parseEuroToCents);
      const leaderFamilyRatesCents = leaderRates.map(parseEuroToCents);
      const standardSecondIncrement = standardFamilyRatesCents.length > 1
        ? standardFamilyRatesCents[1] - standardFamilyRatesCents[0]
        : standardFamilyRatesCents[0];
      await saveSubsPolicy({
        period,
        effectiveFrom: periodStart,
        periodStart,
        periodEnd,
        version: Number(version),
        standardFamilyRatesCents,
        leaderFamilyRatesCents,
        // Retained for backwards compatibility with pre-family SW-47 records.
        standardCents: standardFamilyRatesCents[0],
        leaderChildCents: leaderFamilyRatesCents[0],
        siblingCents: standardSecondIncrement
      });
      setMessage(`Subs policy ${period} saved. The period runs ${periodStart} to ${periodEnd}.`);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save subs policy.");
    } finally {
      setSaving(false);
    }
  };

  const assign = async () => {
    if (!selectedMember || !selectedPolicy || !preview) {
      setError("Select a member, family classification and valid child position.");
      return;
    }
    if (existingAssignment) {
      setError("This member already has an immutable classification for this Scout year.");
      return;
    }
    setSaving(true);
    setMessage("");
    setError("");
    try {
      await assignSubsFamilyRate(selectedMember, selectedPolicy, familyType, position);
      setMessage(`${selectedMember.displayName} classified as child ${position} in a ${familyTypeLabel(familyType).toLowerCase()} for ${selectedPolicy.period}.`);
      await load();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Unable to save subs classification.");
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) return null;

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mt: 3 }} data-testid="subs-settings-panel">
      <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Subs rates &amp; classification</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.75 }}>
        Configure Scout-year family rates and explicitly classify each child. Access is restricted to the Treasurer, Group Leader and admins.
      </Typography>

      {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Rate policy</Typography>
        <Alert severity="info" sx={{ mt: 1.5, mb: 2 }}>
          2026/27 is prefilled with the agreed rates. The Scout subs year runs from September through June. Policies are immutable once saved; a correction is made by creating a later version.
        </Alert>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
          <TextField label="Scout year" value={period} onChange={(event) => setPeriod(event.target.value)} />
          <TextField type="date" label="Starts" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="date" label="Ends" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField type="number" label="Policy version" value={version} onChange={(event) => setVersion(event.target.value)} slotProps={{ htmlInput: { min: 1, step: 1 } }} />
        </Box>

        <Typography sx={{ mt: 3, mb: 1, fontWeight: 800 }}>Standard family total</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
          {standardRates.map((value, index) => (
            <TextField key={`standard-${index}`} label={`${index + 1} child${index ? "ren" : ""} (EUR)`} value={value} onChange={(event) => setRate("standard", index, event.target.value)} />
          ))}
        </Box>

        <Typography sx={{ mt: 3, mb: 1, fontWeight: 800 }}>Leader family total</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
          {leaderRates.map((value, index) => (
            <TextField key={`leader-${index}`} label={`${index + 1} child${index ? "ren" : ""} (EUR)`} value={value} onChange={(event) => setRate("leader", index, event.target.value)} />
          ))}
        </Box>
        <Button variant="contained" sx={{ mt: 2.5 }} disabled={saving} onClick={() => void savePolicy()}>
          {saving ? "Saving…" : "Save immutable rate policy"}
        </Button>
      </Box>

      <Box sx={{ mt: 5 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Member classification</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          Select the child’s position within the family. To keep individual member balances auditable, the family total is allocated as the first-child amount plus the incremental amount for each additional child.
        </Typography>

        {loading ? <Typography color="text.secondary">Loading subs settings…</Typography> : (
          <>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
              <FormControl>
                <InputLabel>Member</InputLabel>
                <Select label="Member" value={memberId} onChange={(event) => setMemberId(event.target.value)} data-testid="subs-classification-member">
                  {members.map((member) => <MenuItem key={member.id} value={member.id}>{member.displayName} · {member.section}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl>
                <InputLabel>Scout year policy</InputLabel>
                <Select label="Scout year policy" value={policyId} onChange={(event) => setPolicyId(event.target.value)}>
                  {policies.map((policy) => <MenuItem key={policy.id} value={policy.id}>{policy.period} · v{policy.version}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl>
                <InputLabel>Family classification</InputLabel>
                <Select label="Family classification" value={familyType} onChange={(event) => { setFamilyType(event.target.value as SubsFamilyType); setFamilyPosition("1"); }}>
                  <MenuItem value="standard">Standard family</MenuItem>
                  <MenuItem value="leader">Leader family</MenuItem>
                </Select>
              </FormControl>
              <FormControl disabled={!maxChildren}>
                <InputLabel>Child position</InputLabel>
                <Select label="Child position" value={familyPosition} onChange={(event) => setFamilyPosition(event.target.value)}>
                  {Array.from({ length: maxChildren }, (_, index) => index + 1).map((child) => <MenuItem key={child} value={String(child)}>Child {child}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>

            {preview && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
                <Chip label={`Family total ${formatEuro(preview.familyTotal)}`} />
                <Chip label={`This member due ${formatEuro(preview.memberDue)}`} />
                {position > 1 && <Chip label={`Additional child ${position}`} />}
              </Stack>
            )}
            {existingAssignment && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                This member already has an immutable {existingAssignment.period} classification of {formatEuro(existingAssignment.amountDueCents)}. Existing classifications are not overwritten; any future correction must preserve an auditable history.
              </Alert>
            )}
            <Button variant="contained" sx={{ mt: 2.5 }} disabled={saving || !selectedMember || !selectedPolicy || !preview || Boolean(existingAssignment)} onClick={() => void assign()}>
              {saving ? "Saving…" : "Save classification"}
            </Button>
          </>
        )}
      </Box>
    </Paper>
  );
}
