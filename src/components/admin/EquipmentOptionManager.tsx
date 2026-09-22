import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography } from "@mui/material";
import { useMemo, useState } from "react";
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

const keyOf = (value: string) => normaliseEquipmentLabel(value).toLocaleLowerCase();

export default function EquipmentOptionManager({ kind, options, activeItems, open, onClose, onChanged, onError }: Props) {
  const [optionName, setOptionName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const label = kind === "categories" ? "custom category" : "Store";
  const values = activeItems.map((item) => kind === "categories" ? item.category : item.location).filter(Boolean);
  const catalogue = useMemo(() => {
    if (kind !== "categories") return options.map((option) => ({ name: option.name, option, type: "Custom" as const }));
    const saved = new Map(options.map((option) => [keyOf(option.name), option]));
    const defaults = DEFAULT_EQUIPMENT_CATEGORIES.filter((name) => name !== "Other");
    const names = new Map<string, string>();
    [...defaults, ...options.map((x) => x.name), ...values].forEach((name) => {
      const safe = normaliseEquipmentLabel(name);
      if (safe && !names.has(keyOf(safe))) names.set(keyOf(safe), safe);
    });
    return [...names.values()].sort((a, b) => a.localeCompare(b)).map((name) => {
      const option = saved.get(keyOf(name));
      const builtIn = defaults.some((value) => keyOf(value) === keyOf(name));
      return { name, option, type: builtIn ? "Built-in" as const : option ? "Custom" as const : "Legacy / imported" as const };
    });
  }, [kind, options, values.join("|")]);

  const addOption = async () => {
    const safe = normaliseEquipmentLabel(optionName);
    if (!safe) return onError(`Enter a ${label} name.`);
    const existing = [...options.map((x) => x.name), ...(kind === "categories" ? [...DEFAULT_EQUIPMENT_CATEGORIES, ...values] : values)];
    if (isDuplicateEquipmentLabel(safe, existing)) return onError(`That ${label} already exists.`);
    try { await addEquipmentOption(kind, safe); setOptionName(""); await onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : `Unable to add that ${label}.`); }
  };

  const renameOption = async (option: EquipmentOption) => {
    const safe = normaliseEquipmentLabel(drafts[option.id] ?? option.name);
    if (!safe || safe === option.name) return;
    const existing = kind === "categories" ? [...DEFAULT_EQUIPMENT_CATEGORIES, ...values, ...options.filter((x) => x.id !== option.id).map((x) => x.name)] : [...values, ...options.filter((x) => x.id !== option.id).map((x) => x.name)];
    if (isDuplicateEquipmentLabel(safe, existing.filter((x) => keyOf(x) !== keyOf(option.name)))) return onError(`That ${label} already exists.`);
    try { await updateEquipmentOption(kind, option, safe); await onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : `Unable to rename that ${label}.`); }
  };

  const removeOption = async (option: EquipmentOption) => {
    if (!canDeleteEquipmentOption(option.name, values)) return;
    try { await deleteEquipmentOption(kind, option); await onChanged(); }
    catch (error) { onError(error instanceof Error ? error.message : `Unable to delete that ${label}.`); }
  };

  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>Manage {kind === "categories" ? "Categories" : "Stores"}</DialogTitle>
    <DialogContent dividers><Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <TextField fullWidth label={`New ${label}`} value={optionName} onChange={(event) => setOptionName(event.target.value)} />
        <Button variant="contained" onClick={() => void addOption()}>Add</Button>
      </Stack>
      {catalogue.length === 0 ? <Alert severity="info">No saved {kind === "categories" ? "categories" : "Stores"} yet.</Alert> : catalogue.map((entry) => {
        const usage = values.filter((value) => keyOf(value) === keyOf(entry.name)).length;
        const editable = Boolean(entry.option) && entry.type === "Custom";
        return <Paper key={`${entry.type}-${keyOf(entry.name)}`} variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
            {editable && entry.option ? <TextField fullWidth size="small" label={kind === "categories" ? "Category name" : "Store name"} value={drafts[entry.option.id] ?? entry.option.name} onChange={(event) => setDrafts({ ...drafts, [entry.option!.id]: event.target.value })} helperText={usage ? `${usage} equipment record${usage === 1 ? "" : "s"} use this ${label}` : "Unused"} /> : <Stack sx={{ flex: 1 }}><Typography sx={{ fontWeight: 700 }}>{entry.name}</Typography><Typography variant="caption" color="text.secondary">{usage} equipment record{usage === 1 ? "" : "s"}</Typography></Stack>}
            {kind === "categories" && <Chip size="small" variant="outlined" label={entry.type} />}
            {editable && entry.option && <Button variant="outlined" onClick={() => void renameOption(entry.option!)}>Save</Button>}
            {editable && entry.option && <Button variant="outlined" color="error" disabled={!canDeleteEquipmentOption(entry.option.name, values)} onClick={() => void removeOption(entry.option!)}>Delete</Button>}
          </Stack>
          {!editable && kind === "categories" && <Typography variant="caption" color="text.secondary">{entry.type === "Built-in" ? "System category; visible for completeness and protected from destructive changes." : "Category discovered from existing/imported equipment; preserved for compatibility."}</Typography>}
          {editable && usage > 0 && <Typography variant="caption" color="text.secondary">Delete is disabled while equipment uses this {label}. Renaming preserves those assignments and records history.</Typography>}
        </Paper>;
      })}
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
  </Dialog>;
}
