import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import type { EquipmentItem } from "../../services/equipment";
import type { EquipmentLoan } from "../../services/equipmentLoans";
import { availableEquipmentQuantity } from "../../services/equipmentLoanLogic";
import {
  cancelEquipmentRequirementReservation,
  checkoutEquipmentRequirement,
  equipmentProgrammeStatus,
  loadEquipmentRequirement,
  reserveEquipmentRequirement,
  saveEquipmentRequirement,
} from "../../services/equipmentProgramme";
import type { EquipmentProgrammeRequirement, EquipmentProgrammeSourceType } from "../../services/equipmentProgramme";

type Props = { open: boolean; sourceType: EquipmentProgrammeSourceType; sourceId: string; sourceLabel: string; section: string; date: string; items: EquipmentItem[]; loans: EquipmentLoan[]; readOnly?: boolean; onClose: () => void; onChanged: () => Promise<void> };

function defaultReturnDate(date: string): string { const value = new Date(`${date || new Date().toISOString().slice(0, 10)}T12:00:00`); value.setDate(value.getDate() + 1); return value.toISOString().slice(0, 10); }
function statusLabel(status: ReturnType<typeof equipmentProgrammeStatus>): string { return status === "planned" ? "Planned" : status === "reserved" ? "Reserved" : status === "checked-out" ? "Checked Out" : status === "partially-returned" ? "Partially Returned" : "Returned"; }

export default function ProgrammeEquipmentDialog({ open, sourceType, sourceId, sourceLabel, section, date, items, loans, readOnly = false, onClose, onChanged }: Props) {
  const [requirement, setRequirement] = useState<EquipmentProgrammeRequirement | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [returnDate, setReturnDate] = useState(defaultReturnDate(date));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const activeItems = useMemo(() => items.filter((item) => !item.archived), [items]);
  const status = equipmentProgrammeStatus(requirement, loans);

  const reload = async () => {
    const loaded = await loadEquipmentRequirement(sourceType, sourceId);
    setRequirement(loaded);
    setQuantities(Object.fromEntries((loaded?.lines ?? []).map((line) => [line.itemId, line.quantity])));
    await onChanged();
  };

  useEffect(() => { if (!open || !sourceId) return; setError(""); setReturnDate(defaultReturnDate(date)); void loadEquipmentRequirement(sourceType, sourceId).then((loaded) => { setRequirement(loaded); setQuantities(Object.fromEntries((loaded?.lines ?? []).map((line) => [line.itemId, line.quantity]))); }).catch(() => setError("Unable to load planned equipment.")); }, [open, sourceType, sourceId, date]);

  const savePlan = async () => {
    setSaving(true); setError("");
    try {
      const lines = activeItems.map((item) => ({ itemId: item.id, itemName: item.name, quantity: quantities[item.id] ?? 0 })).filter((line) => Number.isInteger(line.quantity) && line.quantity > 0);
      await saveEquipmentRequirement({ sourceType, sourceId, sourceLabel, section, date, lines }, requirement?.loanId ?? "");
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save planned equipment."); } finally { setSaving(false); }
  };

  const reserve = async () => {
    if (!requirement) return;
    setSaving(true); setError("");
    try { await reserveEquipmentRequirement(requirement); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to reserve this equipment."); } finally { setSaving(false); }
  };

  const cancelReservation = async () => {
    if (!requirement) return;
    setSaving(true); setError("");
    try { await cancelEquipmentRequirementReservation(requirement); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to cancel this reservation."); } finally { setSaving(false); }
  };

  const checkout = async () => {
    if (!requirement) return;
    setSaving(true); setError("");
    try { await checkoutEquipmentRequirement(requirement, returnDate); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to create checkout from this plan."); } finally { setSaving(false); }
  };

  return <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="md"><DialogTitle>Equipment · {sourceLabel}</DialogTitle><DialogContent dividers><Stack spacing={2}>
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}><Chip label={section} variant="outlined" /><Chip label={date} variant="outlined" /><Chip label={statusLabel(status)} color={status === "returned" ? "success" : status === "planned" ? "default" : status === "reserved" ? "info" : "warning"} /></Stack>
    {error && <Alert severity="error">{error}</Alert>}
    {status === "reserved" && <Alert severity="success">This equipment is reserved for {date}. Reserved stock is removed from availability so another checkout or reservation cannot claim it.</Alert>}
    {activeItems.length === 0 ? <Alert severity="info">No active inventory is available.</Alert> : activeItems.map((item) => { const available = availableEquipmentQuantity(item); return <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}><Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}><Stack sx={{ flex: 1 }}><Typography sx={{ fontWeight: 700 }}>{item.name}</Typography><Typography variant="body2" color="text.secondary">{item.location} · {available} currently available</Typography></Stack><TextField label="Required" type="number" value={quantities[item.id] ?? 0} disabled={readOnly || Boolean(requirement?.loanId)} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Math.max(0, Number(event.target.value) || 0) }))} slotProps={{ htmlInput: { min: 0, step: 1 } }} sx={{ width: { sm: 130 } }} /></Stack></Paper>; })}
    {!readOnly && !requirement?.loanId && <Button variant="outlined" onClick={() => void savePlan()} disabled={saving}>Save equipment plan</Button>}
    {!readOnly && requirement && requirement.lines.length > 0 && status === "planned" && <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><Button variant="contained" onClick={() => void reserve()} disabled={saving}>Reserve for {date}</Button><TextField label="Expected return date" type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><Button variant="outlined" color="success" onClick={() => void checkout()} disabled={saving || !returnDate}>Check out now</Button></Stack>}
    {!readOnly && requirement && status === "reserved" && <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}><TextField label="Expected return date" type="date" value={returnDate} onChange={(event) => setReturnDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><Button variant="contained" color="success" onClick={() => void checkout()} disabled={saving || !returnDate}>Check out reserved equipment</Button><Button color="error" variant="outlined" onClick={() => void cancelReservation()} disabled={saving}>Cancel reservation</Button></Stack>}
    {status === "checked-out" || status === "partially-returned" ? <Alert severity="info">This plan is linked to checkout {requirement?.loanId}. Returns are recorded in Equipment & Stores; this status updates from that checkout.</Alert> : null}
    {status === "returned" && <Alert severity="success">All equipment from this programme checkout has been returned.</Alert>}
  </Stack></DialogContent><DialogActions><Button onClick={onClose} disabled={saving}>Close</Button></DialogActions></Dialog>;
}
