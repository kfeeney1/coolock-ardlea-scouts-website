import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import MedicationManagementPanel from "../components/admin/MedicationManagementPanel";
import { loadConsentAdminRecord, loadConsentAdminRecords } from "../services/consentAdmin";
import type { ConsentAdminRecord } from "../services/consentAdmin";
import { consentRecordPrintHtml, displayValue, formatDate, formatFieldName, normalizeMedicationManagement } from "../services/consentManagementLogic";
import { hasImportantMedicalInformation, medicalPresentationGroups } from "../services/medicalPresentation";
import { createMemberFromYouthConsent, isCurrentUserSuperAdmin, loadReconciliationCandidates, manuallyReconcileConsent, type ReconciliationCandidate } from "../services/memberConsentReconciliation";

export default function ConsentRecordPage() {
  const { consentId } = useParams();
  const location = useLocation();
  const [record, setRecord] = useState<ConsentAdminRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [superAdmin, setSuperAdmin] = useState(false);
  const [candidates, setCandidates] = useState<ReconciliationCandidate[]>([]);
  const [candidateId, setCandidateId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmCorrection, setConfirmCorrection] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [creatingMember, setCreatingMember] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError("");
      try {
        const found = consentId ? await loadConsentAdminRecord(consentId) : null;
        if (cancelled) return;
        setRecord(found);
        if (!found) setError("This consent record could not be found or is outside your permitted sections.");
      } catch (loadError) {
        if (cancelled) return;
        console.error("Unable to load consent record:", loadError);
        setError("Unable to load this consent record.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [consentId]);

  useEffect(() => {
    let cancelled = false;
    void isCurrentUserSuperAdmin().then(async (allowed) => {
      if (cancelled) return;
      setSuperAdmin(allowed);
      if (allowed) setCandidates(await loadReconciliationCandidates());
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [consentId]);

  const reconcile = async () => {
    if (!record || !candidateId || !reason.trim()) return;
    if (record.memberId && record.memberId !== candidateId && !confirmCorrection) {
      setError("Confirm that you intend to replace the existing member relationship.");
      return;
    }
    setReconciling(true); setError("");
    try {
      await manuallyReconcileConsent(record.id, candidateId, reason);
      const records = await loadConsentAdminRecords();
      setRecord(records.find((item) => item.id === record.id) ?? null);
      setReason(""); setConfirmCorrection(false);
    } catch (reconcileError) {
      console.error("Unable to reconcile consent:", reconcileError);
      setError(reconcileError instanceof Error ? reconcileError.message : "Unable to reconcile this consent record.");
    } finally { setReconciling(false); }
  };

  const createMember = async () => {
    if (!record || record.type !== "youth" || record.memberId) return;
    setCreatingMember(true); setError("");
    try {
      const memberId = await createMemberFromYouthConsent(record.id);
      const records = await loadConsentAdminRecords();
      setRecord(records.find((item) => item.id === record.id) ?? null);
      setCandidateId(memberId);
    } catch (createError) {
      console.error("Unable to create member from consent:", createError);
      setError(createError instanceof Error ? createError.message : "Unable to create the member record.");
    } finally { setCreatingMember(false); }
  };

  const returnPath = typeof location.state === "object" && location.state && "fromMemberPath" in location.state && typeof location.state.fromMemberPath === "string" ? location.state.fromMemberPath : "/leader/consents";

  const printRecord = () => {
    if (!record) return;
    setError("");
    const printWindow = window.open("", "_blank", "width=1000,height=800");
    if (!printWindow) {
      setError("The print window was blocked by your browser. Please allow pop-ups for this site and try again.");
      return;
    }
    printWindow.document.open();
    printWindow.document.write(consentRecordPrintHtml(record));
    printWindow.document.close();
    window.setTimeout(() => { printWindow.focus(); printWindow.print(); }, 500);
  };

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="lg">
      <LeaderDashboardHeader />
      <LeaderPageHeader
        title={record ? record.memberName : "Consent Record"}
        description="Full consent and medical-information record."
        actions={<Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Button component={Link} to={returnPath} variant="outlined" color="secondary">{returnPath.startsWith("/leader/members/") ? "Back to member" : "Back to consent"}</Button>{record && <Button variant="contained" color="success" onClick={printRecord}>Print / Save PDF</Button>}</Stack>}
      />

      {loading ? <Box sx={{ minHeight: 320, display: "flex", justifyContent: "center", alignItems: "center" }}><CircularProgress color="success" /></Box> : <>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        {record && <Stack spacing={3} data-testid={`consent-record-page-${record.id}`}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", rowGap: 1 }}>
              <Chip label={record.type === "youth" ? "Youth Consent" : "Scouter ES3"} color="secondary" />
              {record.section && <Chip label={record.section} variant="outlined" />}
              {record.type === "youth" && !record.memberId && <Chip label="Not linked to member" color="warning" />}
              {record.updatedByParent && <Chip label="Updated by parent" color="success" />}
              {record.hasMedicalAlert && <Chip label="Medical information present" color="warning" />}
              {record.hasMedicationManagement && <Chip label="Medication management required" color="error" />}
            </Stack>
          </Paper>
          {record.updatedByParent && <Alert severity="success">This record was updated through the Parent Portal on {formatDate(record.parentUpdatedAt || record.updatedAt)}.</Alert>}
          {record.type === "youth" && !record.memberId && <Alert severity="warning">This youth consent record is not linked to a canonical member. Super Admin can reconcile it below; ambiguous records are never guessed automatically.</Alert>}
          {record.type === "youth" && superAdmin && <Paper variant="outlined" sx={{ p: 3 }} data-testid="consent-reconciliation">
            <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Super Admin reconciliation</Typography>
            <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>If this consent is for a new member, create the canonical member directly from the verified identity/contact fields below. If the member already exists, choose that canonical member instead. Medical details remain on the consent record.</Typography>
            {!record.memberId && <Button variant="contained" color="success" disabled={creatingMember || reconciling} onClick={() => void createMember()} sx={{ mb: 2 }}>{creatingMember ? "Creating member…" : "Create new member from consent"}</Button>}
            <TextField select fullWidth label="Canonical member" value={candidateId} onChange={(event) => { setCandidateId(event.target.value); setConfirmCorrection(false); }}>
              <MenuItem value="">Select member</MenuItem>
              {candidates.map((candidate) => <MenuItem key={candidate.id} value={candidate.id}>{candidate.displayName} · {candidate.dateOfBirth || "DOB unavailable"} · {candidate.section || "No section"} · {candidate.parentName || candidate.emailAddress || candidate.mobileNumber || candidate.id}</MenuItem>)}
            </TextField>
            <TextField fullWidth label="Reconciliation reason" value={reason} onChange={(event) => setReason(event.target.value)} helperText="Record why this identity match is correct. Do not enter medical details." sx={{ mt: 2 }} />
            {record.memberId && candidateId && record.memberId !== candidateId && <FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={confirmCorrection} onChange={(event) => setConfirmCorrection(event.target.checked)} />} label={`I confirm this replaces existing member relationship ${record.memberId}.`} />}
            <Button variant="contained" color="success" disabled={reconciling || !candidateId || !reason.trim() || Boolean(record.memberId && record.memberId !== candidateId && !confirmCorrection)} onClick={() => void reconcile()} sx={{ mt: 2 }}>{reconciling ? "Saving…" : record.memberId ? "Correct relationship" : "Confirm member match"}</Button>
          </Paper>}
          <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderWidth: 2, borderColor: hasImportantMedicalInformation(record) ? "warning.main" : "divider" }}>
            <Typography variant="h4" component="h2" color="secondary" sx={{ fontWeight: 800 }}>Important medical information</Typography>
            <Typography sx={{ mt: 1 }}>{hasImportantMedicalInformation(record) ? "Medical or medication information is recorded below. Review the recorded details and established action information." : "No medical alert or medication-management requirement is recorded in this consent summary."}</Typography>
          </Paper>
          {medicalPresentationGroups(record, formatFieldName, displayValue).map((group) => group.items.length > 0 && <Box component="section" key={group.id} aria-labelledby={`medical-group-${group.id}`}>
            <Typography id={`medical-group-${group.id}`} variant="h5" component="h2" color="secondary" sx={{ fontWeight: 800, mb: 1.5 }}>{group.heading}</Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: 2, minWidth: 0 }}>
              {group.items.map(({ key, label, value }) => <Paper key={key} variant="outlined" sx={{ p: 2.5, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{label}</Typography>
                <Typography sx={{ mt: .5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{displayValue(value)}</Typography>
              </Paper>)}
            </Box>
          </Box>)}
          {normalizeMedicationManagement(record.data.medicationManagement) && <Box component="section" aria-labelledby="medication-management-heading">
            <Typography id="medication-management-heading" variant="h5" component="h2" color="secondary" sx={{ fontWeight: 800, mb: 1.5 }}>Medication administration</Typography>
            <MedicationManagementPanel value={record.data.medicationManagement} />
          </Box>}
        </Stack>}
      </>}
    </Container>
  </Box>;
}
