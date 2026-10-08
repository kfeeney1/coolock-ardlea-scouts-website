import { applicationErrorMessage } from "../services/applicationErrors.ts";
import { Alert, Box, Button, CircularProgress, Container } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import EquipmentIncidentsPanel from "../components/admin/EquipmentIncidentsPanel";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { loadEquipmentItems } from "../services/equipment";
import type { EquipmentItem } from "../services/equipment";
import { loadEquipmentIncidents } from "../services/equipmentIncidents";
import type { EquipmentIncident } from "../services/equipmentIncidents";
import { loadEquipmentLoans } from "../services/equipmentLoans";
import type { EquipmentLoan } from "../services/equipmentLoans";

export default function EquipmentIssuesPage() {
  const { adminProfile } = useAdminAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view");
  const issueId = searchParams.get("issue");
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loans, setLoans] = useState<EquipmentLoan[]>([]);
  const [incidents, setIncidents] = useState<EquipmentIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const [nextItems, nextLoans, nextIncidents] = await Promise.all([
        loadEquipmentItems(), loadEquipmentLoans(), loadEquipmentIncidents()
      ]);
      setItems(nextItems);
      setLoans(nextLoans);
      setIncidents(nextIncidents);
    } catch (loadError) {
      setError(applicationErrorMessage(loadError, "Unable to load equipment issues right now.", "EquipmentIssuesPage"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(false); }, [refresh]);

  const equipmentUrl = `/leader/equipment${view ? `?view=${encodeURIComponent(view)}` : ""}`;
  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 3, md: 5 } }}>
    <Container maxWidth="xl" data-testid="page-qm-equipment-issues">
      <LeaderDashboardHeader />
      <LeaderPageHeader title="Broken, lost & missing equipment" />
      <Button variant="outlined" sx={{ mb: 2 }} onClick={() => navigate(equipmentUrl)}>Back to Equipment &amp; Stores</Button>
      {error ? <Alert severity="error" role="alert">{error}</Alert> : loading ? (
        <Box sx={{ minHeight: 240, display: "grid", placeItems: "center" }}><CircularProgress color="success" aria-label="Loading equipment issues" /></Box>
      ) : <EquipmentIncidentsPanel
        profile={adminProfile}
        items={items}
        loans={loans}
        incidents={incidents}
        highlightedIncidentId={issueId}
        onChanged={refresh}
        onError={setError}
      />}
    </Container>
  </Box>;
}
