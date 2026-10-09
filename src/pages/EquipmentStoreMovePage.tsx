import { applicationErrorMessage } from "../services/applicationErrors.ts";
import { Alert, Box, Button, Chip, Container, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { loadEquipmentItem, loadEquipmentItems, loadEquipmentOptions } from "../services/equipment";
import type { EquipmentItem } from "../services/equipment";
import { moveEquipmentStock } from "../services/equipmentHistory";
import { availableEquipmentQuantity } from "../services/equipmentLoanLogic";
import { canManageEquipment } from "../services/equipmentLogic";

export default function EquipmentStoreMovePage() {
  const { equipmentId = "" } = useParams();
  const navigate = useNavigate();
  const { adminProfile } = useAdminAuth();
  const canManage = canManageEquipment(adminProfile);
  const [item, setItem] = useState<EquipmentItem | null>(null);
  const [stores, setStores] = useState<string[]>([]);
  const [destination, setDestination] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    setLoading(true);
    setItem(null);
    setError("");
    void Promise.all([loadEquipmentItem(equipmentId), loadEquipmentItems(), loadEquipmentOptions("locations")])
      .then(([loadedItem, allItems, storeOptions]) => {
        if (!current) return;
        setItem(loadedItem);
        setStores(Array.from(new Set([...storeOptions.map((option) => option.name), ...allItems.map((candidate) => candidate.location).filter(Boolean)])).sort((a, b) => a.localeCompare(b)));
        setQuantity(loadedItem ? availableEquipmentQuantity(loadedItem) : 0);
      })
      .catch((loadError) => {
        if (current) setError(applicationErrorMessage(loadError, "Unable to load the equipment store move.", "EquipmentStoreMovePage"));
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [equipmentId]);

  const destinations = useMemo(() => stores.filter((store) => item && store.toLocaleLowerCase() !== item.location.toLocaleLowerCase()), [item, stores]);
  const recordPath = `/leader/equipment/${encodeURIComponent(equipmentId)}`;

  const submit = async () => {
    if (!item || !canManage) return;
    if (!destination) { setError("Choose a destination store."); return; }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > availableEquipmentQuantity(item)) {
      setError(`Enter a quantity between 1 and ${availableEquipmentQuantity(item)}.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const destinationItemId = await moveEquipmentStock(item, quantity, destination);
      navigate(recordPath, { replace: true, state: { storeMove: { itemId: item.id, destination, quantity, destinationItemId } } });
    } catch (saveError) {
      setError(applicationErrorMessage(saveError, "Unable to move that equipment stock.", "EquipmentStoreMovePage"));
    } finally {
      setSaving(false);
    }
  };

  return <Box data-testid="equipment-store-move-workflow" sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 2, md: 5 } }}>
    <Container maxWidth="md">
      <LeaderDashboardHeader />
      <LeaderPageHeader title={item ? `Move Store · ${item.name}` : "Move Store"} description="Move available stock and keep the item’s movement in its audit history." />
      {loading ? <Alert severity="info" role="status">Loading equipment store move…</Alert> : !item ? <><Alert severity="error">{error || "Equipment record not found or unavailable."}</Alert><Button component={Link} to="/leader/equipment" variant="outlined" color="secondary" sx={{ mt: 2, minHeight: 44 }}>Back to Equipment &amp; Stores</Button></> : <>
      <Button component={Link} to={recordPath} variant="outlined" color="secondary" sx={{ mb: 2, minHeight: 44 }}>Back to equipment record</Button>
      {!canManage && <Alert severity="warning" sx={{ mb: 2 }}>You are not authorised to move equipment between stores.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper data-testid="equipment-store-move-target" data-equipment-id={item.id} variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Chip label={item.name} />
            <Chip label={`Current store: ${item.location || "Unassigned"}`} variant="outlined" />
            <Chip label={`${availableEquipmentQuantity(item)} available`} variant="outlined" />
          </Stack>
          {item.archived ? <Alert severity="warning">Archived equipment cannot be moved. Restore it first.</Alert> : destinations.length === 0 ? <Alert severity="info">Add another store before moving this item.</Alert> : <>
            <FormControl fullWidth disabled={!canManage || saving}>
              <InputLabel id="equipment-move-destination-label">Destination store</InputLabel>
              <Select labelId="equipment-move-destination-label" label="Destination store" value={destination} onChange={(event) => setDestination(event.target.value)}>
                {destinations.map((store) => <MenuItem key={store} value={store}>{store}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Quantity to move" type="number" value={quantity} disabled={!canManage || saving || item.archived} onChange={(event) => setQuantity(event.target.value === "" ? 0 : Number(event.target.value))} slotProps={{ htmlInput: { min: 1, max: availableEquipmentQuantity(item), step: 1 } }} helperText="A partial move creates a separate destination stock record; moving all available stock keeps this record ID." fullWidth />
          </>}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="contained" color="success" disabled={!canManage || saving || item.archived || destinations.length === 0 || !destination || quantity < 1 || quantity > availableEquipmentQuantity(item) || !Number.isInteger(quantity)} onClick={() => void submit()}>{saving ? "Moving…" : "Move Store"}</Button>
            <Button variant="outlined" disabled={saving} onClick={() => navigate(recordPath)}>Cancel</Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">Equipment record: {item.id}</Typography>
        </Stack>
      </Paper>
      </>}
    </Container>
  </Box>;
}
