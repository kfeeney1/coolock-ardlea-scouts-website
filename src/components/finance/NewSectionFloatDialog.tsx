import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Stack, TextField, Typography } from "@mui/material";
import StableSelect from "../StableSelect";

type Props = {
  open: boolean; saving: boolean; sections: string[]; section: string; amount: string; date: string; note: string;
  onSectionChange: (value: string) => void; onAmountChange: (value: string) => void; onDateChange: (value: string) => void;
  onNoteChange: (value: string) => void; onClose: () => void; onCreate: () => void;
};

function validCurrencyInput(value: string) {
  const normalised = value.replace(",", ".");
  return normalised === "" || /^\d+(\.\d{0,2})?$/.test(normalised);
}
function validOpeningAmount(value: string) {
  const normalised = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) return false;
  return Number(normalised) > 0;
}

export default function NewSectionFloatDialog(props: Props) {
  const { open, saving, sections, section, amount, date, note, onSectionChange, onAmountChange, onDateChange, onNoteChange, onClose, onCreate } = props;
  return <Dialog open={open} onClose={() => { if (!saving) onClose(); }} fullWidth maxWidth="sm" aria-labelledby="new-float-title">
    <DialogTitle id="new-float-title">New section float</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 1 }}>
        <Typography color="text.secondary">Assign the float to a section you are permitted to manage and record its opening balance. It will then use the normal section transaction, reconciliation and reporting workflow.</Typography>
        <FormControl fullWidth required><InputLabel id="new-float-section-label">Section</InputLabel><StableSelect labelId="new-float-section-label" id="new-float-section" label="Section" value={section} onChange={(event) => onSectionChange(String(event.target.value))}>{sections.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</StableSelect></FormControl>
        <TextField required label="Opening amount (€)" value={amount} onChange={(event) => { if (validCurrencyInput(event.target.value)) onAmountChange(event.target.value.replace(",", ".")); }} helperText="Maximum two decimal places." slotProps={{ htmlInput: { inputMode: "decimal", pattern: "[0-9]*[.,]?[0-9]{0,2}" } }} />
        <TextField required type="date" label="Opening date" value={date} onChange={(event) => onDateChange(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField label="Opening note (optional)" value={note} onChange={(event) => onNoteChange(event.target.value)} />
      </Stack>
    </DialogContent>
    <DialogActions><Button onClick={onClose} disabled={saving}>Cancel</Button><Button variant="contained" color="success" onClick={onCreate} disabled={saving || !section || !date || !validOpeningAmount(amount)}>{saving ? "Creating…" : "Create float"}</Button></DialogActions>
  </Dialog>;
}
