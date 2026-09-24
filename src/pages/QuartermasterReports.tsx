import { Alert, Box, CircularProgress, Container } from "@mui/material";
import { useEffect, useState } from "react";
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
        console.error("Unable to load QM reports:", loadError);
        if (!cancelled) setError("Unable to load Quartermaster / Bo’sun reports.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 3, md: 5 } }}>
    <Container maxWidth="xl" data-testid="page-qm-reports">
      <LeaderDashboardHeader />
      <LeaderPageHeader title="QM Reports" />
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
