import { applicationErrorMessage } from "../services/applicationErrors.ts";
import { Alert, Box, Chip, Container, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import EquipmentLoansPanel from "../components/admin/EquipmentLoansPanel";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { loadEquipmentItems } from "../services/equipment";
import type { EquipmentItem } from "../services/equipment";
import { loadEquipmentLoans } from "../services/equipmentLoans";
import type { EquipmentLoan } from "../services/equipmentLoans";
import { availableEquipmentQuantity, canUseEquipmentForSection } from "../services/equipmentLoanLogic";

export default function ProgrammeEquipment() {
  const { user, adminProfile } = useAdminAuth();
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loans, setLoans] = useState<EquipmentLoan[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [nextItems, nextLoans] = await Promise.all([loadEquipmentItems(), loadEquipmentLoans()]);
      setItems(nextItems);
      setLoans(nextLoans);
    } catch (loadError) {
      setError(applicationErrorMessage(loadError, "Unable to load Programme Equipment right now.", "ProgrammeEquipment"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const matchingItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => !item.archived && (!term || [item.name, item.category, item.location].join(" ").toLowerCase().includes(term)));
  }, [items, search]);
  const sectionLoans = useMemo(() => loans.filter((loan) => canUseEquipmentForSection(adminProfile, loan.section)), [adminProfile, loans]);

  return <Box data-testid="page-programme-equipment" sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 3, md: 5 } }}>
    <Container maxWidth="xl">
      <LeaderDashboardHeader />
      <LeaderPageHeader title="Programme Equipment" />
      <Typography color="text.secondary" sx={{ mb: 2 }}>Check equipment out for your section and return it here. Your Scouter account is recorded on each checkout and return.</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <TextField
        fullWidth
        label="Search equipment"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        sx={{ mb: 2 }}
        slotProps={{ htmlInput: { "data-testid": "programme-equipment-search" } }}
      />
      {loading ? <Alert severity="info">Loading equipment…</Alert> : matchingItems.length === 0 ? <Alert severity="info">{items.length === 0 ? "No equipment has been added yet." : "No equipment matches that search."}</Alert> : <>
        <Stack spacing={1} sx={{ mb: 2 }} data-testid="programme-equipment-availability">
          {matchingItems.map((item) => {
            const available = availableEquipmentQuantity(item);
            return <Paper key={item.id} data-testid={`programme-equipment-item-${item.id}`} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                <Box><Typography sx={{ fontWeight: 700 }}>{item.name}</Typography><Typography variant="body2" color="text.secondary">{item.category} · {item.location || "No Store assigned"}</Typography></Box>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                  <Chip label={available > 0 ? `Available · ${available}` : "Unavailable"} color={available > 0 ? "success" : "default"} variant="outlined" />
                  {item.checkedOutQuantity > 0 && <Chip label={`Checked out · ${item.checkedOutQuantity}`} variant="outlined" />}
                  {item.unavailableQuantity > 0 && <Chip label={`Unavailable · ${item.unavailableQuantity}`} color="warning" variant="outlined" />}
                </Stack>
              </Stack>
            </Paper>;
          })}
        </Stack>
        <EquipmentLoansPanel profile={adminProfile} items={matchingItems} loans={sectionLoans} currentUserUid={user?.uid ?? ""} onChanged={refresh} onError={setError} />
      </>}
    </Container>
  </Box>;
}
