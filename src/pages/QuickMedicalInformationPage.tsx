import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MedicalServicesIcon from "@mui/icons-material/MedicalServices";
import { Alert, Box, Button, Chip, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { applicationErrorMessage } from "../services/applicationErrors";
import { loadConsentAdminRecord, type ConsentAdminRecord } from "../services/consentAdmin";
import { displayValue, formatFieldName, normalizeMedicationManagement } from "../services/consentManagementLogic";
import { medicalPresentationGroups } from "../services/medicalPresentation";

type OriginState = { returnTo?: unknown; returnLabel?: unknown };

function textValue(record: ConsentAdminRecord, key: string) {
  return displayValue(record.data[key]).trim();
}

export default function QuickMedicalInformationPage() {
  const { consentId = "" } = useParams();
  const location = useLocation();
  const [record, setRecord] = useState<ConsentAdminRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const origin = (location.state ?? null) as OriginState | null;
  const returnTo = typeof origin?.returnTo === "string" && origin.returnTo.startsWith("/leader/") ? origin.returnTo : "/leader/consents";
  const returnLabel = typeof origin?.returnLabel === "string" && origin.returnLabel.trim() ? origin.returnLabel : "Back to Consent Management";

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    void loadConsentAdminRecord(consentId).then((found) => {
      if (cancelled) return;
      setRecord(found);
      if (!found) setError("Quick medical information is unavailable or outside your permitted sections.");
    }).catch((failure) => {
      if (!cancelled) setError(applicationErrorMessage(failure, "Unable to load quick medical information.", "QuickMedicalInformationPage"));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [consentId]);

  const conditions = useMemo(() => record ? medicalPresentationGroups(record, formatFieldName, displayValue)
    .filter((group) => group.id === "immediate" || group.id === "ongoing")
    .flatMap((group) => group.items) : [], [record]);
  const medication = record ? normalizeMedicationManagement(record.data.medicationManagement) : null;
  const contacts = record ? [
    { name: textValue(record, "parent1Name"), phones: [textValue(record, "mobile1"), textValue(record, "homePhone"), textValue(record, "workPhone")].filter(Boolean) },
    { name: textValue(record, "parent2Name"), phones: [textValue(record, "mobile2")].filter(Boolean) },
    { name: textValue(record, "altContactName"), phones: [textValue(record, "altContactPhone")].filter(Boolean) }
  ].filter((contact) => contact.name || contact.phones.length) : [];

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="md">
      <LeaderDashboardHeader />
      <Button component={Link} to={returnTo} startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>{returnLabel}</Button>
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
            {[["Medicine", medication.medicineName], ["Dosage", medication.dosage], ["Frequency", medication.frequency], ["Method", medication.method], ["Self administration", medication.selfAdmin], ["Instructions", medication.otherInfo]].filter(([, value]) => String(value ?? "").trim()).map(([label, value]) => <Box key={String(label)} sx={{ mb: 1.25 }}><Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>{label}</Typography><Typography sx={{ overflowWrap: "anywhere" }}>{String(value)}</Typography></Box>)}
          </Paper> : <Alert severity="info">No medication-management requirement is recorded.</Alert>}
        </Box>

        <Box component="section" aria-labelledby="quick-contacts">
          <Typography id="quick-contacts" variant="h5" color="secondary" sx={{ fontWeight: 800, mb: 1 }}>Parents / guardians</Typography>
          {contacts.length ? <Stack spacing={1}>{contacts.map((contact, index) => <Paper key={`${contact.name}-${index}`} variant="outlined" sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 800 }}>{contact.name || "Emergency contact"}</Typography>
            {contact.phones.map((phone) => <Typography key={phone} component="a" href={`tel:${phone.replace(/\s+/g, "")}`} sx={{ display: "block", mt: .5, overflowWrap: "anywhere" }}>{phone}</Typography>)}
          </Paper>)}</Stack> : <Alert severity="warning">No parent/guardian telephone details are recorded in this consent record.</Alert>}
        </Box>

        <Button component={Link} to={`/leader/consents/${record.id}`} state={{ fromMemberPath: returnTo.startsWith("/leader/members/") ? returnTo : undefined }} variant="outlined" color="secondary">Open full consent / medical record</Button>
      </Stack>}
    </Container>
  </Box>;
}
