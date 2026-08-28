import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Paper, Select, Typography } from "@mui/material";

import type { MemberRecord } from "../../services/memberAdmin";
import type { AttendanceStatus, EventConsentStatus, EventRecord } from "../../services/eventAdmin";

type Props = {
    event: EventRecord | null;
    members: MemberRecord[];
    attendance: Record<string, AttendanceStatus>;
    consent: Record<string, EventConsentStatus>;
    saving: boolean;
    onAttendanceChange: (attendance: Record<string, AttendanceStatus>) => void;
    onConsentChange: (consent: Record<string, EventConsentStatus>) => void;
    onClose: () => void;
    onSave: () => void;
    onPrint: () => void;
    onExport: () => void;
};

export default function EventRosterDialog({ event, members, attendance, consent, saving, onAttendanceChange, onConsentChange, onClose, onSave, onPrint, onExport }: Props) {
    const readOnly = event?.status === "completed";
    return (
        <Dialog open={Boolean(event)} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle>{readOnly ? "Event Attendance History" : "Attendance & Consent"}</DialogTitle>
            <DialogContent dividers>
                {readOnly && <Alert severity="info" sx={{ mb: 2 }}>Attendance for this completed event is read-only.</Alert>}
                {members.length === 0 ? <Alert severity="info">No active members are available for this event section.</Alert> : (
                    <Box sx={{ display: "grid", gap: 1.5 }}>
                        {members.map((member) => (
                            <Paper key={member.id} variant="outlined" sx={{ p: 2 }}>
                                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" }, gap: 2, alignItems: "center" }}>
                                    <Box><Typography sx={{ fontWeight: 700 }}>{member.displayName}</Typography><Typography variant="body2" color="text.secondary">{member.section}{member.parentName ? ` · ${member.parentName}` : ""}</Typography></Box>
                                    <FormControl size="small" disabled={readOnly}><InputLabel>Attendance</InputLabel><Select label="Attendance" value={attendance[member.id] || "invited"} onChange={(change) => onAttendanceChange({ ...attendance, [member.id]: change.target.value as AttendanceStatus })}><MenuItem value="invited">Invited</MenuItem><MenuItem value="attending">Attending</MenuItem><MenuItem value="not-attending">Not attending</MenuItem></Select></FormControl>
                                    <FormControl size="small" disabled={readOnly}><InputLabel>Consent</InputLabel><Select label="Consent" value={consent[member.id] || (event?.consentRequired ? "required" : "not-required")} onChange={(change) => onConsentChange({ ...consent, [member.id]: change.target.value as EventConsentStatus })}><MenuItem value="not-required">Not required</MenuItem><MenuItem value="required">Outstanding</MenuItem><MenuItem value="received">Received</MenuItem></Select></FormControl>
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                {event && <><Button color="secondary" onClick={onPrint}>Report</Button><Button color="secondary" onClick={onExport}>Export CSV</Button></>}
                <Button onClick={onClose}>Close</Button>
                {!readOnly && <Button variant="contained" color="success" disabled={saving} onClick={onSave}>{saving ? "Saving..." : "Save Attendance"}</Button>}
            </DialogActions>
        </Dialog>
    );
}
