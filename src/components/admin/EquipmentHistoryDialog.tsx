import { applicationErrorMessage } from "../../services/applicationErrors.ts";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import type { EquipmentItem } from "../../services/equipment";
import { loadEquipmentHistory } from "../../services/equipmentHistory";
import type { EquipmentHistoryEntry } from "../../services/equipmentHistory";
import { equipmentHistoryLabel } from "../../services/equipmentHistoryLogic";

type Props = {
  item: EquipmentItem | null;
  onClose: () => void;
  onError: (message: string) => void;
};

function formatDate(value: Date | null): string {
  if (!value) return "Time unavailable";
  return value.toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" });
}

export default function EquipmentHistoryDialog({ item, onClose, onError }: Props) {
  const [history, setHistory] = useState<EquipmentHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item) return;
    setLoading(true);
    void loadEquipmentHistory(item.id)
      .then(setHistory)
      .catch((error) => {
        onError(applicationErrorMessage(error, "Unable to load the history for that equipment item.", "EquipmentHistoryDialog"));
      })
      .finally(() => setLoading(false));
  }, [item, onError]);

  return <Dialog open={Boolean(item)} onClose={onClose} fullWidth maxWidth="md">
    <DialogTitle>{item ? `${item.name} history` : "Equipment history"}</DialogTitle>
    <DialogContent dividers>
      {item && <Stack spacing={2.5}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>Timeline</Typography>
          {loading ? <Alert severity="info">Loading equipment history…</Alert> : history.length === 0 ? <Alert severity="info">No item history has been recorded yet. New stock changes, checkouts, returns, issues and movements will appear here.</Alert> : <Stack spacing={1.25}>
            {history.map((entry) => <Paper key={entry.id} variant="outlined" sx={{ p: 2 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>{equipmentHistoryLabel(entry.type)}</Typography>
                  <Typography variant="body2" color="text.secondary">{formatDate(entry.createdAt)}</Typography>
                </Box>
                <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
                  {entry.quantity > 0 && <Chip size="small" label={`${entry.quantity} item${entry.quantity === 1 ? "" : "s"}`} />}
                  {entry.section && entry.section !== "Group" && <Chip size="small" variant="outlined" label={entry.section} />}
                </Stack>
              </Stack>
              <Typography variant="body2" sx={{ mt: 1 }}>{entry.details}</Typography>
              {(entry.fromLocation || entry.toLocation) && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>{entry.fromLocation && entry.toLocation ? `${entry.fromLocation} → ${entry.toLocation}` : entry.toLocation || entry.fromLocation}</Typography>}
            </Paper>)}
          </Stack>}
        </Box>
      </Stack>}
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
  </Dialog>;
}
