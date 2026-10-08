import { applicationErrorMessage, UserInputError } from "../services/applicationErrors.ts";
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
  Paper,
  Stack,
  Typography
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import EquipmentHistoryDialog from "../components/admin/EquipmentHistoryDialog";
import EquipmentItemFormDialog, { EMPTY_EQUIPMENT_FORM } from "../components/admin/EquipmentItemFormDialog";
import type { EquipmentFormState } from "../components/admin/EquipmentItemFormDialog";
import EquipmentIncidentsPanel from "../components/admin/EquipmentIncidentsPanel";
import EquipmentInventoryFilters, { UNASSIGNED_EQUIPMENT_STORE } from "../components/admin/EquipmentInventoryFilters";
import EquipmentLoansPanel from "../components/admin/EquipmentLoansPanel";
import EquipmentOperationsDashboard from "../components/admin/EquipmentOperationsDashboard";
import EquipmentOptionManager from "../components/admin/EquipmentOptionManager";
import type { EquipmentDashboardFilter } from "../components/admin/EquipmentOperationsDashboard";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import {
  addEquipmentOption,
  createEquipmentItem,
  loadEquipmentItems,
  loadEquipmentOptions,
  setEquipmentArchived,
} from "../services/equipment";
import type { EquipmentItem, EquipmentItemInput, EquipmentOption } from "../services/equipment";
import { loadEquipmentIncidents } from "../services/equipmentIncidents";
import type { EquipmentIncident } from "../services/equipmentIncidents";
import { loadEquipmentLoans } from "../services/equipmentLoans";
import type { EquipmentLoan } from "../services/equipmentLoans";
import { availableEquipmentQuantity, canUseEquipmentForSection } from "../services/equipmentLoanLogic";
import {
  canManageEquipment,
  DEFAULT_EQUIPMENT_CATEGORIES,
  isDuplicateEquipmentItemName,
  isDuplicateEquipmentLabel,
  normaliseEquipmentLabel
} from "../services/equipmentLogic";

const OTHER = "__other__";
type InventoryStatusFilter = EquipmentDashboardFilter;

