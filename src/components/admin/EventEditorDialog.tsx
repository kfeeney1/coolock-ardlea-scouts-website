import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, TextField } from "@mui/material";

import type { EventInput, EventRecord, EventStatus } from "../../services/eventAdmin";
import { EVENT_SECTIONS, EVENT_STATUSES, EVENT_TYPES, eventStatusLabel } from "../../services/eventManagementLogic";

type Props = {
    open: boolean;
    editing: EventRecord | null;
    draft: EventInput;
    saving: boolean;
    onClose: () => void;
    onChange: (draft: EventInput) => void;
    onSave: () => void;
};

export default function EventEditorDialog({ open, editing, draft, saving, onClose, onChange, onSave }: Props) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{editing ? "Edit Event" : "Add Event"}</DialogTitle>
            <DialogContent dividers>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                    <TextField required label="Event title" value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} sx={{ gridColumn: { md: "1 / -1" } }} />
                    <FormControl><InputLabel>Event type</InputLabel><Select label="Event type" value={draft.eventType} onChange={(event) => onChange({ ...draft, eventType: event.target.value })}>{EVENT_TYPES.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</Select></FormControl>
                    <FormControl><InputLabel>Section</InputLabel><Select label="Section" value={draft.section} onChange={(event) => onChange({ ...draft, section: event.target.value })}>{EVENT_SECTIONS.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}</Select></FormControl>
                    <TextField required type="date" label="Start date" value={draft.startDate} onChange={(event) => onChange({ ...draft, startDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                    <TextField type="date" label="End date" value={draft.endDate} onChange={(event) => onChange({ ...draft, endDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                    <TextField label="Location" value={draft.location} onChange={(event) => onChange({ ...draft, location: event.target.value })} />
                    <FormControl><InputLabel>Status</InputLabel><Select label="Status" value={draft.status} onChange={(event) => onChange({ ...draft, status: event.target.value as EventStatus })}>{EVENT_STATUSES.map((status) => <MenuItem key={status} value={status}>{eventStatusLabel(status)}</MenuItem>)}</Select></FormControl>
                    <TextField label="Meeting / departure details" value={draft.meetingPoint} onChange={(event) => onChange({ ...draft, meetingPoint: event.target.value })} />
                    <TextField label="Return / collection details" value={draft.returnDetails} onChange={(event) => onChange({ ...draft, returnDetails: event.target.value })} />
                    <TextField label="Description" multiline minRows={3} value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} sx={{ gridColumn: { md: "1 / -1" } }} />
                    <TextField label="Leader notes" multiline minRows={3} value={draft.leaderNotes} onChange={(event) => onChange({ ...draft, leaderNotes: event.target.value })} helperText="Leader-only. Included on the leader event report." sx={{ gridColumn: { md: "1 / -1" } }} />
                    <FormControlLabel control={<Switch checked={draft.consentRequired} onChange={(event) => onChange({ ...draft, consentRequired: event.target.checked })} />} label="Event consent required" sx={{ gridColumn: { md: "1 / -1" } }} />
                    {draft.status === "completed" && <Alert severity="warning" sx={{ gridColumn: { md: "1 / -1" } }}>Once saved as Completed, this event becomes read-only history. Reports and exports remain available.</Alert>}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" color="success" disabled={saving} onClick={onSave}>{saving ? "Saving..." : "Save Event"}</Button>
            </DialogActions>
        </Dialog>
    );
}
