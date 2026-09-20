import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";
import type { EquipmentItem, EquipmentOption } from "../../services/equipment";
import { addEquipmentOption, deleteEquipmentOption, updateEquipmentOption } from "../../services/equipment";
import { canDeleteEquipmentOption, DEFAULT_EQUIPMENT_CATEGORIES, isDuplicateEquipmentLabel, normaliseEquipmentLabel } from "../../services/equipmentLogic";

type Props = {
  kind: "categories" | "locations";
  options: EquipmentOption[];
  activeItems: EquipmentItem[];
  open: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
};

export default function EquipmentOptionManager({ kind, options, activeItems, open, onClose, onChanged, onError }: Props) {
  const [optionName, setOptionName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const label = kind === "categories" ? "custom category" : "Store";
  const values = activeItems.map((item) => kind === "categories" ? item.category : item.location);

  const addOption = async () => {
    const safe = normaliseEquipmentLabel(optionName);
    if (!safe) return onError(`Enter a ${label} name.`);
    const existing = [...options.map((x) => x.name), ...(kind === "categories" ? DEFAULT_EQUIPMENT_CATEGORIES : [])];
    if (isDuplicateEquipmentLabel(safe, existing)) return onError(`That ${label} already exists.`);
    try { await addEquipmentOption(kind, safe); setOptionName(""); await onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : `Unable to add that ${label}.`); }
  };

  const renameOption = async (option: EquipmentOption) => {
    const safe = normaliseEquipmentLabel(drafts[option.id] ?? option.name);
    if (!safe || safe === option.name) return;
    if (isDuplicateEquipmentLabel(safe, options.filter((x) => x.id !== option.id).map((x) => x.name))) return onError(`That ${label} already exists.`);
    try { await updateEquipmentOption(kind, option, safe); await onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : `Unable to rename that ${label}.`); }
  };

  const removeOption = async (option: EquipmentOption) => {
    if (!canDeleteEquipmentOption(option.name, values)) return;
    try { await deleteEquipmentOption(kind, option); await onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : `Unable to delete that ${label}.`); }
  };

  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>Manage {kind === "categories" ? "custom categories" : "Stores"}</DialogTitle>
    <DialogContent dividers><Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField fullWidth label={`New ${label}`} value={optionName} onChange={(event) => setOptionName(event.target.value)} />
        <Button variant="contained" onClick={() => void addOption()}>Add</Button>
      </Stack>
      {options.length === 0 ? <Alert severity="info">No saved {kind === "categories" ? "custom categories" : "Stores"} yet.</Alert> : options.map((option) => {
        const usage = values.filter((value) => value.toLowerCase() === option.name.toLowerCase()).length;
        return <Paper key={option.id} variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
            <TextField fullWidth size="small" label={kind === "categories" ? "Category name" : "Store name"} value={drafts[option.id] ?? option.name} onChange={(event) => setDrafts({ ...drafts, [option.id]: event.target.value })} helperText={usage ? `${usage} equipment record${usage === 1 ? "" : "s"} use this ${label}` : "Unused"} />
            <Button variant="outlined" onClick={() => void renameOption(option)}>Save</Button>
            <Button variant="outlined" color="error" disabled={!canDeleteEquipmentOption(option.name, values)} onClick={() => void removeOption(option)}>Delete</Button>
          </Stack>
          {usage > 0 && <Typography variant="caption" color="text.secondary">Delete is disabled while equipment uses this {label}. Renaming preserves those assignments and records history.</Typography>}
        </Paper>;
      })}
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
  </Dialog>;
}
