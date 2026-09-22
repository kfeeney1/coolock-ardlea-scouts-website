import {
  Alert, Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import EquipmentHistoryDialog from "../components/admin/EquipmentHistoryDialog";
import EquipmentIncidentsPanel from "../components/admin/EquipmentIncidentsPanel";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { loadEquipmentIncidents } from "../services/equipmentIncidents";
import type { EquipmentIncident } from "../services/equipmentIncidents";
import {
  loadEquipmentItem, loadEquipmentItems, loadEquipmentOptions, setEquipmentArchived, updateEquipmentItem
} from "../services/equipment";
import type { EquipmentItem, EquipmentItemInput } from "../services/equipment";
import { loadEquipmentLoans } from "../services/equipmentLoans";
import type { EquipmentLoan } from "../services/equipmentLoans";
import { canManageEquipment, DEFAULT_EQUIPMENT_CATEGORIES, normaliseEquipmentLabel } from "../services/equipmentLogic";
import { numericInputDisplayValue, parseOptionalNumberInput } from "../services/numericInput";

type FormState = Omit<EquipmentItemInput, "totalQuantity"> & { totalQuantity: number | null };

export default function EquipmentRecordPage() {
  const { equipmentId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { adminProfile } = useAdminAuth();
  const canManage = canManageEquipment(adminProfile);
  const [item, setItem] = useState<EquipmentItem | null>(null);
  const [loans, setLoans] = useState<EquipmentLoan[]>([]);
  const [incidents, setIncidents] = useState<EquipmentIncident[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const [nextItem, nextItems, nextLoans, nextIncidents, categoryOptions, locationOptions] = await Promise.all([
        loadEquipmentItem(equipmentId), loadEquipmentItems(), loadEquipmentLoans(), loadEquipmentIncidents(),
        loadEquipmentOptions("categories"), loadEquipmentOptions("locations")
      ]);
      setItem(nextItem);
      setLoans(nextLoans);
      setIncidents(nextIncidents);
      setCategories(Array.from(new Set([...DEFAULT_EQUIPMENT_CATEGORIES.filter((x) => x !== "Other"), ...categoryOptions.map((x) => x.name)])).sort());
      setLocations(Array.from(new Set([...locationOptions.map((x) => x.name), ...nextItems.map((x) => x.location).filter(Boolean)])).sort());
      if (nextItem && !editing) setForm({
        name: nextItem.name, category: nextItem.category, trackingMode: nextItem.trackingMode,
        totalQuantity: nextItem.totalQuantity, location: nextItem.location, condition: nextItem.condition,
        notes: nextItem.notes, replacementValue: nextItem.replacementValue
      });
    } catch (e) {
      console.error(e);
      setError("Unable to load this equipment record.");
    } finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, [equipmentId]);
  const itemIncidents = useMemo(() => incidents.filter((x) => x.itemId === equipmentId), [incidents, equipmentId]);
  const highlightedIssueId = searchParams.get("issue");

  const save = async () => {
    if (!item || !form || !canManage) return;
    setError(""); setFeedback("");
    const name = normaliseEquipmentLabel(form.name);
    if (!name) return setError("Enter an equipment name.");
    if (form.totalQuantity === null || !Number.isInteger(form.totalQuantity) || form.totalQuantity < item.checkedOutQuantity + item.unavailableQuantity) {
      return setError(`Total quantity cannot be below ${item.checkedOutQuantity + item.unavailableQuantity} while stock is checked out or unavailable.`);
    }
    setSaving(true);
    try {
      await updateEquipmentItem(item.id, { ...form, name, totalQuantity: form.totalQuantity });
      setEditing(false); setFeedback("Equipment record saved."); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save equipment."); }
    finally { setSaving(false); }
  };

  const changeArchiveState = async () => {
    if (!item || !canManage) return;
    setSaving(true); setError(""); setFeedback("");
    try {
      await setEquipmentArchived(item, !item.archived);
      setConfirmArchive(false);
      setFeedback(item.archived ? "Equipment restored to active inventory." : "Equipment archived. It remains available through the archived inventory view.");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update archive state."); }
    finally { setSaving(false); }
  };

  if (loading && !item) return <Container maxWidth="lg" sx={{ py: 4 }}><Alert severity="info">Loading equipment record…</Alert></Container>;
  if (!item || !form) return <Container maxWidth="lg" sx={{ py: 4 }}><Alert severity="error">Equipment record not found.</Alert><Button sx={{ mt: 2 }} onClick={() => navigate("/leader/equipment")}>Back to Equipment</Button></Container>;

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 3, md: 5 } }}><Container maxWidth="lg">
    <LeaderDashboardHeader />
    <LeaderPageHeader title={item.name} description="Equipment record, condition, history, Store movement and issue reporting." />
    <Button variant="outlined" sx={{ mb: 2 }} onClick={() => navigate(-1)}>Back</Button>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {feedback && <Alert severity="success" sx={{ mb: 2 }}>{feedback}</Alert>}
    {item.archived && <Alert severity="warning" sx={{ mb: 2 }}>This record is archived. Restore it before editing or using it in active equipment workflows.</Alert>}

    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <Button variant="outlined" onClick={() => setHistoryOpen(true)}>History</Button>
          {canManage && !item.archived && <Button variant="outlined" onClick={() => setHistoryOpen(true)}>Move Store</Button>}
          {canManage && !item.archived && <Button variant="contained" onClick={() => setEditing(true)}>Edit</Button>}
          {canManage && <Button variant="outlined" color={item.archived ? "success" : "warning"} disabled={!item.archived && (item.checkedOutQuantity > 0 || item.unavailableQuantity > 0)} onClick={() => setConfirmArchive(true)}>{item.archived ? "Restore" : "Archive"}</Button>}
        </Stack>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Chip label={item.category} /><Chip label={`Store: ${item.location || "Unassigned"}`} />
          <Chip label={`${item.totalQuantity} total`} color="primary" />
          <Chip label={`${item.checkedOutQuantity} checked out`} variant="outlined" />
          <Chip label={`${item.unavailableQuantity} unavailable`} variant="outlined" color={item.unavailableQuantity ? "warning" : "default"} />
          {item.archived && <Chip label="Archived" />}
        </Stack>
        {!editing ? <>
          <Typography><strong>Condition:</strong> {item.condition.replace("-", " ")}</Typography>
          <Typography><strong>Tracking:</strong> {item.trackingMode === "individual" ? "Individual assets" : "Quantity"}</Typography>
          <Typography><strong>Replacement value:</strong> {item.replacementValue === null ? "Not recorded" : `€${item.replacementValue.toFixed(2)}`}</Typography>
          <Typography><strong>Notes:</strong> {item.notes || "None"}</Typography>
        </> : <Stack spacing={2}>
          <TextField label="Equipment name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <FormControl><InputLabel>Category</InputLabel><Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl>
          <FormControl disabled><InputLabel>Store</InputLabel><Select label="Store" value={form.location}>{locations.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</Select></FormControl>
          <Typography variant="caption" color="text.secondary">Use History / move Store for Store changes so movement remains auditable.</Typography>
          <FormControl><InputLabel>Tracking</InputLabel><Select label="Tracking" value={form.trackingMode} onChange={(e) => setForm({ ...form, trackingMode: e.target.value as EquipmentItemInput["trackingMode"] })}><MenuItem value="quantity">Quantity</MenuItem><MenuItem value="individual">Individual assets</MenuItem></Select></FormControl>
          <TextField label="Total quantity" type="number" value={numericInputDisplayValue(form.totalQuantity)} onChange={(e) => setForm({ ...form, totalQuantity: parseOptionalNumberInput(e.target.value) })} slotProps={{ htmlInput: { min: item.checkedOutQuantity + item.unavailableQuantity, step: 1 } }} />
          <FormControl><InputLabel>Condition</InputLabel><Select label="Condition" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value as EquipmentItemInput["condition"] })}>{["not-recorded","good","needs-attention","repair","missing","lost","retired"].map((x) => <MenuItem key={x} value={x}>{x.replace("-", " ")}</MenuItem>)}</Select></FormControl>
          <TextField label="Replacement value (€)" type="number" value={form.replacementValue ?? ""} onChange={(e) => setForm({ ...form, replacementValue: e.target.value === "" ? null : Number(e.target.value) })} />
          <TextField label="Notes" multiline minRows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <Stack direction="row" spacing={1}><Button variant="contained" color="success" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save equipment"}</Button><Button disabled={saving} onClick={() => { setEditing(false); void refresh(); }}>Cancel</Button></Stack>
        </Stack>}
      </Stack>
    </Paper>

    {!item.archived && <EquipmentIncidentsPanel profile={adminProfile} items={[item]} loans={loans} incidents={itemIncidents} highlightedIncidentId={highlightedIssueId} onChanged={refresh} onError={setError} />}
    <EquipmentHistoryDialog item={historyOpen ? item : null} locations={locations} canManage={canManage && !item.archived} onClose={() => setHistoryOpen(false)} onChanged={refresh} onError={setError} />

    <Dialog open={confirmArchive} onClose={() => !saving && setConfirmArchive(false)}>
      <DialogTitle>{item.archived ? `Restore ${item.name}?` : `Archive ${item.name}?`}</DialogTitle>
      <DialogContent><Typography>{item.archived ? "This will return the existing record to active inventory with the same stable ID and history." : "This will remove the item from normal active inventory. Its history is retained and authorised users can restore it from the archived inventory view."}</Typography></DialogContent>
      <DialogActions><Button disabled={saving} onClick={() => setConfirmArchive(false)}>Cancel</Button><Button variant="contained" color={item.archived ? "success" : "warning"} disabled={saving} onClick={() => void changeArchiveState()}>{saving ? "Saving…" : item.archived ? "Restore equipment" : "Archive equipment"}</Button></DialogActions>
    </Dialog>
  </Container></Box>;
}
