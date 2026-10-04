import { applicationErrorMessage } from "../../services/applicationErrors.ts";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import type { AdminProfile } from "./AdminAuthProvider";
import type { EquipmentItem } from "../../services/equipment";
import { returnEquipment } from "../../services/equipmentLoans";
import type { EquipmentLoan } from "../../services/equipmentLoans";
import { canUseEquipmentForSection, outstandingLoanQuantity } from "../../services/equipmentLoanLogic";
import { isEquipmentReservationLoan } from "../../services/equipmentProgrammeLogic";

type Props = {
  item: EquipmentItem;
  loans: EquipmentLoan[];
  profile: AdminProfile | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
};

export default function EquipmentItemReturnDialog({ item, loans, profile, open, onClose, onChanged, onError }: Props) {
  const eligibleLoans = useMemo(() => loans.filter((loan) =>
    loan.status === "open"
    && !isEquipmentReservationLoan(loan)
    && canUseEquipmentForSection(profile, loan.section)
    && loan.lines.some((line) => line.itemId === item.id && outstandingLoanQuantity(line) > 0)
  ), [item.id, loans, profile]);
  const [loanId, setLoanId] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [saving, setSaving] = useState(false);
  const selectedLoan = eligibleLoans.find((loan) => loan.id === loanId) ?? null;
  const selectedLine = selectedLoan?.lines.find((line) => line.itemId === item.id) ?? null;
  const outstanding = selectedLine ? outstandingLoanQuantity(selectedLine) : 0;

  useEffect(() => {
    if (!open) return;
    const initialLoan = eligibleLoans[0];
    setLoanId(initialLoan?.id ?? "");
    const line = initialLoan?.lines.find((candidate) => candidate.itemId === item.id);
    setQuantity(line ? outstandingLoanQuantity(line) : 0);
  }, [open, eligibleLoans, item.id]);

  const selectLoan = (nextId: string) => {
    setLoanId(nextId);
    const line = eligibleLoans.find((loan) => loan.id === nextId)?.lines.find((candidate) => candidate.itemId === item.id);
    setQuantity(line ? outstandingLoanQuantity(line) : 0);
  };

  const submit = async () => {
    if (!selectedLoan || !selectedLine || !canUseEquipmentForSection(profile, selectedLoan.section)) {
      onError("You are not authorised to return this equipment checkout.");
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > outstanding) {
      onError(`Enter a return quantity between 1 and ${outstanding}.`);
      return;
    }
    setSaving(true);
    onError("");
    try {
      await returnEquipment({ loanId: selectedLoan.id, quantities: { [item.id]: quantity } });
      await onChanged();
      onClose();
    } catch (error) {
      onError(applicationErrorMessage(error, "Unable to check in this equipment.", "EquipmentItemReturnDialog"));
    } finally {
      setSaving(false);
    }
  };

  return <Dialog open={open} onClose={() => !saving && onClose()} fullWidth maxWidth="sm" aria-labelledby="equipment-record-return-title">
    <DialogTitle id="equipment-record-return-title">Check in / Return {item.name}</DialogTitle>
    <DialogContent dividers>
      {eligibleLoans.length === 0 ? <Alert severity="info">There are no open checkouts for this item that you can return.</Alert> : <Stack spacing={2}>
        <Typography>Select the section checkout that is returning this equipment.</Typography>
        <FormControl fullWidth>
          <InputLabel id="equipment-return-checkout-label">Checkout</InputLabel>
          <Select labelId="equipment-return-checkout-label" label="Checkout" value={selectedLoan?.id ?? ""} onChange={(event) => selectLoan(event.target.value)}>
            {eligibleLoans.map((loan) => {
              const line = loan.lines.find((candidate) => candidate.itemId === item.id)!;
              return <MenuItem key={loan.id} value={loan.id}>{loan.section} · due {loan.expectedReturnDate} · {outstandingLoanQuantity(line)} checked out</MenuItem>;
            })}
          </Select>
        </FormControl>
        {selectedLoan && selectedLine && <>
          <Typography variant="body2" color="text.secondary">{selectedLine.itemName} · {selectedLoan.section} checkout · {outstanding} currently checked out</Typography>
          <TextField label="Quantity to check in" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value === "" ? 0 : Number(event.target.value))} slotProps={{ htmlInput: { min: 1, max: outstanding, step: 1 } }} fullWidth />
        </>}
      </Stack>}
    </DialogContent>
    <DialogActions>
      <Button disabled={saving} onClick={onClose}>Cancel</Button>
      <Button variant="contained" color="success" disabled={saving || !selectedLoan || !selectedLine || quantity < 1 || quantity > outstanding || !Number.isInteger(quantity)} onClick={() => void submit()}>{saving ? "Checking in…" : "Confirm check in"}</Button>
    </DialogActions>
  </Dialog>;
}
