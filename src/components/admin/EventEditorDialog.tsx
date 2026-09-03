import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";

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

type EventEditorStep = "details" | "settings";

export default function EventEditorDialog({ open, editing, draft, saving, onClose, onChange, onSave }: Props) {
    const [step, setStep] = useState<EventEditorStep>("details");
    const [confirmCompletion, setConfirmCompletion] = useState(false);

    useEffect(() => {
        if (open) {
            setStep("details");
            setConfirmCompletion(false);
        }
    }, [open, editing?.id]);

    const canContinue = Boolean(draft.title.trim() && draft.startDate);
    const isEditing = Boolean(editing);
    const completingExistingEvent = Boolean(editing && editing.status !== "completed" && draft.status === "completed");

    const requestSave = () => {
        if (completingExistingEvent) {
            setConfirmCompletion(true);
            return;
        }
        onSave();
    };

    const confirmSave = () => {
        setConfirmCompletion(false);
        onSave();
    };

    return (
        <Dialog open={open} onClose={confirmCompletion ? undefined : onClose} maxWidth="md" fullWidth>
            <DialogTitle>{confirmCompletion ? "Complete this event?" : editing ? "Edit Event" : "Add Event"}</DialogTitle>
            {confirmCompletion ? (
                <>
                    <DialogContent dividers>
                        <DialogContentText sx={{ mb: 2 }}>
                            Completing <strong>{draft.title || editing?.title || "this event"}</strong> moves it into read-only event history.
                        </DialogContentText>
                        <Alert severity="warning">
                            Event details can no longer be edited after completion. Attendance remains available to view, and reports, exports and gallery access remain available.
                        </Alert>
                    </DialogContent>
                    <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
                        <Button disabled={saving} onClick={() => setConfirmCompletion(false)}>Cancel completion</Button>
                        <Button variant="contained" color="secondary" disabled={saving} onClick={confirmSave}>{saving ? "Completing..." : "Complete Event"}</Button>
                    </DialogActions>
                </>
            ) : (
                <>
                    <DialogContent dividers>
                        {!isEditing && (
                            <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2.5, flexWrap: "wrap" }}>
                                <Chip color={step === "details" ? "secondary" : "success"} label="1. Event details" />
                                <Chip color={step === "settings" ? "secondary" : "default"} label="2. Settings & create" />
                            </Stack>
                        )}

                        {(isEditing || step === "details") && (
                            <Box>
                                {!isEditing && (
                                    <>
                                        <Typography variant="h6" color="secondary" sx={{ fontWeight: 800, mb: 0.5 }}>Event details</Typography>
                                        <Typography color="text.secondary" sx={{ mb: 2 }}>Set the event identity, dates and location first.</Typography>
                                    </>
                                )}
                                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                                    <TextField required label="Event title" value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} sx={{ gridColumn: { md: "1 / -1" } }} />
                                    <FormControl><InputLabel>Event type</InputLabel><Select label="Event type" value={draft.eventType} onChange={(event) => onChange({ ...draft, eventType: event.target.value })}>{EVENT_TYPES.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</Select></FormControl>
                                    <FormControl><InputLabel>Section</InputLabel><Select label="Section" value={draft.section} onChange={(event) => onChange({ ...draft, section: event.target.value })}>{EVENT_SECTIONS.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}</Select></FormControl>
                                    <TextField required type="date" label="Start date" value={draft.startDate} onChange={(event) => onChange({ ...draft, startDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                                    <TextField type="date" label="End date" value={draft.endDate} onChange={(event) => onChange({ ...draft, endDate: event.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                                    <TextField label="Location" value={draft.location} onChange={(event) => onChange({ ...draft, location: event.target.value })} sx={{ gridColumn: { md: "1 / -1" } }} />
                                </Box>
                            </Box>
                        )}

                        {(isEditing || step === "settings") && (
                            <Box sx={{ mt: isEditing ? 2 : 0 }}>
                                {!isEditing && (
                                    <>
                                        <Typography variant="h6" color="secondary" sx={{ fontWeight: 800, mb: 0.5 }}>Settings & create</Typography>
                                        <Typography color="text.secondary" sx={{ mb: 2 }}>Add operational details, consent requirements and leader notes before creating the event.</Typography>
                                        <PaperSummary draft={draft} />
                                    </>
                                )}
                                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                                    <FormControl><InputLabel>Status</InputLabel><Select label="Status" value={draft.status} onChange={(event) => onChange({ ...draft, status: event.target.value as EventStatus })}>{EVENT_STATUSES.map((status) => <MenuItem key={status} value={status}>{eventStatusLabel(status)}</MenuItem>)}</Select></FormControl>
                                    <FormControlLabel control={<Switch checked={draft.consentRequired} onChange={(event) => onChange({ ...draft, consentRequired: event.target.checked })} />} label="Event consent required" />
                                    <TextField label="Meeting / departure details" value={draft.meetingPoint} onChange={(event) => onChange({ ...draft, meetingPoint: event.target.value })} />
                                    <TextField label="Return / collection details" value={draft.returnDetails} onChange={(event) => onChange({ ...draft, returnDetails: event.target.value })} />
                                    <TextField label="Description" multiline minRows={3} value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} sx={{ gridColumn: { md: "1 / -1" } }} />
                                    <TextField label="Leader notes" multiline minRows={3} value={draft.leaderNotes} onChange={(event) => onChange({ ...draft, leaderNotes: event.target.value })} helperText="Leader-only. Included on the leader event report." sx={{ gridColumn: { md: "1 / -1" } }} />
                                    {draft.status === "completed" && <Alert severity="warning" sx={{ gridColumn: { md: "1 / -1" } }}>Once saved as Completed, this event becomes read-only history. Reports and exports remain available.</Alert>}
                                </Box>
                            </Box>
                        )}
                    </DialogContent>
                    <DialogActions sx={{ flexWrap: "wrap", gap: 1 }}>
                        <Button onClick={onClose}>Cancel</Button>
                        {!isEditing && step === "details" ? (
                            <Button variant="contained" color="success" disabled={!canContinue} onClick={() => setStep("settings")}>Continue</Button>
                        ) : (
                            <>
                                {!isEditing && <Button onClick={() => setStep("details")}>Back</Button>}
                                <Button variant="contained" color="success" disabled={saving} onClick={requestSave}>{saving ? "Saving..." : editing ? "Save Event" : "Create Event"}</Button>
                            </>
                        )}
                    </DialogActions>
                </>
            )}
        </Dialog>
    );
}

function PaperSummary({ draft }: { draft: EventInput }) {
    return (
        <Box sx={{ mb: 2.5, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}>
            <Typography sx={{ fontWeight: 800 }}>{draft.title || "Untitled event"}</Typography>
            <Typography variant="body2" color="text.secondary">
                {draft.eventType} · {draft.section} · {draft.startDate}{draft.endDate ? ` to ${draft.endDate}` : ""}{draft.location ? ` · ${draft.location}` : ""}
            </Typography>
        </Box>
    );
}
