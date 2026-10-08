import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import type { Dispatch, SetStateAction } from "react";
import type { EquipmentItem, EquipmentItemInput } from "../../services/equipment";
import { numericInputDisplayValue, parseOptionalNumberInput } from "../../services/numericInput";

export type EquipmentFormState = Omit<EquipmentItemInput, "totalQuantity"> & { totalQuantity: number | null };

export const EMPTY_EQUIPMENT_FORM: EquipmentFormState = {
  name: "",
  category: "",
  trackingMode: "quantity",
  totalQuantity: 1,
  location: "",
  condition: "good",
  notes: "",
  replacementValue: null
};

const OTHER = "__other__";

type EquipmentItemFormDialogProps = {
  open: boolean;
  editing: EquipmentItem | null | undefined;
  form: EquipmentFormState;
  categoryNames: string[];
  locationNames: string[];
  newCategory: string;
  newLocation: string;
  saving: boolean;
  onFormChange: Dispatch<SetStateAction<EquipmentFormState>>;
  onNewCategoryChange: (value: string) => void;
  onNewLocationChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

export default function EquipmentItemFormDialog({
  open,
  editing,
  form,
  categoryNames,
  locationNames,
  newCategory,
  newLocation,
  saving,
  onFormChange,
  onNewCategoryChange,
  onNewLocationChange,
  onClose,
  onSave
}: EquipmentItemFormDialogProps) {
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>Add equipment</DialogTitle>
    <DialogContent dividers><Stack spacing={2} sx={{ pt: 0.5 }}>
      <TextField label="Equipment name" value={form.name} onChange={(event) => onFormChange({ ...form, name: event.target.value })} required />
      <FormControl><InputLabel id="equipment-category-label">Category</InputLabel><Select labelId="equipment-category-label" label="Category" value={form.category} onChange={(event) => onFormChange({ ...form, category: event.target.value })}><MenuItem value=""><em>Select category</em></MenuItem>{categoryNames.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}<MenuItem value={OTHER}>Other…</MenuItem></Select></FormControl>
      {form.category === OTHER && <TextField label="New category" value={newCategory} onChange={(event) => onNewCategoryChange(event.target.value)} autoFocus />}
      <FormControl><InputLabel id="equipment-store-label">Store</InputLabel><Select labelId="equipment-store-label" label="Store" value={form.location} onChange={(event) => onFormChange({ ...form, location: event.target.value })}><MenuItem value=""><em>Select Store</em></MenuItem>{locationNames.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}<MenuItem value={OTHER}>Other…</MenuItem></Select></FormControl>
      {editing && <Typography variant="caption" color="text.secondary">To change an item's Store, use Move Store so the stock movement remains auditable.</Typography>}
      {form.location === OTHER && <TextField label="New Store" value={newLocation} onChange={(event) => onNewLocationChange(event.target.value)} />}
      <FormControl><InputLabel>Tracking</InputLabel><Select label="Tracking" value={form.trackingMode} onChange={(event) => onFormChange({ ...form, trackingMode: event.target.value as EquipmentItemInput["trackingMode"] })}><MenuItem value="quantity">Quantity</MenuItem><MenuItem value="individual">Individual assets</MenuItem></Select></FormControl>
      <TextField label="Total quantity" type="number" slotProps={{ htmlInput: { min: 0, step: 1, "data-testid": "equipment-total-quantity" } }} value={numericInputDisplayValue(form.totalQuantity)} onChange={(event) => onFormChange({ ...form, totalQuantity: parseOptionalNumberInput(event.target.value) })} helperText={editing && (editing.checkedOutQuantity > 0 || editing.unavailableQuantity > 0) ? `${editing.checkedOutQuantity} checked out · ${editing.unavailableQuantity} unavailable` : undefined} />
      <FormControl><InputLabel>Condition</InputLabel><Select label="Condition" value={form.condition} onChange={(event) => onFormChange({ ...form, condition: event.target.value as EquipmentItemInput["condition"] })}><MenuItem value="not-recorded">Not recorded</MenuItem><MenuItem value="good">Good</MenuItem><MenuItem value="needs-attention">Needs attention</MenuItem><MenuItem value="repair">Repair</MenuItem><MenuItem value="missing">Missing</MenuItem><MenuItem value="lost">Lost</MenuItem><MenuItem value="retired">Retired</MenuItem></Select></FormControl>
      <TextField label="Replacement value (€)" type="number" slotProps={{ htmlInput: { min: 0, step: "0.01" } }} value={form.replacementValue ?? ""} onChange={(event) => onFormChange({ ...form, replacementValue: event.target.value === "" ? null : Number(event.target.value) })} />
      <TextField label="Notes" multiline minRows={3} value={form.notes} onChange={(event) => onFormChange({ ...form, notes: event.target.value })} />
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={saving}>Cancel</Button><Button variant="contained" color="success" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save equipment"}</Button></DialogActions>
  </Dialog>;
}
