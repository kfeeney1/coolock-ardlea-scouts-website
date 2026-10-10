import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import type { EventInput, EventRecord, EventStatus } from "../../services/eventAdmin";
import type { MemberRecord } from "../../services/memberAdmin";
import { EVENT_SECTIONS, EVENT_STATUSES, EVENT_TYPES, buildEventAudience, eventAudienceSummary, eventStatusLabel } from "../../services/eventManagementLogic";
import { formatSiteDate } from "../../services/siteDateFormat";

type Props = {
    open: boolean;
    editing: EventRecord | null;
    draft: EventInput;
    saving: boolean;
    members?: MemberRecord[];
    onClose: () => void;
    onChange: (draft: EventInput) => void;
    onClear?: () => void;
    onSave: () => void;
};

type EventEditorStep = "details" | "settings";

export default function EventEditorDialog({ open, editing, draft, saving, members = [], onClose, onChange, onClear, onSave }: Props) {
    const [step, setStep] = useState<EventEditorStep>("details");
    const [confirmCompletion, setConfirmCompletion] = useState(false);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const [memberSearch, setMemberSearch] = useState("");

    useEffect(() => {
        if (open) {
            setStep("details");
            setConfirmCompletion(false);
            setConfirmDiscard(false);
        }
    }, [open, editing?.id]);

    const canContinue = Boolean(draft.title.trim() && draft.startDate);
    const isEditing = Boolean(editing);
    const hasMeaningfulDraft = Boolean(
        draft.title.trim() || draft.description.trim() || draft.location.trim() || draft.meetingPoint.trim()
        || draft.returnDetails.trim() || draft.leaderNotes.trim() || draft.startDate || draft.endDate
        || draft.eventType !== "Activity" || draft.section !== "All Sections" || draft.status !== "draft"
        || draft.consentRequired || (draft.audience?.memberIds.length ?? 0) > 0 || (draft.audience?.sectionIds.length ?? 0) > 0
    );
    useEffect(() => {
        if (!open || isEditing || !hasMeaningfulDraft) return;
        const warnBeforeUnload = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", warnBeforeUnload);
        return () => window.removeEventListener("beforeunload", warnBeforeUnload);
    }, [hasMeaningfulDraft, isEditing, open]);

    const requestCancel = () => {
        if (saving) return;
        if (!isEditing && hasMeaningfulDraft) setConfirmDiscard(true);
        else onClose();
    };
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
        <Dialog open={open} onClose={confirmCompletion ? undefined : requestCancel} maxWidth="md" fullWidth data-testid="event-editor-dialog">
            <DialogTitle>{confirmDiscard ? "Discard this new event?" : confirmCompletion ? "Complete this event?" : editing ? "Edit Event" : "Add Event"}</DialogTitle>
            {confirmDiscard ? (
                <>
                    <DialogContent dividers>
                        <DialogContentText>Your event details have not been saved. Cancel creation and discard them?</DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button disabled={saving} onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
                        <Button disabled={saving} color="warning" variant="contained" onClick={() => { setConfirmDiscard(false); onClose(); }}>Discard and cancel</Button>
                    </DialogActions>
                </>
            ) : confirmCompletion ? (
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
                                    <FormControl><InputLabel id="event-editor-type-label">Event type</InputLabel><Select labelId="event-editor-type-label" label="Event type" value={draft.eventType} onChange={(event) => onChange({ ...draft, eventType: event.target.value })}>{EVENT_TYPES.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</Select></FormControl>
                                    <FormControl><InputLabel id="event-editor-section-label">Section</InputLabel><Select labelId="event-editor-section-label" label="Section" value={draft.section} onChange={(event) => onChange({ ...draft, section: event.target.value, audience: { version: 2, semantics: "snapshot", mode: "sections", sectionIds: event.target.value === "All Sections" ? [] : [event.target.value], memberIds: draft.audience?.memberIds ?? [], resolvedMemberIds: draft.audience?.resolvedMemberIds ?? [] } })}>{EVENT_SECTIONS.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}</Select></FormControl>
<Box sx={{ gridColumn: { md: "1 / -1" } }}>
                                        <Typography variant="subtitle2" gutterBottom>Event audience</Typography>
                                        <Alert severity="info" sx={{ mb: 1 }}>
                                            {eventAudienceSummary(draft.audience?.sectionIds ?? [], draft.audience?.memberIds ?? [], buildEventAudience(draft.audience?.sectionIds ?? [], draft.audience?.memberIds ?? [], members).resolvedMemberIds.length)}
                                        </Alert>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Choose whole sections, individual members, or both. The resolved audience is saved as a snapshot.</Typography>
                                        <TextField fullWidth size="small" label="Search members" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} sx={{ mb: 1 }} />
                                        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                                            {members.filter((member) => member.status === "active" && (!memberSearch.trim() || `${member.displayName} ${member.section}`.toLowerCase().includes(memberSearch.trim().toLowerCase()))).map((member) => {
                                                const selected = draft.audience?.memberIds.includes(member.id) ?? false;
                                                return <Chip key={member.id} label={`${member.displayName} · ${member.section}`} variant={selected ? "filled" : "outlined"} clickable onClick={() => {
                                                    const current = draft.audience?.memberIds ?? [];
                                                    const memberIds = selected ? current.filter((id) => id !== member.id) : [...current, member.id];
                                                    onChange({ ...draft, audience: { version: 2, semantics: "snapshot", mode: memberIds.length ? "members" : "sections", sectionIds: draft.audience?.sectionIds ?? [], memberIds, resolvedMemberIds: draft.audience?.resolvedMemberIds ?? [] } });
                                                }} />;
                                            })}
                                        </Stack>
                                    </Box>
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
                                    <FormControl><InputLabel id="event-editor-status-label">Status</InputLabel><Select labelId="event-editor-status-label" label="Status" value={draft.status} onChange={(event) => onChange({ ...draft, status: event.target.value as EventStatus })}>{EVENT_STATUSES.map((status) => <MenuItem key={status} value={status}>{eventStatusLabel(status)}</MenuItem>)}</Select></FormControl>
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
                        <Button onClick={requestCancel}>Cancel</Button>
                        {!isEditing && step === "details" ? (
                            <Button variant="contained" color="success" disabled={!canContinue} onClick={() => setStep("settings")}>Continue</Button>
                        ) : (
                            <>
                                {!isEditing && <Button onClick={() => setStep("details")}>Back</Button>}
                                {!isEditing && onClear && <Button variant="outlined" disabled={saving} onClick={() => { onClear(); setStep("details"); setMemberSearch(""); setConfirmDiscard(false); }}>Clear</Button>}<Button variant="contained" color="success" disabled={saving} onClick={requestSave}>{saving ? "Saving..." : editing ? "Save Event" : "Create Event"}</Button>
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
                {draft.eventType} · {draft.section} · {draft.startDate ? formatSiteDate(draft.startDate) : "Date not set"}{draft.endDate ? ` to ${formatSiteDate(draft.endDate)}` : ""}{draft.location ? ` · ${draft.location}` : ""}
            </Typography>
        </Box>
    );
}
