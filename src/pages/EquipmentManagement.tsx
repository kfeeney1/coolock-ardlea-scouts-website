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
import { useSearchParams } from "react-router-dom";
import EquipmentHistoryDialog from "../components/admin/EquipmentHistoryDialog";
import EquipmentIncidentsPanel from "../components/admin/EquipmentIncidentsPanel";
import EquipmentInventoryFilters, { UNASSIGNED_EQUIPMENT_STORE } from "../components/admin/EquipmentInventoryFilters";
import EquipmentLoansPanel from "../components/admin/EquipmentLoansPanel";
import EquipmentOperationsDashboard from "../components/admin/EquipmentOperationsDashboard";
import type { EquipmentDashboardFilter } from "../components/admin/EquipmentOperationsDashboard";
import EquipmentReportsPanel from "../components/admin/EquipmentReportsPanel";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
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
import { loadEquipmentIncidents } from "../services/equipmentIncidents";
import type { EquipmentIncident } from "../services/equipmentIncidents";
import { loadEquipmentLoans } from "../services/equipmentLoans";
import type { EquipmentLoan } from "../services/equipmentLoans";
import { availableEquipmentQuantity } from "../services/equipmentLoanLogic";
import {
  canDeleteEquipmentOption,
  canManageEquipment,
  DEFAULT_EQUIPMENT_CATEGORIES,
  isDuplicateEquipmentItemName,
  isDuplicateEquipmentLabel,
  normaliseEquipmentLabel
} from "../services/equipmentLogic";
import { numericInputDisplayValue, parseOptionalNumberInput } from "../services/numericInput";

const OTHER = "__other__";
type EquipmentFormState = Omit<EquipmentItemInput, "totalQuantity"> & { totalQuantity: number | null };
const EMPTY_FORM: EquipmentFormState = {
  name: "",
  category: "",
  trackingMode: "quantity",
  totalQuantity: 1,
  location: "",
  condition: "good",
  notes: "",
  replacementValue: null
};

type InventoryStatusFilter = EquipmentDashboardFilter;

