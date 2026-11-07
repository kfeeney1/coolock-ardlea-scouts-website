import { applicationErrorMessage, reportApplicationError } from "../../services/applicationErrors.ts";
import DateRangeFields from "../DateRangeFields";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { settingsAccessFor } from "../../security/settingsAccess";
import { loadSubsPolicies, saveSubsPolicy } from "../../services/subsLedger";
import { AGREED_SUBS_2026_27, parseEuroToCents, resolveCurrentSubsPolicy, type SubsRatePolicy } from "../../services/subsLogic";
import { persistThenRefresh } from "../../services/persistThenRefresh";
import { useAdminAuth } from "./AdminAuthProvider";
import { Link } from "react-router-dom";
import { nextSubsPolicyVersion } from "../../services/subsPolicyVersion";

const euroValue = (cents: number) => (cents / 100).toFixed(2);

export default function SubsSettingsPanel() {
  const { adminProfile } = useAdminAuth();
  const canManage = settingsAccessFor(adminProfile, "subs").edit;
  const [policies, setPolicies] = useState<SubsRatePolicy[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const loadGeneration = useRef(0);
  const policyForm = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [refreshWarning, setRefreshWarning] = useState("");
  const [period, setPeriod] = useState<string>(AGREED_SUBS_2026_27.period);
  const [periodStart, setPeriodStart] = useState<string>(AGREED_SUBS_2026_27.periodStart);
  const [periodEnd, setPeriodEnd] = useState<string>(AGREED_SUBS_2026_27.periodEnd);
  const [version, setVersion] = useState("1");
  const [standardRates, setStandardRates] = useState(AGREED_SUBS_2026_27.standardFamilyRatesCents.map(euroValue));
  const [leaderRates, setLeaderRates] = useState(AGREED_SUBS_2026_27.leaderFamilyRatesCents.map(euroValue));

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    if (!canManage) { setPolicies([]); setLoaded(false); return; }
    setLoaded(false);
    setLoading(true);
    setError("");
    setRefreshWarning("");
    try {
      const policyRows = await loadSubsPolicies();
      if (generation !== loadGeneration.current) return;
      setPolicies(policyRows);
      setLoaded(true);
      setDrafting(false);
      const activePolicy = resolveCurrentSubsPolicy(policyRows);
      if (activePolicy) {
        setPeriod(activePolicy.period);
        setPeriodStart(activePolicy.periodStart || activePolicy.effectiveFrom);
        setPeriodEnd(activePolicy.periodEnd || "");
        setVersion(String(activePolicy.version));
        setStandardRates((activePolicy.standardFamilyRatesCents ?? []).map(euroValue));
        setLeaderRates((activePolicy.leaderFamilyRatesCents ?? []).map(euroValue));
      } else { setVersion(String(nextSubsPolicyVersion(policyRows, AGREED_SUBS_2026_27.period))); }
    } catch (loadError) {
      if (generation !== loadGeneration.current) return;
      setError(applicationErrorMessage(loadError, "Unable to load subs rates and classifications.", "SubsSettingsPanel"));
      throw loadError;
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [canManage]);

  useEffect(() => { void load().catch(() => undefined); return () => { ++loadGeneration.current; }; }, [load]);

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
    if (!canManage || !loaded || (currentPolicy && !drafting) || saving) return;
    if (!policyForm.current?.reportValidity()) {
      setError("Correct the highlighted policy fields before saving.");
      return;
    }
    setSaving(true); setMessage(""); setError("");
    try {
      const standardFamilyRatesCents = standardRates.map(parseEuroToCents);
      const leaderFamilyRatesCents = leaderRates.map(parseEuroToCents);
      const siblingCents = standardFamilyRatesCents.length > 1 ? standardFamilyRatesCents[1] - standardFamilyRatesCents[0] : standardFamilyRatesCents[0];
      const result = await persistThenRefresh(
        () => saveSubsPolicy({
          period, effectiveFrom: periodStart, periodStart, periodEnd, version: Number(version),
          standardFamilyRatesCents, leaderFamilyRatesCents,
          standardCents: standardFamilyRatesCents[0], leaderChildCents: leaderFamilyRatesCents[0], siblingCents
        }),
        load
      );
      setMessage(`Subs policy ${period} saved. The period runs ${periodStart} to ${periodEnd}.`);
      if (!result.refreshed) {
        reportApplicationError(result.refreshError, { area: "SubsSettingsPanel", operation: "Subs policy saved but dependent state refresh failed" });
        setError("");
        setRefreshWarning("Subs policy was saved successfully, but the dependent finance data could not be refreshed. Reload this page to retry; the saved policy has not been rolled back.");
      }
    } catch (saveError) {
      setError(applicationErrorMessage(saveError, "Unable to save subs policy.", "SubsSettingsPanel"));
    } finally { setSaving(false); }
  };

  const currentPolicy = resolveCurrentSubsPolicy(policies);

  if (!canManage) return null;
  return <Paper component="form" ref={policyForm} noValidate onSubmit={(event) => { event.preventDefault(); void savePolicy(); }} variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mt: 3 }} data-testid="subs-settings-panel">
    <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Subs rate policy</Typography>

    {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
    {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    {refreshWarning && <Alert severity="warning" sx={{ mt: 2 }} data-testid="subs-refresh-warning">{refreshWarning}</Alert>}
    {loaded && currentPolicy && <Button variant="contained" sx={{ mt: 2 }} onClick={() => { setVersion(String(nextSubsPolicyVersion(policies, period))); setDrafting(true); setMessage(""); setError(""); }} disabled={saving || drafting}>Create next version</Button>}
    {drafting && <Button variant="contained" sx={{ mt: 2, ml: 1 }} disabled={saving} onClick={() => void load().catch(() => undefined)}>Cancel new version</Button>}
    <Box component="fieldset" aria-label="Subs rate policy" aria-busy={loading} disabled={loading || saving || !loaded || Boolean(currentPolicy && !drafting)} sx={{ mt: 3, mx: 0, p: 0, border: 0, minWidth: 0 }}>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>Rate policy</Typography>
      <Typography color="text.secondary" sx={{ my: 2 }}>{currentPolicy && !drafting ? "Saved policy · read-only" : "New immutable policy · draft"}</Typography>
      {!loading && loaded && currentPolicy ? (
        <Alert severity="success" sx={{ mb: 2 }} data-testid="subs-saved-policy-status">
          Saved active policy: {currentPolicy.period}, version {currentPolicy.version}. Record Payment will use this persisted policy.
        </Alert>
      ) : !loading && loaded ? (
        <Alert severity="warning" sx={{ mb: 2 }} data-testid="subs-unsaved-policy-status">
          No saved active Subs policy was found. The values below are a draft only and are not available to Record Payment until you save an immutable rate policy.
        </Alert>
      ) : null}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
        <TextField label="Scout year" value={period} onChange={(event) => { setPeriod(event.target.value); setVersion(String(nextSubsPolicyVersion(policies, event.target.value))); }} />
        <DateRangeFields startDate={periodStart} endDate={periodEnd} startLabel="Starts" endLabel="Ends" startRequired endRequired onStartDateChange={setPeriodStart} onEndDateChange={setPeriodEnd} />
        <TextField type="number" label="Policy version" value={version} onChange={(event) => setVersion(event.target.value)} slotProps={{ htmlInput: { min: 1, step: 1 } }} />
      </Box>
      {loaded && currentPolicy && (!currentPolicy.standardFamilyRatesCents?.length || !currentPolicy.leaderFamilyRatesCents?.length) && <Alert severity="warning">This saved legacy policy has no family-rate tables. Enter explicit approved rates in a new version before creating family accounts.</Alert>}
      <Typography sx={{ mt: 3, mb: 1, fontWeight: 800 }}>Standard family total</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 2 }}>
        {standardRates.map((value, index) => <TextField key={`standard-${index}`} data-testid={`subs-standard-rate-${index + 1}`} label={`${index + 1} member${index ? "s" : ""} (EUR)`} value={value} onChange={(event) => setRate("standard", index, event.target.value)} />)}
      </Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
        <Button variant="outlined" onClick={() => addRate("standard")} data-testid="subs-add-standard-rate">Add standard member rate</Button>
        <Button type="button" variant="outlined" disabled={standardRates.length <= 1} onClick={() => removeLastRate("standard")}>Remove last standard rate</Button>
      </Stack>
      <Typography sx={{ mt: 3, mb: 1, fontWeight: 800 }}>Leader family total</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 2 }}>
        {leaderRates.map((value, index) => <TextField key={`leader-${index}`} data-testid={`subs-leader-rate-${index + 1}`} label={`${index + 1} member${index ? "s" : ""} (EUR)`} value={value} onChange={(event) => setRate("leader", index, event.target.value)} />)}
      </Box>
      <Stack direction={{ xs: "column", sm:"row" }} spacing={1} sx={{ mt: 1.5 }}>
        <Button variant="outlined" onClick={() => addRate("leader")} data-testid="subs-add-leader-rate">Add leader family member rate</Button>
        <Button type="button" variant="outlined" disabled={leaderRates.length <= 1} onClick={() => removeLastRate("leader")}>Remove last leader rate</Button>
      </Stack>
      <Alert severity="warning" sx={{ mt: 2 }}>If a family has more active members than this policy defines, no amount is inferred. Add the exact approved family-size rate before classification.</Alert>
      <Button type="submit" variant="contained" sx={{ mt: 2.5 }} disabled={saving}>{saving ? "Saving…" : "Save immutable rate policy"}</Button>
    </Box>
    {loading && <Typography role="status" color="text.secondary" sx={{ mt: 2 }}>Loading subs settings…</Typography>}
    {!loading && !loaded && <Button onClick={() => void load().catch(() => undefined)}>Retry Subs policy</Button>}
    <Button component={Link} to="/leader/subs#family-billing" variant="contained" sx={{ mt: 3 }}>Open Family Billing Accounts</Button>
  </Paper>;
}
