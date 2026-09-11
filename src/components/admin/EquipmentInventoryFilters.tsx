import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import type { EquipmentDashboardFilter } from "./EquipmentOperationsDashboard";

export const UNASSIGNED_EQUIPMENT_STORE = "__unassigned__";

type Props = {
  search: string;
  status: EquipmentDashboardFilter;
  category: string;
  store: string;
  showArchived: boolean;
  categories: string[];
  stores: string[];
  hasUnassignedStore: boolean;
  canManage: boolean;
  hasActiveFilters: boolean;
  loading: boolean;
  resultCount: number;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onStoreChange: (value: string) => void;
  onAddEquipment: () => void;
  onManageStores: () => void;
  onManageCategories: () => void;
  onToggleArchived: () => void;
  onReset: () => void;
  onRefresh: () => void;
};

export default function EquipmentInventoryFilters({
  search,
  status,
  category,
  store,
  showArchived,
  categories,
  stores,
  hasUnassignedStore,
  canManage,
  hasActiveFilters,
  loading,
  resultCount,
  onSearchChange,
  onStatusChange,
  onCategoryChange,
  onStoreChange,
  onAddEquipment,
  onManageStores,
  onManageCategories,
  onToggleArchived,
  onReset,
  onRefresh
}: Props) {
  return <Paper sx={{ p: { xs: 2, md: 3 }, mb: 2 }} data-testid="equipment-inventory-controls">
    <Typography variant="h5" sx={{ fontWeight: 800 }}>Detailed inventory</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>
      Search and combine status, category and Store filters. Filters are kept in the URL so this view can be bookmarked and revisited.
    </Typography>
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
      <TextField
        fullWidth
        label="Search equipment"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        slotProps={{ htmlInput: { "data-testid": "equipment-search" } }}
      />
      <FormControl fullWidth>
        <InputLabel id="equipment-status-filter-label">Status</InputLabel>
        <Select
          id="equipment-status-filter"
          labelId="equipment-status-filter-label"
          label="Status"
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          data-testid="equipment-status-filter"
        >
          <MenuItem value="all">All statuses</MenuItem>
          <MenuItem value="available">Available stock</MenuItem>
          <MenuItem value="checked-out">Checked out</MenuItem>
          <MenuItem value="unavailable">Unavailable / attention</MenuItem>
        </Select>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel id="equipment-category-filter-label">Category</InputLabel>
        <Select
          id="equipment-category-filter"
          labelId="equipment-category-filter-label"
          label="Category"
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
          data-testid="equipment-category-filter"
        >
          <MenuItem value="all">All categories</MenuItem>
          {categories.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
        </Select>
      </FormControl>
      <FormControl fullWidth>
        <InputLabel id="equipment-location-filter-label">Store</InputLabel>
        <Select
          id="equipment-location-filter"
          labelId="equipment-location-filter-label"
          label="Store"
          value={store}
          onChange={(event) => onStoreChange(event.target.value)}
          data-testid="equipment-location-filter"
        >
          <MenuItem value="all">All Stores</MenuItem>
          {hasUnassignedStore && <MenuItem value={UNASSIGNED_EQUIPMENT_STORE}>No Store assigned</MenuItem>}
          {stores.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
        </Select>
      </FormControl>
    </Stack>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} useFlexGap sx={{ mt: 2, flexWrap: "wrap" }}>
      {canManage && <Button variant="contained" color="success" onClick={onAddEquipment}>Add equipment</Button>}
      {canManage && <Button variant="outlined" onClick={onManageStores}>Manage Stores</Button>}
      {canManage && <Button variant="outlined" onClick={onManageCategories}>Manage categories</Button>}
      <Button variant="outlined" onClick={onToggleArchived} aria-pressed={showArchived} data-testid="equipment-archived-filter">
        {showArchived ? "Hide archived" : "Show archived"}
      </Button>
      {hasActiveFilters && <Button variant="outlined" onClick={onReset} data-testid="equipment-reset-filters">Reset filters</Button>}
      <Button variant="outlined" onClick={onRefresh}>Refresh</Button>
    </Stack>
    {!loading && <Typography sx={{ mt: 2 }} color="text.secondary" role="status" aria-live="polite" data-testid="equipment-result-count">
      {resultCount} matching equipment item{resultCount === 1 ? "" : "s"}
    </Typography>}
  </Paper>;
}