export default function EquipmentManagement() {
  const { adminProfile } = useAdminAuth();
  const canManage = canManageEquipment(adminProfile);
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loans, setLoans] = useState<EquipmentLoan[]>([]);
  const [incidents, setIncidents] = useState<EquipmentIncident[]>([]);
  const [categories, setCategories] = useState<EquipmentOption[]>([]);
  const [locations, setLocations] = useState<EquipmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<EquipmentItem | null | undefined>(undefined);
  const [historyItem, setHistoryItem] = useState<EquipmentItem | null>(null);
  const [form, setForm] = useState<EquipmentFormState>(EMPTY_FORM);
  const [newCategory, setNewCategory] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [manageLocationsOpen, setManageLocationsOpen] = useState(false);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);

  const search = searchParams.get("q") ?? "";
  const categoryFilter = searchParams.get("category") ?? "all";
  const locationFilter = searchParams.get("store") ?? "all";
  const statusParam = searchParams.get("status") ?? "all";
  const statusFilter: InventoryStatusFilter = ["all", "available", "checked-out", "unavailable"].includes(statusParam)
    ? statusParam as InventoryStatusFilter
    : "all";
  const showArchived = searchParams.get("archived") === "1";

  const updateFilterParam = (key: string, value: string, defaultValue = "all", replace = false) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace });
  };

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [nextItems, nextLoans, nextIncidents, nextCategories, nextLocations] = await Promise.all([
        loadEquipmentItems(),
        loadEquipmentLoans(),
        loadEquipmentIncidents(),
        loadEquipmentOptions("categories"),
        loadEquipmentOptions("locations")
      ]);
      setItems(nextItems);
      setLoans(nextLoans);
      setIncidents(nextIncidents);
      setCategories(nextCategories);
      setLocations(nextLocations);
      setHistoryItem((current) => current ? nextItems.find((item) => item.id === current.id) ?? current : null);
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
  const locationNames = useMemo(() => Array.from(new Set([
    ...locations.map((item) => item.name),
    ...items.map((item) => item.location.trim()).filter(Boolean)
  ])).sort((a, b) => a.localeCompare(b)), [locations, items]);
  const activeItems = useMemo(() => items.filter((item) => !item.archived), [items]);
  const hasUnassignedStore = useMemo(() => items.some((item) => !item.location.trim()), [items]);

  const visibleItems = useMemo(() => items.filter((item) => {
    if (!showArchived && item.archived) return false;
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    if (locationFilter === UNASSIGNED_EQUIPMENT_STORE && item.location.trim()) return false;
    if (locationFilter !== "all" && locationFilter !== UNASSIGNED_EQUIPMENT_STORE && item.location !== locationFilter) return false;
    if (statusFilter === "available" && availableEquipmentQuantity(item) <= 0) return false;
    if (statusFilter === "checked-out" && item.checkedOutQuantity <= 0) return false;
    if (statusFilter === "unavailable" && item.unavailableQuantity <= 0) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [item.name, item.category, item.location, item.notes].join(" ").toLowerCase().includes(query);
  }), [items, search, categoryFilter, locationFilter, statusFilter, showArchived]);

  const hasActiveFilters = Boolean(search.trim() || categoryFilter !== "all" || locationFilter !== "all" || statusFilter !== "all" || showArchived);

  const resetFilters = () => setSearchParams(new URLSearchParams());

  const showInventoryFilter = (filter: EquipmentDashboardFilter) => {
    const next = new URLSearchParams(searchParams);
    if (filter === "all") next.delete("status");
    else next.set("status", filter);
    setSearchParams(next);
    requestAnimationFrame(() => document.querySelector('[data-testid="equipment-inventory-controls"]')?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

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
    if (isDuplicateEquipmentItemName(name, items, editing?.id)) {
      return setError("An equipment item with that name already exists. Edit or restore the existing record instead.");
    }
    if (form.totalQuantity === null || !Number.isInteger(form.totalQuantity) || form.totalQuantity < 0) return setError("Quantity must be a whole number of zero or more.");
    const committedQuantity = editing ? editing.checkedOutQuantity + editing.unavailableQuantity : 0;
    if (editing && form.totalQuantity < committedQuantity) return setError(`At least ${committedQuantity} are currently checked out or unavailable. Resolve stock before reducing the total below that number.`);
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
        if (!safe) throw new Error("Enter the new Store name.");
        if (isDuplicateEquipmentLabel(safe, locationNames)) throw new Error("That Store already exists. Select it from the list instead.");
        location = (await addEquipmentOption("locations", safe)).name;
      }
      if (!category || !location) throw new Error("Choose a category and Store.");

      const payload: EquipmentItemInput = { ...form, totalQuantity: form.totalQuantity, name, category, location };
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
      setError(`Unable to delete that ${kind === "categories" ? "category" : "Store"}.`);
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
    <DialogTitle>Manage {kind === "categories" ? "custom categories" : "Stores"}</DialogTitle>
    <DialogContent dividers>
      {options.length === 0 ? <Alert severity="info">No saved {kind === "categories" ? "custom categories" : "Stores"} yet. Add one by choosing Other… when adding equipment.</Alert> : <Stack spacing={1.25}>{options.map((option) => {
        const values = activeItems.map((item) => kind === "categories" ? item.category : item.location);
        const usage = values.filter((value) => value.toLowerCase() === option.name.toLowerCase()).length;
        return <Paper key={option.id} variant="outlined" sx={{ p: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
          <Box><Typography sx={{ fontWeight: 700 }}>{option.name}</Typography><Typography variant="body2" color="text.secondary">{usage ? `${usage} equipment record${usage === 1 ? "" : "s"} currently use this ${kind === "categories" ? "category" : "Store"}` : "Unused"}</Typography></Box>
          <Button color="error" disabled={!canDeleteEquipmentOption(option.name, values)} onClick={() => void removeOption(kind, option)}>Delete</Button>
        </Paper>;
      })}</Stack>}
    </DialogContent>
    <DialogActions><Button onClick={close}>Close</Button></DialogActions>
  </Dialog>;

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 3, md: 5 } }}>
    <Container maxWidth="xl">
      <LeaderDashboardHeader />
      <LeaderPageHeader title="Equipment & Stores" description="Track stock, Stores, section holdings, returns, equipment history and broken, lost or missing equipment." />
      {!canManage && <Alert severity="info" sx={{ mb: 2 }}>You can view the group catalogue, check equipment in or out for your assigned section, report issues from your section holdings, and view equipment history. Stock records and moves remain restricted to the Quartermaster / Bo'sun, Group Leader, Deputy Group Leader and administrator roles.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!loading && canManage && <EquipmentOperationsDashboard items={items} loans={loans} incidents={incidents} onFilterInventory={showInventoryFilter} />}
      {!loading && canManage && <EquipmentReportsPanel items={items} loans={loans} incidents={incidents} canManage={canManage} />}
      {!loading && <EquipmentIncidentsPanel profile={adminProfile} items={items} loans={loans} incidents={incidents} onChanged={refresh} onError={setError} />}
      {!loading && <EquipmentLoansPanel profile={adminProfile} items={items} loans={loans} onChanged={refresh} onError={setError} />}

      <EquipmentInventoryFilters
        search={search}
        status={statusFilter}
        category={categoryFilter}
        store={locationFilter}
        showArchived={showArchived}
        categories={categoryNames}
        stores={locationNames}
        hasUnassignedStore={hasUnassignedStore}
        canManage={canManage}
        hasActiveFilters={hasActiveFilters}
        loading={loading}
        resultCount={visibleItems.length}
        onSearchChange={(value) => updateFilterParam("q", value, "", true)}
        onStatusChange={(value) => updateFilterParam("status", value)}
        onCategoryChange={(value) => updateFilterParam("category", value)}
        onStoreChange={(value) => updateFilterParam("store", value)}
        onAddEquipment={openCreate}
        onManageStores={() => setManageLocationsOpen(true)}
        onManageCategories={() => setManageCategoriesOpen(true)}
        onToggleArchived={() => updateFilterParam("archived", showArchived ? "" : "1", "", false)}
        onReset={resetFilters}
        onRefresh={() => void refresh()}
      />

      {loading ? <Alert severity="info">Loading equipment…</Alert> : items.length === 0 ? <Alert severity="info">No equipment has been added yet.</Alert> : visibleItems.length === 0 ? <Alert severity="info">No equipment matches the current filters.</Alert> : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
          {visibleItems.map((item) => {
            const available = availableEquipmentQuantity(item);
            return <Paper key={item.id} variant="outlined" sx={{ p: 2.5, opacity: item.archived ? 0.65 : 1 }}>
              <Stack spacing={1.25}>
                <Box><Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>{item.name}</Typography><Typography color="text.secondary">{item.category} · Store: {item.location || "No Store assigned"}</Typography></Box>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                  <Chip label={`${item.totalQuantity} total`} color="primary" />
                  <Chip label={`${available} available`} color={available === 0 ? "warning" : "success"} variant="outlined" />
                  {item.checkedOutQuantity > 0 && <Chip label={`${item.checkedOutQuantity} checked out`} variant="outlined" />}
                  {item.unavailableQuantity > 0 && <Chip label={`${item.unavailableQuantity} unavailable`} color="warning" />}
                  <Chip label={item.trackingMode === "individual" ? "Individually tracked" : "Quantity tracked"} variant="outlined" />
                  <Chip label={item.condition.replace("-", " ")} variant="outlined" />
                  {item.archived && <Chip label="Archived" />}
                </Stack>
                {item.notes && <Typography variant="body2">{item.notes}</Typography>}
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                  <Button size="small" onClick={() => setHistoryItem(item)}>History{canManage && !item.archived && available > 0 ? " / move Store" : ""}</Button>
                  {canManage && <Button size="small" onClick={() => openEdit(item)}>Edit</Button>}
                  {canManage && <Button size="small" color={item.archived ? "success" : "warning"} disabled={!item.archived && (item.checkedOutQuantity > 0 || item.unavailableQuantity > 0)} onClick={() => void toggleArchived(item)}>{item.archived ? "Restore" : "Archive"}</Button>}
                </Stack>
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
          <FormControl disabled={Boolean(editing)}><InputLabel>Store</InputLabel><Select label="Store" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })}><MenuItem value=""><em>Select Store</em></MenuItem>{locationNames.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}<MenuItem value={OTHER}>Other…</MenuItem></Select></FormControl>
          {editing && <Typography variant="caption" color="text.secondary">To change an item's Store, use History / move Store so the stock movement remains auditable.</Typography>}
          {form.location === OTHER && <TextField label="New Store" value={newLocation} onChange={(event) => setNewLocation(event.target.value)} />}
          <FormControl><InputLabel>Tracking</InputLabel><Select label="Tracking" value={form.trackingMode} onChange={(event) => setForm({ ...form, trackingMode: event.target.value as EquipmentItemInput["trackingMode"] })}><MenuItem value="quantity">Quantity</MenuItem><MenuItem value="individual">Individual assets</MenuItem></Select></FormControl>
          <TextField label="Total quantity" type="number" slotProps={{ htmlInput: { min: editing ? editing.checkedOutQuantity + editing.unavailableQuantity : 0, step: 1, "data-testid": "equipment-total-quantity" } }} value={numericInputDisplayValue(form.totalQuantity)} onChange={(event) => setForm({ ...form, totalQuantity: parseOptionalNumberInput(event.target.value) })} helperText={editing && (editing.checkedOutQuantity > 0 || editing.unavailableQuantity > 0) ? `${editing.checkedOutQuantity} checked out · ${editing.unavailableQuantity} unavailable` : undefined} />
          <FormControl><InputLabel>Condition</InputLabel><Select label="Condition" value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value as EquipmentItemInput["condition"] })}><MenuItem value="not-recorded">Not recorded</MenuItem><MenuItem value="good">Good</MenuItem><MenuItem value="needs-attention">Needs attention</MenuItem><MenuItem value="repair">Repair</MenuItem><MenuItem value="missing">Missing</MenuItem><MenuItem value="lost">Lost</MenuItem><MenuItem value="retired">Retired</MenuItem></Select></FormControl>
          <TextField label="Replacement value (€)" type="number" slotProps={{ htmlInput: { min: 0, step: "0.01" } }} value={form.replacementValue ?? ""} onChange={(event) => setForm({ ...form, replacementValue: event.target.value === "" ? null : Number(event.target.value) })} />
          <TextField label="Notes" multiline minRows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setEditing(undefined)} disabled={saving}>Cancel</Button><Button variant="contained" color="success" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save equipment"}</Button></DialogActions>
      </Dialog>

      <EquipmentHistoryDialog item={historyItem} locations={locationNames} canManage={canManage} onClose={() => setHistoryItem(null)} onChanged={refresh} onError={setError} />
      {optionManager("locations", locations, manageLocationsOpen, () => setManageLocationsOpen(false))}
      {optionManager("categories", categories, manageCategoriesOpen, () => setManageCategoriesOpen(false))}
    </Container>
  </Box>;
}
