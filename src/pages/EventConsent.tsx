import {
    Alert,
    Box,
    Button,
    Checkbox,
    CircularProgress,
    Container,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import {
    loadPublicEventLink,
    submitEventConsentResponse
} from "../services/eventConsent";
import type { PublicEventLink } from "../services/eventConsent";

export default function EventConsent() {
    const { token = "" } = useParams();
    const [event, setEvent] = useState<PublicEventLink | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [childName, setChildName] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [parentName, setParentName] = useState("");
    const [attendance, setAttendance] = useState<"attending" | "not-attending">("attending");
    const [consentGiven, setConsentGiven] = useState(false);
    const [emergencyConfirmed, setEmergencyConfirmed] = useState(false);
    const [medicalDetails, setMedicalDetails] = useState<"current" | "changed" | "">("");

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError("");

            try {
                const result = await loadPublicEventLink(token);

                if (!result || !result.active) {
                    setError("This event consent link is not available or is no longer active.");
                    return;
                }

                setEvent(result);
            } catch (loadError) {
                console.error("Unable to load event consent link:", loadError);
                setError("Unable to load this event consent form.");
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [token]);

    const submit = async () => {
        if (!event) return;

        setError("");

        if (!childName.trim() || !dateOfBirth || !parentName.trim()) {
            setError("Enter the young person's name, date of birth and parent / guardian name.");
            return;
        }

        if (attendance === "attending") {
            if (event.consentRequired && !consentGiven) {
                setError("Consent is required for attendance at this event.");
                return;
            }

            if (!emergencyConfirmed) {
                setError("Please confirm the emergency contact information held by the group.");
                return;
            }

            if (!medicalDetails) {
                setError("Please confirm whether medical or emergency information has changed.");
                return;
            }
        }

        setSaving(true);

        try {
            await submitEventConsentResponse({
                token: event.token,
                eventId: event.eventId,
                childName,
                dateOfBirth,
                parentName,
                attendance,
                consentGiven:
                    attendance === "attending" &&
                    event.consentRequired &&
                    consentGiven,
                emergencyDetailsConfirmed:
                    attendance === "attending" && emergencyConfirmed,
                medicalDetailsChanged:
                    attendance === "attending" && medicalDetails === "changed"
            });

            setSubmitted(true);
        } catch (submitError) {
            console.error("Unable to submit event consent:", submitError);
            setError("Unable to submit your response. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ minHeight: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CircularProgress color="success" />
            </Box>
        );
    }

    return (
        <Box sx={{ minHeight: "70vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="md">
                <Paper elevation={3} sx={{ p: { xs: 2.5, md: 4 }, borderTop: "6px solid", borderTopColor: "secondary.main" }}>
                    <Typography variant="h3" color="secondary" sx={{ fontWeight: 800 }}>
                        Event Consent
                    </Typography>

                    {error && <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>}

                    {submitted ? (
                        <Alert severity="success" sx={{ mt: 3 }}>
                            Thank you. Your event response has been submitted to Coolock Ardlea Scouts.
                        </Alert>
                    ) : event ? (
                        <>
                            <Typography variant="h5" sx={{ mt: 3, fontWeight: 800 }}>
                                {event.title}
                            </Typography>

                            <Typography sx={{ mt: 1 }}>
                                {event.startDate}
                                {event.endDate && event.endDate !== event.startDate ? ` to ${event.endDate}` : ""}
                                {event.location ? ` · ${event.location}` : ""}
                            </Typography>

                            <Stack spacing={0.75} sx={{ mt: 1.5 }}>
                                {event.eventType && <Typography color="text.secondary">Type: {event.eventType}</Typography>}
                                {event.section && <Typography color="text.secondary">Section: {event.section}</Typography>}
                                {event.meetingPoint && <Typography color="text.secondary">Meeting point: {event.meetingPoint}</Typography>}
                                {event.returnDetails && <Typography color="text.secondary">Return / collection: {event.returnDetails}</Typography>}
                                {event.description && <Typography color="text.secondary">{event.description}</Typography>}
                            </Stack>

                            <Alert severity="info" sx={{ mt: 3 }}>
                                This form records attendance and event-specific consent only. It does not replace the group's main annual consent record.
                            </Alert>

                            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5, mt: 3 }}>
                                <TextField
                                    required
                                    label="Young person's full name"
                                    value={childName}
                                    onChange={(e) => setChildName(e.target.value)}
                                    sx={{ gridColumn: { sm: "1 / -1" } }}
                                />

                                <TextField
                                    required
                                    type="date"
                                    label="Date of birth"
                                    value={dateOfBirth}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                    onChange={(e) => setDateOfBirth(e.target.value)}
                                />

                                <TextField
                                    required
                                    label="Parent / guardian name"
                                    value={parentName}
                                    onChange={(e) => setParentName(e.target.value)}
                                />

                                <FormControl sx={{ gridColumn: { sm: "1 / -1" } }}>
                                    <InputLabel>Attendance</InputLabel>
                                    <Select
                                        label="Attendance"
                                        value={attendance}
                                        onChange={(e) => {
                                            const value = e.target.value as "attending" | "not-attending";
                                            setAttendance(value);
                                            if (value === "not-attending") {
                                                setConsentGiven(false);
                                                setEmergencyConfirmed(false);
                                                setMedicalDetails("");
                                            }
                                        }}
                                    >
                                        <MenuItem value="attending">Will attend</MenuItem>
                                        <MenuItem value="not-attending">Will not attend</MenuItem>
                                    </Select>
                                </FormControl>
                            </Box>

                            {attendance === "attending" && (
                                <Stack spacing={2} sx={{ mt: 3 }}>
                                    {event.consentRequired && (
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={consentGiven}
                                                    onChange={(e) => setConsentGiven(e.target.checked)}
                                                />
                                            }
                                            label="I give permission for the young person named above to attend and take part in this event."
                                        />
                                    )}

                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={emergencyConfirmed}
                                                onChange={(e) => setEmergencyConfirmed(e.target.checked)}
                                            />
                                        }
                                        label="I confirm the emergency contact information already held by the Scout Group is correct."
                                    />

                                    <FormControl>
                                        <InputLabel>Medical / emergency information</InputLabel>
                                        <Select
                                            label="Medical / emergency information"
                                            value={medicalDetails}
                                            onChange={(e) => setMedicalDetails(e.target.value as "current" | "changed")}
                                        >
                                            <MenuItem value="current">No changes</MenuItem>
                                            <MenuItem value="changed">Details have changed — I will contact a leader</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Stack>
                            )}

                            <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 4 }}>
                                <Button variant="contained" color="success" size="large" disabled={saving} onClick={() => void submit()}>
                                    {saving ? "Submitting..." : "Submit Event Response"}
                                </Button>
                            </Box>
                        </>
                    ) : null}
                </Paper>
            </Container>
        </Box>
    );
}
