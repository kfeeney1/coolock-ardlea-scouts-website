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
import { useEffect, useMemo, useState } from "react";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { recordAuditEvent } from "../services/auditLog";
import {
    communicationTemplates,
    eligibleCommunicationRecipients,
    validateCommunication
} from "../services/communicationLogic";
import type { CommunicationRecipient, CommunicationTemplate } from "../services/communicationLogic";
import { loadCommunicationRecipients } from "../services/communications";
import { sendLeaderCommunication } from "../services/emailNotifications";

export default function LeaderCommunications() {
    const { adminProfile } = useAdminAuth();
    const [recipients, setRecipients] = useState<CommunicationRecipient[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [sectionFilter, setSectionFilter] = useState("all");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [template, setTemplate] = useState<CommunicationTemplate>("general");
    const [subject, setSubject] = useState(communicationTemplates.general.subject);
    const [body, setBody] = useState(communicationTemplates.general.message);

    const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";
    const sections = adminProfile?.sections || [];
    const scope = useMemo(() => ({ isAdmin, sections }), [isAdmin, sections]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            setLoading(true);
            setError("");
            try {
                const loaded = await loadCommunicationRecipients(scope);
                if (!cancelled) setRecipients(loaded);
            } catch (loadError) {
                console.error("Unable to load communication recipients:", loadError);
                if (!cancelled) setError("Unable to load members for your permitted sections.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [scope]);

    const availableSections = useMemo(
        () => [...new Set(recipients.filter((item) => item.status === "active").map((item) => item.section).filter(Boolean))].sort(),
        [recipients]
    );
    const visibleRecipients = useMemo(
        () => eligibleCommunicationRecipients(recipients, sectionFilter),
        [recipients, sectionFilter]
    );
    const visibleIds = visibleRecipients.map((recipient) => recipient.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    const selectedRecipients = recipients.filter((recipient) => selectedIds.includes(recipient.id));

    const scopeLabel = isAdmin
        ? "All sections"
        : sections.length > 0
          ? sections.join(", ")
          : "No sections assigned";

    const applyTemplate = (value: CommunicationTemplate) => {
        setTemplate(value);
        setSubject(communicationTemplates[value].subject);
        setBody(communicationTemplates[value].message);
    };

    const changeSection = (value: string) => {
        setSectionFilter(value);
        setSelectedIds([]);
    };

    const toggleRecipient = (id: string) => {
        setSelectedIds((current) => current.includes(id)
            ? current.filter((item) => item !== id)
            : [...current, id]
        );
    };

    const toggleVisible = () => {
        setSelectedIds((current) => allVisibleSelected
            ? current.filter((id) => !visibleIds.includes(id))
            : [...new Set([...current, ...visibleIds])]
        );
    };

    const send = async () => {
        setError("");
        setMessage("");
        const validation = validateCommunication(subject, body, selectedRecipients.length);
        if (validation) {
            setError(validation);
            return;
        }

        setSending(true);
        try {
            const result = await sendLeaderCommunication(
                selectedRecipients.map((recipient) => recipient.id),
                subject.trim(),
                body.trim()
            );
            setMessage(`Communication sent to ${result.sent} parent${result.sent === 1 ? "" : "s"}${result.skipped ? `; ${result.skipped} recipient${result.skipped === 1 ? " was" : "s were"} skipped` : ""}.`);
            await recordAuditEvent({
                category: "member",
                action: "Parent communication sent",
                targetId: "leader-communication",
                targetLabel: subject.trim().slice(0, 120),
                section: sectionFilter === "all" ? scopeLabel : sectionFilter,
                description: `Sent a parent communication to ${result.sent} recipient${result.sent === 1 ? "" : "s"}; ${result.skipped} skipped. Message content is not stored in the audit log.`
            });
            setSelectedIds([]);
        } catch (sendError) {
            console.error("Unable to send leader communication:", sendError);
            setError("Unable to send the communication. Check the email service logs if this continues.");
        } finally {
            setSending(false);
        }
    };

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
                <LeaderDashboardHeader />
                <LeaderPageHeader
                    title="Parent Communications"
                    description="Send section-scoped operational messages to parents and guardians without exposing recipient email addresses."
                />

                <Alert severity="info" sx={{ mb: 3 }}>
                    Scope: <strong>{scopeLabel}</strong>. Only active members are selectable. The email worker re-checks your Firestore access for every recipient before sending.
                </Alert>
                {!isAdmin && sections.length === 0 && (
                    <Alert severity="warning" sx={{ mb: 3 }}>
                        Your leader account has no sections assigned, so there are no communication recipients available.
                    </Alert>
                )}
                {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                {loading ? (
                    <Box sx={{ minHeight: 280, display: "grid", placeItems: "center" }}>
                        <CircularProgress color="success" />
                    </Box>
                ) : (
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(360px, 0.8fr)" }, gap: 3 }}>
                        <Paper variant="outlined" sx={{ p: 3 }}>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
                                <FormControl sx={{ minWidth: 240 }}>
                                    <InputLabel>Section</InputLabel>
                                    <Select label="Section" value={sectionFilter} onChange={(event) => changeSection(event.target.value)}>
                                        <MenuItem value="all">All permitted sections</MenuItem>
                                        {availableSections.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <Button variant="outlined" color="secondary" disabled={visibleRecipients.length === 0} onClick={toggleVisible}>
                                    {allVisibleSelected ? "Clear visible" : "Select visible"}
                                </Button>
                            </Stack>

                            <Typography variant="h5" color="secondary" sx={{ fontWeight: 800, mb: 1 }}>
                                Recipients
                            </Typography>
                            <Typography color="text.secondary" sx={{ mb: 2 }}>
                                {selectedRecipients.length} selected · {visibleRecipients.length} active member{visibleRecipients.length === 1 ? "" : "s"} visible
                            </Typography>

                            {visibleRecipients.length === 0 ? (
                                <Alert severity="info">No active members are available in the selected section.</Alert>
                            ) : (
                                <Box sx={{ display: "grid", gap: 1 }}>
                                    {visibleRecipients.map((recipient) => (
                                        <Paper key={recipient.id} variant="outlined" sx={{ px: 2, py: 1 }}>
                                            <FormControlLabel
                                                control={<Checkbox checked={selectedIds.includes(recipient.id)} onChange={() => toggleRecipient(recipient.id)} />}
                                                label={
                                                    <Box>
                                                        <Typography sx={{ fontWeight: 700 }}>{recipient.displayName}</Typography>
                                                        <Typography variant="body2" color="text.secondary">{recipient.section}</Typography>
                                                    </Box>
                                                }
                                            />
                                        </Paper>
                                    ))}
                                </Box>
                            )}
                        </Paper>

                        <Paper variant="outlined" sx={{ p: 3, alignSelf: "start" }}>
                            <Typography variant="h5" color="secondary" sx={{ fontWeight: 800, mb: 2 }}>
                                Compose message
                            </Typography>
                            <Stack spacing={2}>
                                <FormControl fullWidth>
                                    <InputLabel>Template</InputLabel>
                                    <Select label="Template" value={template} onChange={(event) => applyTemplate(event.target.value as CommunicationTemplate)}>
                                        {(Object.entries(communicationTemplates) as Array<[CommunicationTemplate, (typeof communicationTemplates)[CommunicationTemplate]]>).map(([key, value]) => (
                                            <MenuItem key={key} value={key}>{value.label}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField
                                    label="Subject"
                                    value={subject}
                                    onChange={(event) => setSubject(event.target.value)}
                                    slotProps={{ htmlInput: { maxLength: 120 } }}
                                    helperText={`${subject.length}/120`}
                                    fullWidth
                                />
                                <TextField
                                    label="Message"
                                    value={body}
                                    onChange={(event) => setBody(event.target.value)}
                                    slotProps={{ htmlInput: { maxLength: 2500 } }}
                                    helperText={`${body.length}/2500 · Do not include medical or other sensitive information.`}
                                    multiline
                                    minRows={8}
                                    fullWidth
                                />
                                <Alert severity="warning">
                                    This sends a separate email to each selected parent/guardian. Recipient addresses are not shown to other recipients.
                                </Alert>
                                <Button variant="contained" color="success" size="large" disabled={sending || selectedRecipients.length === 0} onClick={() => void send()}>
                                    {sending ? "Sending..." : `Send to ${selectedRecipients.length} recipient${selectedRecipients.length === 1 ? "" : "s"}`}
                                </Button>
                            </Stack>
                        </Paper>
                    </Box>
                )}
            </Container>
        </Box>
    );
}
