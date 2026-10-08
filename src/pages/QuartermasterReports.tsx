import { applicationErrorMessage } from "../services/applicationErrors.ts";
import { Alert, Box, Button, CircularProgress, Container } from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EquipmentReportsPanel from "../components/admin/EquipmentReportsPanel";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { loadEquipmentItems } from "../services/equipment";
import type { EquipmentItem } from "../services/equipment";
import { loadEquipmentIncidents } from "../services/equipmentIncidents";
import type { EquipmentIncident } from "../services/equipmentIncidents";
import { loadEquipmentLoans } from "../services/equipmentLoans";
import type { EquipmentLoan } from "../services/equipmentLoans";
import { canManageEquipment } from "../services/equipmentLogic";

export default function QuartermasterReports() {
  const { adminProfile } = useAdminAuth();
  const canManage = canManageEquipment(adminProfile);
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loans, setLoans] = useState<EquipmentLoan[]>([]);
  const [incidents, setIncidents] = useState<EquipmentIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!canManage) { setLoading(false); return; }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const [nextItems, nextLoans, nextIncidents] = await Promise.all([
          loadEquipmentItems(),
          loadEquipmentLoans(),
          loadEquipmentIncidents()
        ]);
        if (!cancelled) {
          setItems(nextItems);
          setLoans(nextLoans);
          setIncidents(nextIncidents);
        }
      } catch (loadError) {
        if (!cancelled) setError(applicationErrorMessage(loadError, "Unable to load Quartermaster / Bo’sun reports.", "QuartermasterReports"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [canManage]);

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 3, md: 5 } }}>
    <Container maxWidth="xl" data-testid="page-qm-reports">
      <LeaderDashboardHeader />
      <LeaderPageHeader title="QM Reports" />
      <Button component={Link} to="/leader/equipment?view=quartermaster" variant="outlined" color="secondary" sx={{ mb: 2, minHeight: 44, width: { xs: "100%", sm: "auto" }, whiteSpace: "nowrap" }}>Back to Equipment &amp; Stores</Button>
      {!canManage ? (
        <Alert severity="error">Quartermaster / Bo’sun equipment-management access is required.</Alert>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : loading ? (
        <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}><CircularProgress color="success" /></Box>
      ) : (
        <Box data-testid="qm-report-content">
          <EquipmentReportsPanel items={items} loans={loans} incidents={incidents} canManage={canManage} />
        </Box>
      )}
    </Container>
  </Box>;
}
