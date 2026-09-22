import { Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import SubsBalancesReport from "../components/admin/SubsBalancesReport";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { hasGroupFinanceAppointment } from "../security/scoutingAppointments";
import type { MemberRecord } from "../services/memberAdmin";
import { loadSubsAssignments, loadSubsMembers, loadSubsPayments, loadSubsPolicies, recordSubsPayment, reverseSubsPayment } from "../services/subsLedger";
import { balanceFor, familyTypeLabel, formatEuro, parseEuroToCents, paymentMethodLabel, paymentsForAssignment, rateCategoryLabel, resolveCurrentSubsPolicy, SUBS_PAYMENT_METHODS, type SubsAssignment, type SubsPayment, type SubsPaymentMethod, type SubsRatePolicy } from "../services/subsLogic";
import { ALL_AUTHORISED_SECTIONS, authorisedSubsSections, isMemberInSubsScope, normaliseSubsSection, selectableSubsSections } from "../services/subsScope";

const today = () => new Date().toISOString().slice(0, 10);
const csv = (rows: string[][]) => rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n");
const download = (name: string, body: string) => {
  const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};
const uniquePayments = (rows: SubsPayment[]) => [...new Map(rows.map((row) => [row.id, row])).values()];

export default function SubsManagement() {
  const { adminProfile } = useAdminAuth();
  const canGroupReport = Boolean(adminProfile?.role === "admin" || adminProfile?.role === "super-admin" || hasGroupFinanceAppointment(adminProfile?.appointments, adminProfile?.scoutingRole));
  const authorisedSections = useMemo(() => authorisedSubsSections(adminProfile?.sections ?? [], canGroupReport), [adminProfile?.sections, canGroupReport]);
  const [tab, setTab] = useState(0);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [policies, setPolicies] = useState<SubsRatePolicy[]>([]);
  const [assignments, setAssignments] = useState<SubsAssignment[]>([]);
  const [payments, setPayments] = useState<SubsPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [section, setSection] = useState(() => new URLSearchParams(window.location.search).get("section") ?? ALL_AUTHORISED_SECTIONS);
  const [memberId, setMemberId] = useState(() => new URLSearchParams(window.location.search).get("member") ?? "");
  const [period, setPeriod] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<SubsPaymentMethod>("bank");
  const [paymentDate, setPaymentDate] = useState(today());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [correction, setCorrection] = useState<SubsPayment | null>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const paymentSubmission = useRef(false);
  const paymentOperationId = useRef("");
  const selectableSections = useMemo(
    () =>
      selectableSubsSections(
        authorisedSections,
        canGroupReport,
        members.map((member) => member.section),
      ),
    [authorisedSections, canGroupReport, members],
  );
  const effectiveSection = normaliseSubsSection(section, selectableSections, canGroupReport);
  useEffect(() => {
    if (section !== effectiveSection) setSection(effectiveSection);
  }, [effectiveSection, section]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (effectiveSection === ALL_AUTHORISED_SECTIONS) url.searchParams.delete("section");
    else url.searchParams.set("section", effectiveSection);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [effectiveSection]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const assignmentRows = canGroupReport ? await loadSubsAssignments() : (await Promise.all(authorisedSections.map((value) => loadSubsAssignments(value)))).flat();
      const paymentRows = canGroupReport ? await loadSubsPayments() : (await Promise.all(authorisedSections.map((value) => loadSubsPayments(value)))).flat();
      const [m, p] = await Promise.all([loadSubsMembers(canGroupReport ? undefined : authorisedSections), loadSubsPolicies()]);
      setMembers(m);
      setPolicies(p);
      setAssignments(assignmentRows);
      setPayments(uniquePayments(paymentRows));
      const currentPolicy = resolveCurrentSubsPolicy(p);
      setPeriod((current) => current && p.some((policy) => policy.period === current) ? current : currentPolicy?.period ?? "");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? `Unable to load Subs data: ${e.message}` : "Unable to load Subs data. Try again.");
    } finally {
      setLoading(false);
    }
  }, [authorisedSections, canGroupReport]);
  useEffect(() => {
    void load();
  }, [load]);
  const visibleMembers = useMemo(() => members.filter((member) => isMemberInSubsScope(member.section, effectiveSection, authorisedSections, canGroupReport)), [authorisedSections, canGroupReport, effectiveSection, members]);
  const visibleAssignments = useMemo(() => assignments.filter((assignment) => isMemberInSubsScope(assignment.section, effectiveSection, authorisedSections, canGroupReport)), [assignments, authorisedSections, canGroupReport, effectiveSection]);
  const visiblePayments = useMemo(() => (effectiveSection === ALL_AUTHORISED_SECTIONS ? payments : payments.filter((payment) => payment.section === effectiveSection || visibleAssignments.some((assignment) => assignment.accountId && assignment.accountId === payment.accountId))), [effectiveSection, payments, visibleAssignments]);
  useEffect(() => {
    if (!loading && memberId && !visibleMembers.some((member) => member.id === memberId)) setMemberId("");
  }, [loading, memberId, visibleMembers]);
  const selected = visibleMembers.find((m) => m.id === memberId);
  const selectedAssignment = visibleAssignments.find((a) => a.memberId === memberId && a.period === period);
  const sharedBalanceRestricted = Boolean(selectedAssignment?.accountId && !canGroupReport);
  const memberPayments = selectedAssignment ? paymentsForAssignment(selectedAssignment, visiblePayments) : [];
  const selectedBalance = selectedAssignment && !sharedBalanceRestricted ? balanceFor(selectedAssignment, visiblePayments) : null;
  const changeSection = (value: string) => {
    setMemberId("");
    setMessage("");
    setSection(normaliseSubsSection(value, selectableSections, canGroupReport));
  };
  const submitPayment = async () => {
    if (paymentSubmission.current) return;
    if (!selected || !selectedAssignment) return setError("Select a member with a rate classification for this Scout year.");
    paymentSubmission.current = true;
    setSaving(true);
    setError("");
    try {
      await recordSubsPayment({
        memberId: selected.id,
        memberName: selected.displayName,
        section: selected.section,
        period,
        accountId: selectedAssignment.accountId,
        amountCents: parseEuroToCents(amount),
        method,
        paymentDate,
        note,
        operationId: paymentOperationId.current || undefined,
      });
      setConfirmOpen(false);
      setAmount("");
      setNote("");
      paymentOperationId.current = "";
      setMessage(selectedAssignment.accountId ? "Family subs payment recorded. Group finance can view the complete shared balance." : "Subs payment recorded.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to record payment.");
    } finally {
      paymentSubmission.current = false;
      setSaving(false);
    }
  };
  const reverse = async () => {
    if (!correction) return;
    setSaving(true);
    try {
      await reverseSubsPayment(correction, correctionReason);
      setCorrection(null);
      setCorrectionReason("");
      setMessage("Payment correction recorded as a linked reversal.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to correct payment.");
    } finally {
      setSaving(false);
    }
  };
  const reviewPayment = () => {
    try {
      parseEuroToCents(amount);
      setError("");
      if (!paymentOperationId.current) paymentOperationId.current = crypto.randomUUID();
      setConfirmOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enter a valid amount.");
    }
  };
  const paymentReady = useMemo(() => {
    if (!selectedAssignment || !period || !paymentDate || !method) return false;
    try {
      return parseEuroToCents(amount) > 0;
    } catch {
      return false;
    }
  }, [amount, method, paymentDate, period, selectedAssignment]);
  const exportMember = () => {
    if (!selectedAssignment || !selectedBalance) return;
    download(`subs-${selectedAssignment.memberName}-${period}.csv`, csv([["Member", "Section", "Scout year", "Rate category", "Family classification", "Child position", "Amount due (cents)", "Total paid (cents)", "Remaining (cents)"], [selectedAssignment.memberName, selectedAssignment.section, period, rateCategoryLabel(selectedAssignment.category), selectedAssignment.familyType ? familyTypeLabel(selectedAssignment.familyType) : "Legacy classification", selectedAssignment.familyPosition ? String(selectedAssignment.familyPosition) : "", String(selectedBalance.dueCents), String(selectedBalance.paidCents), String(selectedBalance.remainingCents)], [], ["Payment date", "Method", "Amount (cents)", "Correction of", "Note"], ...memberPayments.map((p) => [p.paymentDate, paymentMethodLabel(p.method), String(p.amountCents), p.reversalOfPaymentId, p.note])]));
  };
  if (loading)
    return (
      <Container>
        <LeaderDashboardHeader />
        <Typography role="status">Loading Subs records…</Typography>
      </Container>
    );
  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "background.default",
        py: { xs: 4, md: 6 },
      }}
    >
      <Container maxWidth="xl">
        <LeaderDashboardHeader />
        <LeaderPageHeader title="Subs" description="Record auditable payments and review Scout-year balances. Family classifications are managed from Settings by authorised group finance users." />
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {message && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}
        <Paper sx={{ p: { xs: 2, md: 2.5 }, mb: 3 }}>
          <FormControl fullWidth sx={{ maxWidth: 360 }}>
            <InputLabel id="subs-section-label">Section</InputLabel>
            <Select labelId="subs-section-label" label="Section" value={effectiveSection} onChange={(e) => changeSection(e.target.value)} data-testid="subs-section-select">
              {(canGroupReport || selectableSections.length > 1) && <MenuItem value={ALL_AUTHORISED_SECTIONS}>All authorised sections</MenuItem>}
              {selectableSections.map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }} aria-live="polite">
            Showing {effectiveSection === ALL_AUTHORISED_SECTIONS ? "all authorised sections" : effectiveSection}.
          </Typography>
        </Paper>
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" aria-label="Subs management sections">
            <Tab label="Record payment" />
            <Tab label="Balances & reports" />
          </Tabs>
        </Paper>
        {tab === 0 && (
          <Paper sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
              Record a payment
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(2,1fr)" },
                gap: 2,
              }}
            >
              <FormControl required>
                <InputLabel id="subs-member-label">Member</InputLabel>
                <Select labelId="subs-member-label" label="Member" value={memberId} onChange={(e) => { setMemberId(e.target.value); paymentOperationId.current = ""; }} data-testid="subs-member-select">
                  {visibleMembers.map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.displayName} · {m.section}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl required>
                <InputLabel id="subs-period-label">Scout year</InputLabel>
                <Select labelId="subs-period-label" label="Scout year" value={period} onChange={(e) => { setPeriod(e.target.value); paymentOperationId.current = ""; }}>
                  {policies.map((p) => (
                    <MenuItem key={p.id} value={p.period}>
                      {p.period}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField required label="Amount (EUR)" value={amount} onChange={(e) => { setAmount(e.target.value); paymentOperationId.current = ""; }} slotProps={{ htmlInput: { inputMode: "decimal" } }} />
              <FormControl required>
                <InputLabel id="subs-method-label">Payment method</InputLabel>
                <Select labelId="subs-method-label" label="Payment method" value={method} onChange={(e) => { setMethod(e.target.value as SubsPaymentMethod); paymentOperationId.current = ""; }}>
                  {SUBS_PAYMENT_METHODS.map((m) => (
                    <MenuItem key={m} value={m}>
                      {paymentMethodLabel(m)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField required type="date" label="Payment date" value={paymentDate} onChange={(e) => { setPaymentDate(e.target.value); paymentOperationId.current = ""; }} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="Note (optional)" value={note} onChange={(e) => { setNote(e.target.value); paymentOperationId.current = ""; }} slotProps={{ htmlInput: { maxLength: 200 } }} />
            </Box>
            {!error && visibleMembers.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No members are available for {effectiveSection === ALL_AUTHORISED_SECTIONS ? "the selected authorised sections" : effectiveSection}.
              </Alert>
            )}
            {selectedAssignment && selectedBalance ? (
              <>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2, flexWrap: "wrap" }}>
                  <Chip label={`Due ${formatEuro(selectedBalance.dueCents)}`} />
                  <Chip label={`Paid ${formatEuro(selectedBalance.paidCents)}`} />
                  <Chip label={selectedBalance.remainingCents < 0 ? `Credit ${formatEuro(-selectedBalance.remainingCents)}` : `Remaining ${formatEuro(selectedBalance.remainingCents)}`} />
                </Stack>
                {selectedAssignment.accountId && (
                  <Alert severity="info" sx={{ mt: 2 }} data-testid="subs-shared-family-balance">
                    This is the shared family balance for the Scout year. Payments recorded through any member in this family reduce the same balance.
                  </Alert>
                )}
              </>
            ) : sharedBalanceRestricted ? (
              <Alert severity="info" sx={{ mt: 2 }} data-testid="subs-shared-family-private">
                This member belongs to a shared family subs account. You can record a payment for this member, but complete cross-section family details remain restricted to authorised group finance users.
              </Alert>
            ) : (
              memberId && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  This member needs an authorised rate classification for the selected Scout year before payment can be recorded.
                </Alert>
              )
            )}
            <Button variant="contained" sx={{ mt: 3, minHeight: 44 }} disabled={saving || !paymentReady} onClick={reviewPayment}>
              Review payment
            </Button>
            <Stack direction={{ xs: "column", sm: "row" }} sx={{ mt: 4, justifyContent: "space-between" }}>
              <Typography variant="h6">Payment history</Typography>
              {selectedAssignment && selectedBalance && (
                <Button variant="outlined" onClick={exportMember}>
                  Download member CSV
                </Button>
              )}
            </Stack>
            {sharedBalanceRestricted && (
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Only payments in your authorised scope are shown here; this is not the complete family ledger.
              </Typography>
            )}
            <Stack spacing={1} sx={{ mt: 1 }}>
              {memberPayments.map((p) => (
                <Paper key={p.id} variant="outlined" sx={{ p: 2 }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {p.paymentDate} · {paymentMethodLabel(p.method)}
                  </Typography>
                  <Typography>
                    {formatEuro(p.amountCents)}
                    {p.reversalOfPaymentId ? " · Correction" : ""}
                  </Typography>
                  {p.note && <Typography color="text.secondary">{p.note}</Typography>}
                </Paper>
              ))}
            </Stack>
          </Paper>
        )}
        {tab === 1 && <SubsBalancesReport assignments={visibleAssignments} payments={visiblePayments} policies={policies} period={period} setPeriod={setPeriod} section={effectiveSection} sections={authorisedSections} canGroupReport={canGroupReport} />}
        <Dialog open={confirmOpen} onClose={() => !saving && setConfirmOpen(false)}>
          <DialogTitle>Confirm subs payment</DialogTitle>
          <DialogContent dividers>
            <Typography>
              <strong>{selected?.displayName}</strong> · {selected?.section}
            </Typography>
            <Typography>
              {formatEuro(amount ? parseEuroToCents(amount) : 0)} by {paymentMethodLabel(method)} on {paymentDate}
            </Typography>
            <Typography>Scout year: {period}</Typography>
            {selectedAssignment?.accountId && <Typography>Applied to the shared family account.</Typography>}
            {selectedBalance && <Typography>Resulting remaining balance: {formatEuro(selectedBalance.remainingCents - (amount ? parseEuroToCents(amount) : 0))}</Typography>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="contained" disabled={saving} onClick={() => void submitPayment()}>
              {saving ? "Recording…" : "Confirm payment"}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={Boolean(correction)} onClose={() => !saving && setCorrection(null)}>
          <DialogTitle>Correct payment entry</DialogTitle>
          <DialogContent dividers>
            <Alert severity="warning" sx={{ mb: 2 }}>
              The original payment remains in history. An exact linked reversal will be added to the same {correction?.accountId ? "family account" : "member ledger"}.
            </Alert>
            <TextField autoFocus required fullWidth label="Correction reason" value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCorrection(null)}>Cancel</Button>
            <Button color="warning" variant="contained" disabled={saving || !correctionReason.trim()} onClick={() => void reverse()}>
              Record correction
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}
