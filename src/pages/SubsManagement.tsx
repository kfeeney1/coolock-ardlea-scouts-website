import { applicationErrorMessage } from "../services/applicationErrors.ts";
import { Alert, Box, Button, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Paper, Select, Tab, Tabs, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import SubsPaymentPanel from "../components/admin/SubsPaymentPanel";
import SubsBalancesReport from "../components/admin/SubsBalancesReport";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { hasGroupFinanceAppointment } from "../security/scoutingAppointments";
import type { MemberRecord } from "../services/memberAdmin";
import { ensureDefaultSubsAssignment, loadSubsAssignments, loadSubsMembers, loadSubsPayments, loadSubsPolicies, recordSubsPayment, reverseSubsPayment } from "../services/subsLedger";
import { balanceFor, familyTypeLabel, formatEuro, parseEuroToCents, paymentMethodLabel, paymentsForAssignment, rateCategoryLabel, resolveCurrentSubsPolicy, type SubsAssignment, type SubsPayment, type SubsPaymentMethod, type SubsRatePolicy } from "../services/subsLogic";
import { ALL_AUTHORISED_SECTIONS, authorisedSubsSections, isMemberInSubsScope, normaliseSubsSection, selectableSubsSections } from "../services/subsScope";
import { formatSiteDate } from "../services/siteDateFormat";

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
  const { user, adminProfile } = useAdminAuth();
  const [searchParams] = useSearchParams();
  const navigationView = searchParams.get("view");
  const pageIdentity = navigationView === "treasurer" ? "treasurer-subs" : navigationView === "group-operations" ? "group-subs" : "subs";
  const canGroupReport = Boolean(adminProfile?.role === "admin" || adminProfile?.role === "super-admin" || hasGroupFinanceAppointment(adminProfile?.appointments, adminProfile?.scoutingRole));
  const authorisedSections = useMemo(() => authorisedSubsSections(adminProfile?.sections ?? [], canGroupReport), [adminProfile?.sections, canGroupReport]);
  const [tab, setTab] = useState(0);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [policies, setPolicies] = useState<SubsRatePolicy[]>([]);
  const [assignments, setAssignments] = useState<SubsAssignment[]>([]);
  const [payments, setPayments] = useState<SubsPayment[]>([]);
  const scopeKey = JSON.stringify([user?.uid, authorisedSections, canGroupReport]);
  const [loadedScope, setLoadedScope] = useState("");
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
  const loadVersion = useRef(0);
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
    const version = ++loadVersion.current;
    setLoadedScope("");
    setLoading(true);
    setError("");
    try {
      const [assignmentRows, paymentRows, m, p] = await Promise.all([
        canGroupReport ? loadSubsAssignments() : Promise.all(authorisedSections.map((value) => loadSubsAssignments(value))).then((rows) => rows.flat()),
        canGroupReport ? loadSubsPayments() : Promise.all(authorisedSections.map((value) => loadSubsPayments(value))).then((rows) => rows.flat()),
        loadSubsMembers(canGroupReport ? undefined : authorisedSections),
        loadSubsPolicies(),
      ]);
      if (version !== loadVersion.current) return;
      setLoadedScope(scopeKey);
      setMembers(m);
      setPolicies(p);
      setAssignments(assignmentRows);
      setPayments(uniquePayments(paymentRows));
      const currentPolicy = resolveCurrentSubsPolicy(p);
      setPeriod((current) => current && p.some((policy) => policy.period === current) ? current : currentPolicy?.period ?? "");
    } catch (e) {
      if (version === loadVersion.current) setError(applicationErrorMessage(e, "Unable to load Subs data. Try again.", "SubsManagement"));
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [authorisedSections, canGroupReport, scopeKey]);
  useEffect(() => {
    void load();
    return () => { ++loadVersion.current; };
  }, [load]);
  const currentPolicy = useMemo(() => resolveCurrentSubsPolicy(policies), [policies]);
  const visibleMembers = useMemo(() => members.filter((member) => isMemberInSubsScope(member.section, effectiveSection, authorisedSections, canGroupReport)), [authorisedSections, canGroupReport, effectiveSection, members]);
  const visibleAssignments = useMemo(() => assignments.filter((assignment) => isMemberInSubsScope(assignment.section, effectiveSection, authorisedSections, canGroupReport)), [assignments, authorisedSections, canGroupReport, effectiveSection]);
  const visiblePayments = useMemo(() => (effectiveSection === ALL_AUTHORISED_SECTIONS ? payments : payments.filter((payment) => payment.section === effectiveSection || visibleAssignments.some((assignment) => assignment.accountId && assignment.accountId === payment.accountId))), [effectiveSection, payments, visibleAssignments]);
  useEffect(() => {
    if (!loading && memberId && !visibleMembers.some((member) => member.id === memberId)) setMemberId("");
  }, [loading, memberId, visibleMembers]);
  const selected = visibleMembers.find((m) => m.id === memberId);
  const selectedAssignment = visibleAssignments.find((a) => a.memberId === memberId && a.period === period);
  // A group finance officer can safely establish the policy's standard first-child
  // rate for an unclassified member. Existing family accounts/assignments are never overwritten.
  const defaultRateAttempts = useRef(new Set<string>());
  useEffect(() => {
    if (loading || loadedScope !== scopeKey || !canGroupReport || !selected || !period || selectedAssignment) return;
    const policy = policies.find((candidate) => candidate.period === period && candidate.id === currentPolicy?.id);
    if (!policy) return;
    const key = `${selected.id}:${policy.id}`;
    if (defaultRateAttempts.current.has(key)) return;
    defaultRateAttempts.current.add(key);
    void ensureDefaultSubsAssignment(selected, policy)
      .then(() => load())
      .catch((cause) => setError(applicationErrorMessage(cause, "Unable to resolve the member's subscription rate.", "SubsManagement")));
  }, [canGroupReport, currentPolicy, loadedScope, loading, load, period, policies, scopeKey, selected, selectedAssignment]);
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
      void load();
    } catch (e) {
      setError(applicationErrorMessage(e, "Unable to record payment.", "SubsManagement"));
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
      void load();
    } catch (e) {
      setError(applicationErrorMessage(e, "Unable to correct payment.", "SubsManagement"));
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
      setError(applicationErrorMessage(e, "Enter a valid amount.", "SubsManagement"));
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
  return (
    <Box
      data-testid={`page-${pageIdentity}`}
      sx={{
        minHeight: "100vh",
        backgroundColor: "background.default",
        py: { xs: 4, md: 6 },
      }}
    >
      <Container maxWidth="xl">
        <LeaderDashboardHeader />
        <LeaderPageHeader title="Subs" />
        {loading || loadedScope !== scopeKey ? <Paper sx={{ p: 3 }}>{loading || !error ? <Typography role="status">Loading Subs records…</Typography> : <Alert severity="error" action={<Button onClick={() => void load()}>Retry</Button>}>{error}</Alert>}</Paper> : <>
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
        {!currentPolicy && <Alert severity="error" sx={{ mb: 2 }} data-testid="subs-current-policy-error">No valid Subs policy is active for the current Scout year. Payments require an explicit historical Scout year with an existing classification; configure the current policy before recording current-year finance.</Alert>}
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
        {tab === 0 && <SubsPaymentPanel
          visibleMembers={visibleMembers}
          policies={policies}
          memberId={memberId}
          period={period}
          amount={amount}
          method={method}
          paymentDate={paymentDate}
          note={note}
          selectedAssignment={selectedAssignment}
          selectedBalance={selectedBalance}
          sharedBalanceRestricted={sharedBalanceRestricted}
          memberPayments={memberPayments}
          error={error}
          effectiveSection={effectiveSection}
          saving={saving}
          paymentReady={paymentReady}
          onMemberChange={(value) => { setMemberId(value); paymentOperationId.current = ""; }}
          onPeriodChange={(value) => { setPeriod(value); paymentOperationId.current = ""; }}
          onAmountChange={(value) => { setAmount(value); paymentOperationId.current = ""; }}
          onMethodChange={(value) => { setMethod(value); paymentOperationId.current = ""; }}
          onPaymentDateChange={(value) => { setPaymentDate(value); paymentOperationId.current = ""; }}
          onNoteChange={(value) => { setNote(value); paymentOperationId.current = ""; }}
          onReviewPayment={reviewPayment}
          onExportMember={exportMember}
        />}
        {tab === 1 && <SubsBalancesReport assignments={visibleAssignments} payments={visiblePayments} policies={policies} period={period} setPeriod={setPeriod} section={effectiveSection} sections={authorisedSections} canGroupReport={canGroupReport} />}
        <Dialog open={confirmOpen} onClose={() => !saving && setConfirmOpen(false)}>
          <DialogTitle>Confirm subs payment</DialogTitle>
          <DialogContent dividers>
            <Typography>
              <strong>{selected?.displayName}</strong> · {selected?.section}
            </Typography>
            <Typography>
              {formatEuro(amount ? parseEuroToCents(amount) : 0)} by {paymentMethodLabel(method)} on {formatSiteDate(paymentDate)}
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
        </>}
      </Container>
    </Box>
  );
}
