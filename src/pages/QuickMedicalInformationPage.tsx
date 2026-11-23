import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import { Alert, Box, Button, Chip, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import ActionLinkButton from "../components/ActionLinkButton";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { applicationErrorMessage } from "../services/applicationErrors";
import { loadConsentAdminRecord } from "../services/consentAdmin";
import { displayValue, formatFieldName, normalizeMedicationManagement } from "../services/consentManagementLogic";
import { readMemberMedical, type MemberMedicalRecord } from "../services/memberMedical";
import { medicalPresentationGroups } from "../services/medicalPresentation";

type OriginState = { returnTo?: unknown; returnLabel?: unknown };

function textValue(record: MemberMedicalRecord, key: string) {
  return displayValue(record.data[key]).trim();
}

export default function QuickMedicalInformationPage() {
  const { consentId = "" } = useParams();
  const location = useLocation();
  const [record, setRecord] = useState<MemberMedicalRecord | null>(null);
  const [fullConsentAvailable, setFullConsentAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const origin = (location.state ?? null) as OriginState | null;
  const returnTo = typeof origin?.returnTo === "string" && origin.returnTo.startsWith("/leader/") ? origin.returnTo : "/leader/consents";
  const returnLabel = typeof origin?.returnLabel === "string" && origin.returnLabel.trim() ? origin.returnLabel : "Back to Consent Management";

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(""); setRecord(null); setFullConsentAvailable(false);
    const load = async () => {
      const consent = await loadConsentAdminRecord(consentId);
      if (consent) return { record: consent, fullConsent: true };
      const result = await readMemberMedical<{ record: MemberMedicalRecord }>(consentId);
      return { record: result.record, fullConsent: false };
    };
    void load().then(({ record: found, fullConsent }) => {
      if (cancelled) return;
      setRecord(found);
      setFullConsentAvailable(fullConsent);
    }).catch((failure) => {
      if (!cancelled) setError(applicationErrorMessage(failure, "Unable to load quick medical information.", "QuickMedicalInformationPage"));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [consentId]);

  const conditions = useMemo(() => record ? medicalPresentationGroups(record, formatFieldName, displayValue)
    .filter((group) => group.id === "immediate" || group.id === "ongoing" || (!fullConsentAvailable && group.id !== "contacts"))
    .flatMap((group) => group.items) : [], [record, fullConsentAvailable]);
  const medication = record ? normalizeMedicationManagement(record.data.medicationManagement) : null;
  const medications: Record<string, unknown>[] = Array.isArray(medication?.medications) && medication.medications.length
    ? medication.medications.map(normalizeMedicationManagement).filter((entry): entry is Record<string, unknown> => entry !== null)
    : medication ? [medication] : [];
  const contacts = record ? [
    { name: textValue(record, "parent1Name"), phones: [textValue(record, "mobile1"), textValue(record, "homePhone"), textValue(record, "workPhone")].filter(Boolean) },
    { name: textValue(record, "parent2Name"), phones: [textValue(record, "mobile2")].filter(Boolean) },
    { name: textValue(record, "altContactName"), phones: [textValue(record, "altContactPhone")].filter(Boolean) }
  ].filter((contact) => contact.name || contact.phones.length) : [];

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="md">
      <LeaderDashboardHeader />
      <Button component={Link} to={returnTo} startIcon={<ArrowBackIcon />} sx={{ mb: 2, minHeight: 44 }}>{returnLabel}</Button>
      <LeaderPageHeader title="Quick Medical Information" description="Read-only emergency information from the member's canonical consent record." />
      {loading ? <Box sx={{ minHeight: 320, display: "grid", placeItems: "center" }}><CircularProgress color="success" /></Box> : error ? <Alert severity="error">{error}</Alert> : record && <Stack spacing={2.5} data-testid={`quick-medical-${record.id}`}>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderWidth: 2, borderColor: "warning.main" }}>
          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <MedicalServicesIcon color="warning" aria-hidden="true" />
            <Typography variant="h4" component="h1" color="secondary" sx={{ fontWeight: 800 }}>{record.memberName}</Typography>
            {record.section && <Chip label={record.section} variant="outlined" />}
          </Stack>
        </Paper>

        <Box component="section" aria-labelledby="quick-medical-conditions">
          <Typography id="quick-medical-conditions" variant="h5" color="secondary" sx={{ fontWeight: 800, mb: 1 }}>Medical conditions</Typography>
          {conditions.length ? <Stack spacing={1}>{conditions.map((item) => <Paper key={item.key} variant="outlined" sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>{item.label}</Typography>
            <Typography sx={{ mt: .5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{displayValue(item.value)}</Typography>
          </Paper>)}</Stack> : <Alert severity="info">No recorded medical condition or critical medical information is present.</Alert>}
        </Box>

        <Box component="section" aria-labelledby="quick-medication">
          <Typography id="quick-medication" variant="h5" color="secondary" sx={{ fontWeight: 800, mb: 1 }}>Medication</Typography>
          {medication?.enabled ? <Paper variant="outlined" sx={{ p: 2 }} data-testid="quick-medication-details">
            {medications.map((entry, index) => <Box key={index} sx={{ mb: 2 }}>{[["Medicine", entry.medicineName], ["Dosage", entry.dosage], ["Frequency", entry.frequency], ["Method", entry.method], ["Self administration", entry.selfAdmin], ["Instructions", entry.otherInfo]].filter(([, value]) => String(value ?? "").trim()).map(([label, value]) => <Box key={String(label)} sx={{ mb: 1.25 }}><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>{String(label)}</Typography><Typography sx={{ overflowWrap: "anywhere" }}>{String(value)}</Typography></Box>)}</Box>)}
          </Paper> : <Alert severity="info">No medication-management requirement is recorded.</Alert>}
        </Box>

        {fullConsentAvailable && <Box component="section" aria-labelledby="quick-contacts">
          <Typography id="quick-contacts" variant="h5" color="secondary" sx={{ fontWeight: 800, mb: 1 }}>Parents / guardians</Typography>
          {contacts.length ? <Stack spacing={1}>{contacts.map((contact, index) => <Paper key={`${contact.name}-${index}`} variant="outlined" sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 800 }}>{contact.name || "Emergency contact"}</Typography>
            {contact.phones.map((phone) => <ActionLinkButton key={phone} href={`tel:${phone.replace(/\s+/g, "")}`} sx={{ display: "flex", width: "fit-content", mt: .5 }}>{phone}</ActionLinkButton>)}
          </Paper>)}</Stack> : <Alert severity="warning">No parent/guardian telephone details are recorded in this consent record.</Alert>}
        </Box>}

        {fullConsentAvailable && <Button component={Link} to={`/leader/consents/${record.id}`} state={{ fromMemberPath: returnTo.startsWith("/leader/members/") ? returnTo : undefined }} variant="outlined" color="secondary">Open full consent / medical record</Button>}
      </Stack>}
    </Container>
  </Box>;
}
