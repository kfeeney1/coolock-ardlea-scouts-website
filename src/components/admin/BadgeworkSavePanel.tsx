import { Box, Button, Paper, Stack, Typography } from "@mui/material";

type Props = {
  disabled: boolean;
  onDiscard: () => void;
  onSave: () => void;
  onSaveAndReturn?: () => void;
  returnLabel?: string;
  saving: boolean;
  unsavedChangeCount: number;
};

export default function BadgeworkSavePanel({ disabled, onDiscard, onSave, onSaveAndReturn, returnLabel, saving, unsavedChangeCount }: Props) {
  const hasChanges = unsavedChangeCount > 0;
  return <Paper variant="outlined" sx={{ mt: 3, p: 2 }} data-testid="badgework-save-panel">
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}>
      <Box><Typography sx={{ fontWeight: 800 }}>{hasChanges ? `${unsavedChangeCount} unsaved ${unsavedChangeCount === 1 ? "change" : "changes"}` : "No unsaved changes"}</Typography><Typography variant="body2" color="text.secondary">Nothing is written to the member records until you save.</Typography></Box>
      <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={1}>
        <Button disabled={disabled || !hasChanges} onClick={onDiscard}>Discard</Button>
        <Button variant={onSaveAndReturn ? "outlined" : "contained"} color="success" disabled={disabled || !hasChanges} onClick={onSave}>{saving ? "Saving…" : "Save changes"}</Button>
        {onSaveAndReturn && <Button variant="contained" color="success" disabled={disabled || !hasChanges} onClick={onSaveAndReturn}>Save and return to {returnLabel}</Button>}
      </Stack>
    </Stack>
  </Paper>;
}
