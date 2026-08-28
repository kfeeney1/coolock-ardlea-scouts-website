import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import type { EquipmentItem } from "../../services/equipment";
import type { EquipmentLoan } from "../../services/equipmentLoans";
import { availableEquipmentQuantity } from "../../services/equipmentLoanLogic";
import { checkoutEquipmentRequirement, equipmentProgrammeStatus, loadEquipmentRequirement, saveEquipmentRequirement } from "../../services/equipmentProgramme";
import type { EquipmentProgrammeRequirement, EquipmentProgrammeSourceType } from "../../services/equipmentProgramme";

type Props = { open: boolean; sourceType: EquipmentProgrammeSourceType; sourceId: string; sourceLabel: string; section: string; date: string; items: EquipmentItem[]; loans: EquipmentLoan[]; readOnly?: boolean; onClose: () => void; onChanged: () => Promise<void> };

function defaultReturnDate(date: string): string { const value = new Date(`${date || new Date().toISOString().slice(0, 10)}T12:00:00`); value.setDate(value.getDate() + 1); return value.toISOString().slice(0, 10); }

export default function ProgrammeEquipmentDialog({ open, sourceType, sourceId, sourceLabel, section, date, items, loans, readOnly = false, onClose, onChanged }: Props) {
  const [requirement, setRequirement] = useState<EquipmentProgrammeRequirement | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [returnDate, setReturnDate] = useState(defaultReturnDate(date));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const activeItems = useMemo(() => items.filter((item) => !item.archived), [items]);
  const status = equipmentProgrammeStatus(requirement, loans);

  useEffect(() => { if (!open || !sourceId) return; setError(""); setReturnDate(defaultReturnDate(date)); void loadEquipmentRequirement(sourceType, sourceId).then((loaded) => { setRequirement(loaded); setQuantities(Object.fromEntries((loaded?.lines ?? []).map((line) => [line.itemId, line.quantity]))); }).catch(() => setError("Unable to load planned equipment.")); }, [open, sourceType, sourceId, date]);

  const savePlan = async () => {
    setSaving(true); setError("");
    try {
      const lines = activeItems.map((item) => ({ itemId: item.id, itemName: item.name, quantity: quantities[item.id] ?? 0 })).filter((line) => Number.isInteger(line.quantity) && line.quantity > 0);
      await saveEquipmentRequirement({ sourceType, sourceId, sourceLabel, section, date, lines }, requirement?.loanId ?? "");
      const loaded = await loadEquipmentRequirement(sourceType, sourceId); setRequirement(loaded); await onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save planned equipment."); } finally { setSaving(false); }
  };

  const checkout = async () => {
    if (!requirement) return;
    setSaving(true); setError("");
    try { await checkoutEquipmentRequirement(requirement, returnDate); const loaded = await loadEquipmentRequirement(sourceType, sourceId); setRequirement(loaded); await onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to create checkout from this plan."); } finally { setSaving(false); }
  };

  return <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="md"><DialogTitle>Equipment · {sourceLabel}</DialogTitle><DialogContent dividers><Stack spacing={2}>
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}><Chip label={section} variant="outlined" /><Chip label={date} variant="outlined" /><Chip label={status === "planned" ? "Planned" : status === "checked-out" ? "Checked Out" : status === "partially-returned" ? "Partially Returned" : "Returned"} color={status === "returned" ? "success" : status === "planned" ? "default" : "warning"} /></Stack>
    {error && <Alert severity="error">{error}</Alert>}
    {activeItems.length === 0 ? <Alert severity="info">No active inventory is available.</Alert> : activeItems.map((item) => { const available = availableEquipmentQuantity(item); return <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}><Stack sx={{ flex: 1 }}><Typography sx={{ fontWeight: 700 }}>{item.name}</Typography><Typography variant="body2" color="text.secondary">{item.location} · {available} currently available</Typography></Stack><TextField label="Required" type="number" value={quantities[item.id] ?? 0} disabled={readOnly || Boolean(requirement?.loanId)} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Math.max(0, Number(event.target.value) || 0) }))} slotProps={{ htmlInput: { min: 0, step: 1 } }} sx={{ width: { sm: 130 } }} /></Stack></Paper>; })}
    {!readOnly && !requirement?.loanId && <Button variant="outlined" onClick={() => void savePlan()} disabled={saving}>Save equipment plan</Button>}
    {!readOnly && requirement && requirement.lines.length > 0 && !requirement.loanId && <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField label="Expected return date" type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><Button variant="contained" color="success" onClick={() => void checkout()} disabled={saving || !returnDate}>Create checkout from plan</Button></Stack>}
    {requirement?.loanId && <Alert severity="info">This plan is linked to checkout {requirement.loanId}. Returns are recorded in Equipment & Stores; this status updates from that checkout.</Alert>}
  </Stack></DialogContent><DialogActions><Button onClick={onClose} disabled={saving}>Close</Button></DialogActions></Dialog>;
}