export default function EquipmentManagement() {
  const { adminProfile } = useAdminAuth();
  const navigate = useNavigate();
  const canManage = canManageEquipment(adminProfile);
  const [searchParams, setSearchParams] = useState(() => new URLSearchParams(window.location.search));
  const [routeSearchParams, setRouteSearchParams] = useSearchParams();
  const filterParamsRef = useRef(searchParams);
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [loans, setLoans] = useState<EquipmentLoan[]>([]);
  const [incidents, setIncidents] = useState<EquipmentIncident[]>([]);
  const [categories, setCategories] = useState<EquipmentOption[]>([]);
  const [locations, setLocations] = useState<EquipmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<EquipmentItem | null | undefined>(undefined);
  const [historyItem, setHistoryItem] = useState<EquipmentItem | null>(null);
  const [form, setForm] = useState<EquipmentFormState>(EMPTY_EQUIPMENT_FORM);
  const [newCategory, setNewCategory] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [manageLocationsOpen, setManageLocationsOpen] = useState(false);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<EquipmentItem | null>(null);
  const inventoryHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const search = searchParams.get("q") ?? "";
  const highlightedIssueId = searchParams.get("issue");
  const categoryFilter = searchParams.get("category") ?? "all";
  const locationFilter = searchParams.get("store") ?? "all";
  const statusParam = searchParams.get("status") ?? "all";
  const statusFilter: InventoryStatusFilter = ["all", "available", "checked-out", "unavailable"].includes(statusParam)
    ? statusParam as InventoryStatusFilter
    : "all";
  const showArchived = searchParams.get("archived") === "1";
  const navigationView = searchParams.get("view");
  const pageIdentity = navigationView === "quartermaster" ? "qm-equipment-stores" : navigationView === "group-operations" ? "group-equipment-stores" : "equipment-stores";
  const pageTitle = navigationView === "quartermaster" ? "Quartermaster / Bo’sun Equipment & Stores" : navigationView === "group-operations" ? "Group Operations — Equipment & Stores" : "Equipment & Stores";

  const applyFilterParams = (next: URLSearchParams) => {
    filterParamsRef.current = next;
    setSearchParams(next);
    const searchString = next.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${searchString ? `?${searchString}` : ""}${window.location.hash}`
    );
  };

  const updateFilterParam = (key: string, value: string, defaultValue = "all") => {
    const next = new URLSearchParams(filterParamsRef.current);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    applyFilterParams(next);
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
      setHasLoaded(true);
    } catch (loadError) {
      setError(applicationErrorMessage(loadError, "Unable to load Equipment & Stores right now.", "EquipmentManagement"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    const next = new URLSearchParams(routeSearchParams);
    filterParamsRef.current = next;
    setSearchParams(next);
  }, [routeSearchParams]);

  const categoryNames = useMemo(() => Array.from(new Set([
    ...DEFAULT_EQUIPMENT_CATEGORIES.filter((item) => item !== "Other"),
    ...categories.map((item) => item.name),
    ...items.map((item) => normaliseEquipmentLabel(item.category)).filter(Boolean)
  ])).sort((a, b) => a.localeCompare(b)), [categories, items]);
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

  const resetFilters = () => applyFilterParams(new URLSearchParams());

  const showInventoryFilter = (filter: EquipmentDashboardFilter) => {
    const next = new URLSearchParams(filterParamsRef.current);
    if (filter === "all") next.delete("status");
    else next.set("status", filter);
    filterParamsRef.current = next;
    setSearchParams(next);
    setRouteSearchParams(next);
    requestAnimationFrame(() => {
      inventoryHeadingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      inventoryHeadingRef.current?.focus({ preventScroll: true });
    });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_EQUIPMENT_FORM);
    setNewCategory("");
    setNewLocation("");
  };

  const save = async () => {
    setError("");
    const name = normaliseEquipmentLabel(form.name);
    if (!name) return setError("Enter an equipment name.");
    if (isDuplicateEquipmentItemName(name, items)) {
      return setError("An equipment item with that name already exists. Edit or restore the existing record instead.");
    }
    if (form.totalQuantity === null || !Number.isInteger(form.totalQuantity) || form.totalQuantity < 0) return setError("Quantity must be a whole number of zero or more.");
    if (form.replacementValue !== null && (!Number.isFinite(form.replacementValue) || form.replacementValue < 0)) return setError("Replacement value cannot be negative.");

    setSaving(true);
    try {
      let category = form.category;
      if (category === OTHER) {
        const safe = normaliseEquipmentLabel(newCategory);
        if (!safe) throw new UserInputError("Enter the new category name.");
        if (isDuplicateEquipmentLabel(safe, categoryNames)) throw new UserInputError("That category already exists. Select it from the list instead.");
        category = (await addEquipmentOption("categories", safe)).name;
      }

      let location = form.location;
      if (location === OTHER) {
        const safe = normaliseEquipmentLabel(newLocation);
        if (!safe) throw new UserInputError("Enter the new Store name.");
        if (isDuplicateEquipmentLabel(safe, locationNames)) throw new UserInputError("That Store already exists. Select it from the list instead.");
        location = (await addEquipmentOption("locations", safe)).name;
      }
      if (!category || !location) throw new UserInputError("Choose a category and Store.");

      const payload: EquipmentItemInput = { ...form, totalQuantity: form.totalQuantity, name, category, location };
      await createEquipmentItem(payload);
      await refresh();
      setEditing(undefined);
    } catch (saveError) {
      setError(applicationErrorMessage(saveError, "Unable to save the equipment item.", "EquipmentManagement"));
    } finally {
      setSaving(false);
    }
  };

  const toggleArchived = async (item: EquipmentItem) => {
    setError("");
    try {
      await setEquipmentArchived(item, !item.archived);
      setArchiveTarget(null);
      void refresh();
    } catch (archiveError) {
      setError(applicationErrorMessage(archiveError, "Unable to update that equipment item.", "EquipmentManagement"));
    }
  };



  return <Box data-testid={`page-${pageIdentity}`} sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 3, md: 5 } }}>
    <Container maxWidth="xl">
      <LeaderDashboardHeader />
      <LeaderPageHeader title={pageTitle} />
      {!canManage && <Alert severity="info" sx={{ mb: 2 }}>You can view the group catalogue, check equipment in or out for your assigned section, report issues from your section holdings, and view equipment history. Stock records and moves remain restricted to the Quartermaster / Bo'sun, Group Leader, Deputy Group Leader and administrator roles.</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {highlightedIssueId && !incidents.some((incident) => incident.id === highlightedIssueId && canUseEquipmentForSection(adminProfile, incident.section)) && <Alert severity="warning" sx={{ mb: 2 }} data-testid="equipment-issue-fallback">That equipment issue is no longer available in your scope. You can review the current open equipment issues from the reported issues page.</Alert>}

      {hasLoaded && canManage && <Button variant="outlined" sx={{ mb: 2, width: { xs: "100%", sm: "auto" } }} onClick={() => navigate("/leader/qm-reports")}>Open QM Reports</Button>}
      {hasLoaded && canManage && <EquipmentOperationsDashboard items={items} loans={loans} incidents={incidents} onFilterInventory={showInventoryFilter} />}
      {hasLoaded && <EquipmentIncidentsPanel profile={adminProfile} items={items} loans={loans} incidents={incidents} highlightedIncidentId={highlightedIssueId} showIssueList={false} showDescription={false} onViewAll={() => navigate(`/leader/equipment/issues${navigationView ? `?view=${encodeURIComponent(navigationView)}` : ""}`)} onChanged={refresh} onError={setError} />}
      {hasLoaded && <EquipmentLoansPanel profile={adminProfile} items={items} loans={loans} onChanged={refresh} onError={setError} />}

      <Box data-testid="equipment-inventory-section" sx={{ scrollMarginTop: { xs: "88px", md: "104px" } }}>
        <Typography ref={inventoryHeadingRef} tabIndex={-1} variant="h5" sx={{ fontWeight: 800, mb: 1, scrollMarginTop: { xs: "104px", md: "120px" }, "&:focus": { outline: "none" } }}>Detailed inventory</Typography>
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
        onSearchChange={(value) => updateFilterParam("q", value, "")}
        onStatusChange={(value) => updateFilterParam("status", value)}
        onCategoryChange={(value) => updateFilterParam("category", value)}
        onStoreChange={(value) => updateFilterParam("store", value)}
        onAddEquipment={openCreate}
        onManageStores={() => setManageLocationsOpen(true)}
        onManageCategories={() => setManageCategoriesOpen(true)}
        onToggleArchived={() => updateFilterParam("archived", showArchived ? "" : "1", "")}
        onReset={resetFilters}
      />
      </Box>

      {loading ? <Alert severity="info">Loading equipment…</Alert> : items.length === 0 ? <Alert severity="info">No equipment has been added yet.</Alert> : visibleItems.length === 0 ? <Alert severity="info">No equipment matches the current filters.</Alert> : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
          {visibleItems.map((item) => {
            const available = availableEquipmentQuantity(item);
            return <Paper key={item.id} data-testid={`equipment-inventory-card-${item.id}`} variant="outlined" role="link" tabIndex={0} onClick={() => navigate(`/leader/equipment/${item.id}`)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate(`/leader/equipment/${item.id}`); }} sx={{ p: 2.5, opacity: item.archived ? 0.65 : 1, cursor: "pointer", "&:focus-visible": { outline: "3px solid", outlineColor: "primary.main", outlineOffset: 2 } }}>
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
                  <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); setHistoryItem(item); }}>History</Button>
                  {canManage && !item.archived && available > 0 && <Button size="small" variant="outlined" onClick={(e) => { e.stopPropagation(); navigate(`/leader/equipment/${encodeURIComponent(item.id)}/move-store`); }}>Move Store</Button>}
                  {canManage && <Button size="small" variant="contained" onClick={(e) => { e.stopPropagation(); navigate(`/leader/equipment/${item.id}`); }}>Edit</Button>}
                  {canManage && <Button size="small" variant="outlined" color={item.archived ? "success" : "warning"} disabled={!item.archived && (item.checkedOutQuantity > 0 || item.unavailableQuantity > 0)} onClick={(e) => { e.stopPropagation(); setArchiveTarget(item); }}>{item.archived ? "Restore" : "Archive"}</Button>}
                </Stack>
              </Stack>
            </Paper>;
          })}
        </Box>
      )}

      <EquipmentItemFormDialog
        open={editing !== undefined}
        editing={editing}
        form={form}
        categoryNames={categoryNames}
        locationNames={locationNames}
        newCategory={newCategory}
        newLocation={newLocation}
        saving={saving}
        onFormChange={setForm}
        onNewCategoryChange={setNewCategory}
        onNewLocationChange={setNewLocation}
        onClose={() => !saving && setEditing(undefined)}
        onSave={() => void save()}
      />

      <Dialog open={Boolean(archiveTarget)} onClose={() => !saving && setArchiveTarget(null)}>
        <DialogTitle>{archiveTarget?.archived ? `Restore ${archiveTarget?.name}?` : `Archive ${archiveTarget?.name}?`}</DialogTitle>
        <DialogContent><Typography>{archiveTarget?.archived ? "Restore this existing record to active inventory with its history intact?" : "Archive this item? It will leave normal inventory but remain available in the archived view for restoration."}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveTarget(null)} disabled={saving}>Cancel</Button>
          <Button variant="contained" color={archiveTarget?.archived ? "success" : "warning"} disabled={saving} onClick={() => archiveTarget && void toggleArchived(archiveTarget)}>{archiveTarget?.archived ? "Restore equipment" : "Archive equipment"}</Button>
        </DialogActions>
      </Dialog>
      <EquipmentHistoryDialog item={historyItem} onClose={() => setHistoryItem(null)} onError={setError} />
      <EquipmentOptionManager kind="locations" options={locations} activeItems={activeItems} open={manageLocationsOpen} onClose={() => setManageLocationsOpen(false)} onChanged={refresh} onError={setError} />
      <EquipmentOptionManager kind="categories" options={categories} activeItems={activeItems} open={manageCategoriesOpen} onClose={() => setManageCategoriesOpen(false)} onChanged={refresh} onError={setError} />
    </Container>
  </Box>;
}
