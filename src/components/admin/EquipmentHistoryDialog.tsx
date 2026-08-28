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
import { useEffect, useMemo, useState } from "react";
import type { EquipmentItem } from "../../services/equipment";
import { loadEquipmentHistory, moveEquipmentStock } from "../../services/equipmentHistory";
import type { EquipmentHistoryEntry } from "../../services/equipmentHistory";
import { equipmentHistoryLabel } from "../../services/equipmentHistoryLogic";
import { availableEquipmentQuantity } from "../../services/equipmentLoanLogic";

type Props = {
  item: EquipmentItem | null;
  locations: string[];
  canManage: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
};

function formatDate(value: Date | null): string {
  if (!value) return "Time unavailable";
  return value.toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" });
}

export default function EquipmentHistoryDialog({ item, locations, canManage, onClose, onChanged, onError }: Props) {
  const [history, setHistory] = useState<EquipmentHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [destination, setDestination] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setDestination("");
    setQuantity(1);
    setLoading(true);
    void loadEquipmentHistory(item.id)
      .then(setHistory)
      .catch((error) => {
        console.error("Unable to load equipment history:", error);
        onError("Unable to load the history for that equipment item.");
      })
      .finally(() => setLoading(false));
  }, [item, onError]);

  const available = item ? availableEquipmentQuantity(item) : 0;
  const destinations = useMemo(() => locations.filter((location) => item && location.toLowerCase() !== item.location.toLowerCase()), [item, locations]);

  const move = async () => {
    if (!item) return;
    setMoving(true);
    try {
      await moveEquipmentStock(item, quantity, destination);
      await onChanged();
      setHistory(await loadEquipmentHistory(item.id));
      setDestination("");
      setQuantity(1);
    } catch (error) {
      console.error("Unable to move equipment stock:", error);
      onError(error instanceof Error ? error.message : "Unable to move that equipment stock.");
    } finally {
      setMoving(false);
    }
  };

  return <Dialog open={Boolean(item)} onClose={() => !moving && onClose()} fullWidth maxWidth="md">
    <DialogTitle>{item ? `${item.name} history` : "Equipment history"}</DialogTitle>
    <DialogContent dividers>
      {item && <Stack spacing={2.5}>
        {canManage && !item.archived && available > 0 && destinations.length > 0 && <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>Move stock</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Move available stock from {item.location}. Partial moves create a separate stock record at the destination so each location keeps an accurate quantity.</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <FormControl fullWidth><InputLabel>Destination</InputLabel><Select label="Destination" value={destination} onChange={(event) => setDestination(event.target.value)}>{destinations.map((location) => <MenuItem key={location} value={location}>{location}</MenuItem>)}</Select></FormControl>
            <TextField label="Quantity to move" type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} slotProps={{ htmlInput: { min: 1, max: available, step: 1 } }} helperText={`${available} available`} />
            <Button variant="contained" color="success" disabled={moving || !destination || quantity < 1 || quantity > available || !Number.isInteger(quantity)} onClick={() => void move()} sx={{ minWidth: { sm: 120 } }}>{moving ? "Moving…" : "Move stock"}</Button>
          </Stack>
        </Paper>}

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
    <DialogActions><Button onClick={onClose} disabled={moving}>Close</Button></DialogActions>
  </Dialog>;
}
