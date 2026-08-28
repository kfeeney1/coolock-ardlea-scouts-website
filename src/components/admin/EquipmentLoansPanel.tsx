import {
  Alert,
  Box,
  Button,
  Chip,
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
import { useMemo, useState } from "react";
import type { AdminProfile } from "./AdminAuthProvider";
import type { EquipmentItem } from "../../services/equipment";
import type { EquipmentLoan } from "../../services/equipmentLoans";
import { checkoutEquipment, returnEquipment } from "../../services/equipmentLoans";
import {
  availableEquipmentQuantity,
  canUseEquipmentForSection,
  checkoutSectionOptions,
  outstandingLoanQuantity,
  validateCheckoutQuantity
} from "../../services/equipmentLoanLogic";

function defaultReturnDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

type Props = {
  profile: AdminProfile | null;
  items: EquipmentItem[];
  loans: EquipmentLoan[];
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
};

export default function EquipmentLoansPanel({ profile, items, loans, onChanged, onError }: Props) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState(defaultReturnDate());
  const [notes, setNotes] = useState("");
  const [checkoutQuantities, setCheckoutQuantities] = useState<Record<string, number>>({});
  const [returningLoan, setReturningLoan] = useState<EquipmentLoan | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const sectionOptions = useMemo(() => checkoutSectionOptions(profile), [profile]);
  const activeItems = useMemo(() => items.filter((item) => !item.archived), [items]);
  const openLoans = useMemo(() => loans.filter((loan) => loan.status === "open"), [loans]);
  const sectionsWithHoldings = useMemo(() => Array.from(new Set(openLoans.map((loan) => loan.section))).sort((a, b) => a.localeCompare(b)), [openLoans]);

  const openCheckout = () => {
    setSelectedSection(sectionOptions.length === 1 ? sectionOptions[0] : "");
    setExpectedReturnDate(defaultReturnDate());
    setNotes("");
    setCheckoutQuantities({});
    setCheckoutOpen(true);
  };

  const submitCheckout = async () => {
    onError("");
    if (!selectedSection) return onError("Choose the section taking the equipment.");
    if (!canUseEquipmentForSection(profile, selectedSection)) return onError("You are not authorised to issue equipment to that section.");
    const requested = activeItems
      .map((item) => ({ item, quantity: checkoutQuantities[item.id] ?? 0 }))
      .filter(({ quantity }) => quantity > 0);
    if (requested.length === 0) return onError("Select at least one equipment item.");
    for (const { item, quantity } of requested) {
      const validation = validateCheckoutQuantity(item, quantity);
      if (validation) return onError(validation);
    }

    setSaving(true);
    try {
      await checkoutEquipment({
        section: selectedSection,
        expectedReturnDate,
        notes,
        lines: requested.map(({ item, quantity }) => ({ itemId: item.id, quantity }))
      });
      setCheckoutOpen(false);
      await onChanged();
    } catch (error) {
      console.error("Unable to check out equipment:", error);
      onError(error instanceof Error ? error.message : "Unable to check out equipment.");
    } finally {
      setSaving(false);
    }
  };

  const openReturn = (loan: EquipmentLoan) => {
    setReturningLoan(loan);
    setReturnQuantities(Object.fromEntries(loan.lines.map((line) => [line.itemId, outstandingLoanQuantity(line)])));
  };

  const submitReturn = async () => {
    if (!returningLoan) return;
    onError("");
    setSaving(true);
    try {
      await returnEquipment({ loanId: returningLoan.id, quantities: returnQuantities });
      setReturningLoan(null);
      await onChanged();
    } catch (error) {
      console.error("Unable to return equipment:", error);
      onError(error instanceof Error ? error.message : "Unable to return equipment.");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 2 }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2}>
        <Box>
          <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Check-out & section holdings</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>Leaders can issue shared equipment to their section and record partial or full returns.</Typography>
        </Box>
        <Button variant="contained" color="success" onClick={openCheckout} disabled={sectionOptions.length === 0}>Check out equipment</Button>
      </Stack>

      {sectionsWithHoldings.length === 0 ? <Alert severity="info" sx={{ mt: 2 }}>No equipment is currently checked out.</Alert> : <Stack spacing={2} sx={{ mt: 2 }}>
        {sectionsWithHoldings.map((section) => {
          const sectionLoans = openLoans.filter((loan) => loan.section === section);
          return <Box key={section}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{section}</Typography>
            <Stack spacing={1.25}>{sectionLoans.map((loan) => {
              const outstanding = loan.lines.filter((line) => outstandingLoanQuantity(line) > 0);
              const canReturn = canUseEquipmentForSection(profile, loan.section);
              return <Paper key={loan.id} variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={2}>
                  <Box>
                    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
                      <Chip label={`Due ${loan.expectedReturnDate}`} variant="outlined" />
                      {new Date(`${loan.expectedReturnDate}T23:59:59`) < new Date() && <Chip label="Overdue" color="warning" />}
                    </Stack>
                    <Typography>{outstanding.map((line) => `${outstandingLoanQuantity(line)} × ${line.itemName}`).join(" · ")}</Typography>
                    {loan.notes && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{loan.notes}</Typography>}
                  </Box>
                  {canReturn && <Button variant="outlined" onClick={() => openReturn(loan)}>Return equipment</Button>}
                </Stack>
              </Paper>;
            })}</Stack>
          </Box>;
        })}
      </Stack>}
    </Paper>

    <Dialog open={checkoutOpen} onClose={() => !saving && setCheckoutOpen(false)} fullWidth maxWidth="md">
      <DialogTitle>Check out equipment</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <FormControl fullWidth><InputLabel>Section</InputLabel><Select label="Section" value={selectedSection} onChange={(event) => setSelectedSection(event.target.value)}>{sectionOptions.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}</Select></FormControl>
          <TextField label="Expected return date" type="date" value={expectedReturnDate} onChange={(event) => setExpectedReturnDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Checkout notes" value={notes} onChange={(event) => setNotes(event.target.value)} multiline minRows={2} placeholder="Optional event, camp or collection note" />
          <Typography sx={{ fontWeight: 800 }}>Equipment</Typography>
          <Stack spacing={1.25}>{activeItems.map((item) => {
            const available = availableEquipmentQuantity(item);
            return <Paper key={item.id} variant="outlined" sx={{ p: 1.5 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
                <Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 700 }}>{item.name}</Typography><Typography variant="body2" color="text.secondary">{item.category} · {available} available</Typography></Box>
                <TextField label="Qty" type="number" value={checkoutQuantities[item.id] ?? 0} disabled={available === 0} onChange={(event) => setCheckoutQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))} slotProps={{ htmlInput: { min: 0, max: available, step: 1 } }} sx={{ width: { sm: 120 } }} />
              </Stack>
            </Paper>;
          })}</Stack>
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={() => setCheckoutOpen(false)} disabled={saving}>Cancel</Button><Button variant="contained" color="success" onClick={() => void submitCheckout()} disabled={saving}>{saving ? "Checking out…" : "Confirm checkout"}</Button></DialogActions>
    </Dialog>

    <Dialog open={Boolean(returningLoan)} onClose={() => !saving && setReturningLoan(null)} fullWidth maxWidth="sm">
      <DialogTitle>Return equipment{returningLoan ? ` · ${returningLoan.section}` : ""}</DialogTitle>
      <DialogContent dividers>
        {returningLoan && <Stack spacing={1.5}>{returningLoan.lines.filter((line) => outstandingLoanQuantity(line) > 0).map((line) => {
          const outstanding = outstandingLoanQuantity(line);
          return <Paper key={line.itemId} variant="outlined" sx={{ p: 1.5 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
              <Box sx={{ flex: 1 }}><Typography sx={{ fontWeight: 700 }}>{line.itemName}</Typography><Typography variant="body2" color="text.secondary">{outstanding} currently checked out</Typography></Box>
              <TextField label="Return" type="number" value={returnQuantities[line.itemId] ?? 0} onChange={(event) => setReturnQuantities((current) => ({ ...current, [line.itemId]: Number(event.target.value) }))} slotProps={{ htmlInput: { min: 0, max: outstanding, step: 1 } }} sx={{ width: { sm: 130 } }} />
            </Stack>
          </Paper>;
        })}</Stack>}
      </DialogContent>
      <DialogActions><Button onClick={() => setReturningLoan(null)} disabled={saving}>Cancel</Button><Button variant="contained" color="success" onClick={() => void submitReturn()} disabled={saving}>{saving ? "Returning…" : "Confirm return"}</Button></DialogActions>
    </Dialog>
  </>;
}
