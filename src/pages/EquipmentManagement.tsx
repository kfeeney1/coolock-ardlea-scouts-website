import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import EquipmentLoansPanel from "../components/admin/EquipmentLoansPanel";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import {
  addEquipmentOption,
  createEquipmentItem,
  deleteEquipmentOption,
  loadEquipmentItems,
  loadEquipmentOptions,
  setEquipmentArchived,
  updateEquipmentItem
} from "../services/equipment";
import type { EquipmentItem, EquipmentItemInput, EquipmentOption } from "../services/equipment";
import { loadEquipmentLoans } from "../services/equipmentLoans";
import type { EquipmentLoan } from "../services/equipmentLoans";
import { availableEquipmentQuantity } from "../services/equipmentLoanLogic";
import {
  canDeleteEquipmentOption,
  canManageEquipment,
  DEFAULT_EQUIPMENT_CATEGORIES,
  isDuplicateEquipmentLabel,
  normaliseEquipmentLabel
} from "../services/equipmentLogic";

const OTHER = "__other__";
const EMPTY_FORM: EquipmentItemInput = {
  name: "",
  category: "",
  trackingMode: "quantity",
  totalQuantity: 1,
  location: "",
  condition: "good",
  notes: "",
  replacementValue: null
};

export default function EquipmentManagement() {
  const { adminProfile } = useAdminAuth();
  const canManage = canManageEquipment(adminProfile);
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loans, setLoans] = useState<EquipmentLoan[]>([]);
  const [categories, setCategories] = useState<EquipmentOption[]>([]);
  const [locations, setLocations] = useState<EquipmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<EquipmentItem | null | undefined>(undefined);
  const [form, setForm] = useState<EquipmentItemInput>(EMPTY_FORM);
  const [newCategory, setNewCategory] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [manageLocationsOpen, setManageLocationsOpen] = useState(false);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [nextItems, nextLoans, nextCategories, nextLocations] = await Promise.all([
        loadEquipmentItems(),
        loadEquipmentLoans(),
        loadEquipmentOptions("categories"),
        loadEquipmentOptions("locations")
      ]);
      setItems(nextItems);
      setLoans(nextLoans);
      setCategories(nextCategories);
      setLocations(nextLocations);
    } catch (loadError) {
      console.error("Unable to load equipment:", loadError);
      setError("Unable to load Equipment & Stores right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const categoryNames = useMemo(() => Array.from(new Set([
    ...DEFAULT_EQUIPMENT_CATEGORIES.filter((item) => item !== "Other"),
    ...categories.map((item) => item.name)
  ])).sort((a, b) => a.localeCompare(b)), [categories]);
  const locationNames = useMemo(() => locations.map((item) => item.name), [locations]);
  const activeItems = useMemo(() => items.filter((item) => !item.archived), [items]);

  const visibleItems = useMemo(() => items.filter((item) => {
    if (!showArchived && item.archived) return false;
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (locationFilter !== "all" && item.location !== locationFilter) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [item.name, item.category, item.location, item.notes].join(" ").toLowerCase().includes(query);
  }), [items, search, categoryFilter, locationFilter, showArchived]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setNewCategory("");
    setNewLocation("");
  };

  const openEdit = (item: EquipmentItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      category: item.category,
      trackingMode: item.trackingMode,
      totalQuantity: item.totalQuantity,
      location: item.location,
      condition: item.condition,
      notes: item.notes,
      replacementValue: item.replacementValue
    });
    setNewCategory("");
    setNewLocation("");
  };

  const save = async () => {
    setError("");
    const name = normaliseEquipmentLabel(form.name);
    if (!name) return setError("Enter an equipment name.");
    if (!Number.isInteger(form.totalQuantity) || form.totalQuantity < 0) return setError("Quantity must be a whole number of zero or more.");
    if (editing && form.totalQuantity < editing.checkedOutQuantity) return setError(`At least ${editing.checkedOutQuantity} are currently checked out. Return stock before reducing the total below that number.`);
    if (form.replacementValue !== null && (!Number.isFinite(form.replacementValue) || form.replacementValue < 0)) return setError("Replacement value cannot be negative.");

    setSaving(true);
    try {
      let category = form.category;
      if (category === OTHER) {
        const safe = normaliseEquipmentLabel(newCategory);
        if (!safe) throw new Error("Enter the new category name.");
        if (isDuplicateEquipmentLabel(safe, categoryNames)) throw new Error("That category already exists. Select it from the list instead.");
        category = (await addEquipmentOption("categories", safe)).name;
      }

      let location = form.location;
      if (location === OTHER) {
        const safe = normaliseEquipmentLabel(newLocation);
        if (!safe) throw new Error("Enter the new storage location.");
        if (isDuplicateEquipmentLabel(safe, locationNames)) throw new Error("That location already exists. Select it from the list instead.");
        location = (await addEquipmentOption("locations", safe)).name;
      }
      if (!category || !location) throw new Error("Choose a category and storage location.");

      const payload = { ...form, name, category, location };
      if (editing) await updateEquipmentItem(editing.id, payload);
      else await createEquipmentItem(payload);
      setEditing(undefined);
      await refresh();
    } catch (saveError) {
      console.error("Unable to save equipment:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Unable to save the equipment item.");
    } finally {
      setSaving(false);
    }
  };

  const removeOption = async (kind: "categories" | "locations", option: EquipmentOption) => {
    const inUse = activeItems.map((item) => kind === "categories" ? item.category : item.location);
    if (!canDeleteEquipmentOption(option.name, inUse)) return;
    try {
      await deleteEquipmentOption(kind, option);
      await refresh();
    } catch (deleteError) {
      console.error(`Unable to delete equipment ${kind}:`, deleteError);
      setError(`Unable to delete that ${kind === "categories" ? "category" : "storage location"}.`);
    }
  };

  const toggleArchived = async (item: EquipmentItem) => {
    setError("");
    try {
      await setEquipmentArchived(item, !item.archived);
      await refresh();
    } catch (archiveError) {
      console.error("Unable to update equipment archive state:", archiveError);
      setError(archiveError instanceof Error ? archiveError.message : "Unable to update that equipment item.");
    }
  };

  const optionManager = (
    kind: "categories" | "locations",
    options: EquipmentOption[],
    open: boolean,
    close: () => void
  ) => <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
    <DialogTitle>Manage {kind === "categories" ? "custom categories" : "storage locations"}</DialogTitle>
    <DialogContent dividers>
      {options.length === 0 ? <Alert severity="info">No saved {kind === "categories" ? "custom categories" : "locations"} yet. Add one by choosing Other… when adding equipment.</Alert> : <Stack spacing={1.25}>{options.map((option) => {
        const values = activeItems.map((item) => kind === "categories" ? item.category : item.location);
        const usage = values.filter((value) => value.toLowerCase() === option.name.toLowerCase()).length;
        return <Paper key={option.id} variant="outlined" sx={{ p: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
          <Box><Typography sx={{ fontWeight: 700 }}>{option.name}</Typography><Typography variant="body2" color="text.secondary">{usage ? `${usage} equipment record${usage === 1 ? "" : "s"} currently use this ${kind === "categories" ? "category" : "location"}` : "Unused"}</Typography></Box>
          <Button color="error" disabled={!canDeleteEquipmentOption(option.name, values)} onClick={() => void removeOption(kind, option)}>Delete</Button>
        </Paper>;
      })}</Stack>}
    </DialogContent>
    <DialogActions><Button onClick={close}>Close</Button></DialogActions>
  </Dialog>;

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 3, md: 5 } }}>
    <Container maxWidth="xl">
      <LeaderPageHeader title="Equipment & Stores" description="Track stock, check equipment out to sections and record returns." />
      {!canManage && <Alert severity="info" sx={{ mb: 2 }}>You can view the group catalogue and check equipment in or out for your assigned section. Stock records remain restricted to the Quartermaster / Bo'sun, Group Leader and administrator roles.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && <EquipmentLoansPanel profile={adminProfile} items={items} loans={loans} onChanged={refresh} onError={setError} />}

      <Paper sx={{ p: { xs: 2, md: 3 }, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField fullWidth label="Search equipment" value={search} onChange={(event) => setSearch(event.target.value)} />
          <FormControl fullWidth><InputLabel>Category</InputLabel><Select label="Category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><MenuItem value="all">All categories</MenuItem>{categoryNames.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
          <FormControl fullWidth><InputLabel>Location</InputLabel><Select label="Location" value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}><MenuItem value="all">All locations</MenuItem>{locationNames.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</Select></FormControl>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} useFlexGap sx={{ mt: 2, flexWrap: "wrap" }}>
          {canManage && <Button variant="contained" color="success" onClick={openCreate}>Add equipment</Button>}
          {canManage && <Button variant="outlined" onClick={() => setManageLocationsOpen(true)}>Manage locations</Button>}
          {canManage && <Button variant="outlined" onClick={() => setManageCategoriesOpen(true)}>Manage categories</Button>}
          <Button variant="outlined" onClick={() => setShowArchived((value) => !value)}>{showArchived ? "Hide archived" : "Show archived"}</Button>
          <Button variant="outlined" onClick={() => void refresh()}>Refresh</Button>
        </Stack>
      </Paper>

      {loading ? <Alert severity="info">Loading equipment…</Alert> : visibleItems.length === 0 ? <Alert severity="info">No equipment matches the current filters.</Alert> : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
          {visibleItems.map((item) => {
            const available = availableEquipmentQuantity(item);
            return <Paper key={item.id} variant="outlined" sx={{ p: 2.5, opacity: item.archived ? 0.65 : 1 }}>
              <Stack spacing={1.25}>
                <Box><Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>{item.name}</Typography><Typography color="text.secondary">{item.category} · {item.location}</Typography></Box>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                  <Chip label={`${item.totalQuantity} total`} color="primary" />
                  <Chip label={`${available} available`} color={available === 0 ? "warning" : "success"} variant="outlined" />
                  {item.checkedOutQuantity > 0 && <Chip label={`${item.checkedOutQuantity} checked out`} variant="outlined" />}
                  <Chip label={item.trackingMode === "individual" ? "Individually tracked" : "Quantity tracked"} variant="outlined" />
                  <Chip label={item.condition.replace("-", " ")} variant="outlined" />
                  {item.archived && <Chip label="Archived" />}
                </Stack>
                {item.notes && <Typography variant="body2">{item.notes}</Typography>}
                {canManage && <Stack direction="row" spacing={1}><Button size="small" onClick={() => openEdit(item)}>Edit</Button><Button size="small" color={item.archived ? "success" : "warning"} disabled={!item.archived && item.checkedOutQuantity > 0} onClick={() => void toggleArchived(item)}>{item.archived ? "Restore" : "Archive"}</Button></Stack>}
              </Stack>
            </Paper>;
          })}
        </Box>
      )}

      <Dialog open={editing !== undefined} onClose={() => !saving && setEditing(undefined)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "Edit equipment" : "Add equipment"}</DialogTitle>
        <DialogContent dividers><Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField label="Equipment name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <FormControl><InputLabel>Category</InputLabel><Select label="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><MenuItem value=""><em>Select category</em></MenuItem>{categoryNames.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}<MenuItem value={OTHER}>Other…</MenuItem></Select></FormControl>
          {form.category === OTHER && <TextField label="New category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} autoFocus />}
          <FormControl><InputLabel>Storage location</InputLabel><Select label="Storage location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })}><MenuItem value=""><em>Select location</em></MenuItem>{locationNames.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}<MenuItem value={OTHER}>Other…</MenuItem></Select></FormControl>
          {form.location === OTHER && <TextField label="New storage location" value={newLocation} onChange={(event) => setNewLocation(event.target.value)} />}
          <FormControl><InputLabel>Tracking</InputLabel><Select label="Tracking" value={form.trackingMode} onChange={(event) => setForm({ ...form, trackingMode: event.target.value as EquipmentItemInput["trackingMode"] })}><MenuItem value="quantity">Quantity</MenuItem><MenuItem value="individual">Individual assets</MenuItem></Select></FormControl>
          <TextField label="Total quantity" type="number" slotProps={{ htmlInput: { min: editing?.checkedOutQuantity ?? 0, step: 1 } }} value={form.totalQuantity} onChange={(event) => setForm({ ...form, totalQuantity: Number(event.target.value) })} helperText={editing?.checkedOutQuantity ? `${editing.checkedOutQuantity} currently checked out` : undefined} />
          <FormControl><InputLabel>Condition</InputLabel><Select label="Condition" value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value as EquipmentItemInput["condition"] })}><MenuItem value="good">Good</MenuItem><MenuItem value="needs-attention">Needs attention</MenuItem><MenuItem value="repair">Repair</MenuItem><MenuItem value="missing">Missing</MenuItem><MenuItem value="lost">Lost</MenuItem><MenuItem value="retired">Retired</MenuItem></Select></FormControl>
          <TextField label="Replacement value (€)" type="number" slotProps={{ htmlInput: { min: 0, step: "0.01" } }} value={form.replacementValue ?? ""} onChange={(event) => setForm({ ...form, replacementValue: event.target.value === "" ? null : Number(event.target.value) })} />
          <TextField label="Notes" multiline minRows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setEditing(undefined)} disabled={saving}>Cancel</Button><Button variant="contained" color="success" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save equipment"}</Button></DialogActions>
      </Dialog>

      {optionManager("locations", locations, manageLocationsOpen, () => setManageLocationsOpen(false))}
      {optionManager("categories", categories, manageCategoriesOpen, () => setManageCategoriesOpen(false))}
    </Container>
  </Box>;
}
