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
import type { EquipmentIncident, ReportEquipmentIncidentRequest } from "../../services/equipmentIncidents";
import {
  reportEquipmentIncident,
  resolveEquipmentIncident,
  sendEquipmentIncidentNotification,
  startEquipmentIncidentInvestigation
} from "../../services/equipmentIncidents";
import { canManageEquipment } from "../../services/equipmentLogic";
import { canUseEquipmentForSection, outstandingLoanQuantity } from "../../services/equipmentLoanLogic";
import {
  incidentRequiresUrgentNotification,
  incidentResolutionLabel,
  incidentStatusLabel,
  incidentTypeLabel,
  validateIncidentResolution
} from "../../services/equipmentIncidentLogic";
import type { EquipmentIncidentResolution, EquipmentIncidentType } from "../../services/equipmentIncidentLogic";

type Props = {
  profile: AdminProfile | null;
  items: EquipmentItem[];
  loans: EquipmentLoan[];
  incidents: EquipmentIncident[];
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
};

type SourceOption = {
  id: string;
  itemId: string;
  itemName: string;
  section: string;
  loanId: string;
  maximum: number;
  label: string;
};

export default function EquipmentIncidentsPanel({ profile, items, loans, incidents, onChanged, onError }: Props) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [type, setType] = useState<EquipmentIncidentType>("damaged");
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState("");
  const [resolving, setResolving] = useState<EquipmentIncident | null>(null);
  const [resolution, setResolution] = useState<EquipmentIncidentResolution>("found-returned");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const manager = canManageEquipment(profile);
  const sources = useMemo<SourceOption[]>(() => {
    const result: SourceOption[] = [];
    loans.filter((loan) => loan.status === "open" && canUseEquipmentForSection(profile, loan.section)).forEach((loan) => {
      loan.lines.forEach((line) => {
        const outstanding = outstandingLoanQuantity(line);
        if (outstanding <= 0) return;
        result.push({
          id: `loan:${loan.id}:${line.itemId}`,
          itemId: line.itemId,
          itemName: line.itemName,
          section: loan.section,
          loanId: loan.id,
          maximum: outstanding,
          label: `${loan.section} checkout · ${line.itemName} · ${outstanding} out`
        });
      });
    });
    if (manager) {
      items.filter((item) => !item.archived).forEach((item) => {
        const available = Math.max(0, item.totalQuantity - item.checkedOutQuantity - item.unavailableQuantity);
        if (available <= 0) return;
        result.push({
          id: `store:${item.id}`,
          itemId: item.id,
          itemName: item.name,
          section: "Group",
          loanId: "",
          maximum: available,
          label: `Store · ${item.name} · ${available} available`
        });
      });
    }
    return result.sort((a, b) => a.label.localeCompare(b.label));
  }, [items, loans, manager, profile]);

  const visibleIncidents = useMemo(() => {
    if (manager) return incidents.filter((incident) => incident.status !== "resolved");
    const sections = new Set(profile?.sections ?? []);
    return incidents.filter((incident) => incident.status !== "resolved" && sections.has(incident.section));
  }, [incidents, manager, profile]);

  const selectedSource = sources.find((source) => source.id === sourceId) ?? null;

  const openDialog = () => {
    setSourceId(sources.length === 1 ? sources[0].id : "");
    setType("damaged");
    setQuantity(1);
    setDescription("");
    setOpen(true);
  };

  const submit = async () => {
    onError("");
    if (!selectedSource) return onError("Choose the equipment connected to the issue.");
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > selectedSource.maximum) {
      return onError(`Enter a whole-number quantity between 1 and ${selectedSource.maximum}.`);
    }
    if (!description.trim()) return onError("Describe what happened to the equipment.");

    const request: ReportEquipmentIncidentRequest = {
      itemId: selectedSource.itemId,
      quantity,
      type,
      section: selectedSource.section,
      loanId: selectedSource.loanId || undefined,
      description
    };

    setSaving(true);
    try {
      const incidentId = await reportEquipmentIncident(request);
      setOpen(false);
      await onChanged();
      if (incidentRequiresUrgentNotification(type)) {
        try {
          await sendEquipmentIncidentNotification(incidentId);
          await onChanged();
        } catch (notificationError) {
          console.error("Unable to send equipment incident email:", notificationError);
          onError("The equipment issue was recorded and is visible on the dashboard, but the email notification could not be sent.");
        }
      }
    } catch (error) {
      console.error("Unable to report equipment issue:", error);
      onError(error instanceof Error ? error.message : "Unable to report the equipment issue.");
    } finally {
      setSaving(false);
    }
  };

  const investigate = async (incident: EquipmentIncident) => {
    setSaving(true);
    onError("");
    try {
      await startEquipmentIncidentInvestigation(incident);
      await onChanged();
    } catch (error) {
      console.error("Unable to start equipment investigation:", error);
      onError(error instanceof Error ? error.message : "Unable to update the equipment issue.");
    } finally {
      setSaving(false);
    }
  };

  const openResolution = (incident: EquipmentIncident) => {
    setResolving(incident);
    setResolution(incident.type === "damaged" || incident.type === "maintenance" ? "repaired" : "found-returned");
    setResolutionNotes("");
  };

  const submitResolution = async () => {
    if (!resolving) return;
    const validation = validateIncidentResolution(resolution, resolutionNotes);
    if (validation) return onError(validation);
    setSaving(true);
    onError("");
    try {
      await resolveEquipmentIncident(resolving, resolution, resolutionNotes);
      setResolving(null);
      await onChanged();
    } catch (error) {
      console.error("Unable to resolve equipment issue:", error);
      onError(error instanceof Error ? error.message : "Unable to resolve the equipment issue.");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 2 }} data-testid="equipment-incidents-panel">
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", md: "center" } }}>
        <Box>
          <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Broken, lost &amp; missing</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>Report damaged, lost, missing or maintenance issues. Equipment managers can investigate and resolve each report with a permanent audit trail.</Typography>
        </Box>
        <Button variant="contained" color="warning" onClick={openDialog} disabled={sources.length === 0}>Report issue</Button>
      </Stack>

      {visibleIncidents.length === 0 ? <Alert severity="success" sx={{ mt: 2 }}>No open equipment issues in your scope.</Alert> : <Stack spacing={1.25} sx={{ mt: 2 }}>
        {visibleIncidents.map((incident) => <Paper key={incident.id} variant="outlined" sx={{ p: 1.75 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ justifyContent: "space-between", alignItems: { xs: "stretch", md: "center" } }}>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                <Chip size="small" color={incident.type === "maintenance" ? "info" : "warning"} label={incidentTypeLabel(incident.type)} />
                <Chip size="small" variant="outlined" color={incident.status === "investigating" ? "info" : "default"} label={incidentStatusLabel(incident.status)} />
                <Typography sx={{ fontWeight: 800 }}>{incident.quantity} × {incident.itemName}</Typography>
                <Chip size="small" variant="outlined" label={incident.section} />
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.75 }}>{incident.description}</Typography>
              <Typography variant="caption" color="text.secondary">{incident.itemLocation || "Location not recorded"}{incident.loanId ? " · Reported from a checkout" : " · Reported from stores"}</Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { xs: "stretch", sm: "center" } }}>
              {incidentRequiresUrgentNotification(incident.type) && <Chip size="small" variant="outlined" color={incident.notificationState === "failed" ? "error" : incident.notificationState === "sent" ? "success" : "warning"} label={incident.notificationState === "sent" ? "Email sent" : incident.notificationState === "failed" ? "Email failed" : "Email pending"} />}
              {manager && incident.status === "reported" && <Button size="small" variant="outlined" onClick={() => void investigate(incident)} disabled={saving}>Start investigation</Button>}
              {manager && <Button size="small" variant="contained" color="success" onClick={() => openResolution(incident)} disabled={saving}>Resolve</Button>}
            </Stack>
          </Stack>
        </Paper>)}
      </Stack>}
    </Paper>

    <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Report equipment issue</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <FormControl fullWidth>
            <InputLabel>Equipment / checkout</InputLabel>
            <Select label="Equipment / checkout" value={sourceId} onChange={(event) => { setSourceId(event.target.value); setQuantity(1); }}>
              {sources.map((source) => <MenuItem key={source.id} value={source.id}>{source.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Issue type</InputLabel>
            <Select label="Issue type" value={type} onChange={(event) => setType(event.target.value as EquipmentIncidentType)}>
              <MenuItem value="damaged">Broken / damaged</MenuItem>
              <MenuItem value="lost">Lost</MenuItem>
              <MenuItem value="missing">Missing</MenuItem>
              <MenuItem value="maintenance">Needs cleaning / maintenance</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Quantity affected" type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} slotProps={{ htmlInput: { min: 1, max: selectedSource?.maximum ?? 1, step: 1 } }} helperText={selectedSource ? `Maximum from this source: ${selectedSource.maximum}` : "Choose the equipment first."} />
          <TextField label="What happened?" value={description} onChange={(event) => setDescription(event.target.value)} multiline minRows={3} required placeholder="Describe the damage, where the item was last seen, or what maintenance is needed." />
          {incidentRequiresUrgentNotification(type) && <Alert severity="info">Submitting this report will notify the Quartermaster / Bo'sun and Group Leader on their dashboard and by email.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button><Button variant="contained" color="warning" onClick={() => void submit()} disabled={saving}>{saving ? "Reporting…" : "Report issue"}</Button></DialogActions>
    </Dialog>

    <Dialog open={Boolean(resolving)} onClose={() => !saving && setResolving(null)} fullWidth maxWidth="sm">
      <DialogTitle>Resolve equipment issue</DialogTitle>
      <DialogContent dividers>
        {resolving && <Stack spacing={2}>
          <Alert severity="info">Resolving {resolving.quantity} × {resolving.itemName}. The affected quantity will leave the unavailable count. A write-off also reduces the total stock quantity.</Alert>
          <FormControl fullWidth>
            <InputLabel>Resolution</InputLabel>
            <Select label="Resolution" value={resolution} onChange={(event) => setResolution(event.target.value as EquipmentIncidentResolution)}>
              <MenuItem value="found-returned">{incidentResolutionLabel("found-returned")}</MenuItem>
              <MenuItem value="repaired">{incidentResolutionLabel("repaired")}</MenuItem>
              <MenuItem value="replaced">{incidentResolutionLabel("replaced")}</MenuItem>
              <MenuItem value="written-off">{incidentResolutionLabel("written-off")}</MenuItem>
              <MenuItem value="no-action">{incidentResolutionLabel("no-action")}</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Resolution notes" value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} multiline minRows={3} required={resolution === "written-off"} helperText={resolution === "written-off" ? "A reason is required for write-offs." : "Optional, but useful for the equipment history."} />
          {resolution === "written-off" && <Alert severity="warning">Writing off this incident permanently reduces the equipment total by {resolving.quantity}.</Alert>}
        </Stack>}
      </DialogContent>
      <DialogActions><Button onClick={() => setResolving(null)} disabled={saving}>Cancel</Button><Button variant="contained" color="success" onClick={() => void submitResolution()} disabled={saving}>{saving ? "Resolving…" : "Confirm resolution"}</Button></DialogActions>
    </Dialog>
  </>;
}
