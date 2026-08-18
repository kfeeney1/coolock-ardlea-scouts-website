import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import {
    Alert, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions,
    DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Paper, Select,
    Stack, TextField, Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { loadMemberConsentSummaries, loadMembers, updateMember } from "../services/memberAdmin";
import type { MemberConsentSummary, MemberRecord, MemberStatus } from "../services/memberAdmin";

const sections = ["all", "Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group", "Other"];
const memberStatuses: MemberStatus[] = ["active", "inactive", "left"];
const statusLabel = (status: MemberStatus) => status === "active" ? "Active" : status === "inactive" ? "Inactive" : "Left";
const statusColor = (status: MemberStatus): "success" | "warning" | "default" => status === "active" ? "success" : status === "inactive" ? "warning" : "default";
const formatDate = (value: Date | null) => value ? new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(value) : "Unknown";
const consentExpired = (value: string) => Boolean(value && value < new Date().toISOString().slice(0, 10));

export default function MemberManagement() {
    const [members, setMembers] = useState<MemberRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [search, setSearch] = useState("");
    const [sectionFilter, setSectionFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState<MemberStatus | "all">("active");
    const [selected, setSelected] = useState<MemberRecord | null>(null);
    const [draft, setDraft] = useState<MemberRecord | null>(null);
    const [saving, setSaving] = useState(false);
    const [consents, setConsents] = useState<MemberConsentSummary[]>([]);
    const [loadingConsents, setLoadingConsents] = useState(false);

    const load = async () => {
        setLoading(true); setError("");
        try { setMembers(await loadMembers()); }
        catch (loadError) { console.error("Unable to load members:", loadError); setError("Unable to load member records."); }
        finally { setLoading(false); }
    };
    useEffect(() => { void load(); }, []);

    const visibleMembers = useMemo(() => members.filter((member) => {
        if (sectionFilter !== "all" && member.section !== sectionFilter) return false;
        if (statusFilter !== "all" && member.status !== statusFilter) return false;
        const query = search.trim().toLowerCase();
        return !query || [member.displayName, member.parentName, member.emailAddress, member.mobileNumber, member.section,
            member.emergencyContactName, member.emergencyContactPhone].join(" ").toLowerCase().includes(query);
    }), [members, sectionFilter, statusFilter, search]);

    const counts = useMemo(() => ({
        total: members.length,
        active: members.filter((member) => member.status === "active").length,
        inactive: members.filter((member) => member.status === "inactive").length,
        left: members.filter((member) => member.status === "left").length
    }), [members]);

    const openMember = async (member: MemberRecord) => {
        setSelected(member); setDraft({ ...member }); setConsents([]); setError(""); setMessage(""); setLoadingConsents(true);
        try { setConsents(await loadMemberConsentSummaries(member)); }
        catch (consentError) { console.error("Unable to load linked consents:", consentError); setError("Member loaded, but linked consent records could not be checked."); }
        finally { setLoadingConsents(false); }
    };

    const save = async () => {
        if (!selected || !draft) return;
        if (!draft.displayName.trim()) { setError("Member name is required."); return; }
        setSaving(true); setError(""); setMessage("");
        try {
            await updateMember(selected.id, {
                firstName: draft.firstName, lastName: draft.lastName, displayName: draft.displayName,
                dateOfBirth: draft.dateOfBirth, section: draft.section, parentName: draft.parentName,
                emailAddress: draft.emailAddress, mobileNumber: draft.mobileNumber,
                emergencyContactName: draft.emergencyContactName, emergencyContactPhone: draft.emergencyContactPhone,
                status: draft.status
            });
            const updated = { ...draft, id: selected.id };
            setMembers((current) => current.map((member) => member.id === selected.id ? updated : member));
            setSelected(updated); setDraft(updated); setMessage("Member details updated.");
        } catch (saveError) { console.error("Unable to save member:", saveError); setError("Unable to update the member record."); }
        finally { setSaving(false); }
    };

    const summary: Array<[string, number, MemberStatus | "all"]> = [
        ["Total", counts.total, "all"], ["Active", counts.active, "active"],
        ["Inactive", counts.inactive, "inactive"], ["Left", counts.left, "left"]
    ];

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
                <LeaderDashboardHeader />
                <LeaderPageHeader title="Member Management" description="Maintain member records, sections, contacts and consent indicators."
                    actions={<Button variant="contained" color="success" onClick={() => void load()}>Refresh</Button>} />

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2, mb: 3 }}>
                    {summary.map(([label, value, status]) => {
                        const active = statusFilter === status;
                        return <Paper key={label} variant="outlined" role="button" tabIndex={0}
                            onClick={() => setStatusFilter(status)}
                            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setStatusFilter(status); } }}
                            sx={{ p: 2.5, textAlign: "center", cursor: "pointer", borderWidth: active ? 2 : 1,
                                borderColor: active ? "secondary.main" : "divider", transition: "transform .15s ease, box-shadow .15s ease",
                                "&:hover": { transform: "translateY(-2px)", boxShadow: 3 } }}>
                            <Typography variant="h4" color="secondary">{value}</Typography>
                            <Typography variant="body2" color="text.secondary">{label}</Typography>
                        </Paper>;
                    })}
                </Box>

                <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" }, gap: 2 }}>
                        <TextField label="Search members" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Member, parent, phone, email..." />
                        <FormControl><InputLabel>Section</InputLabel><Select label="Section" value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}>
                            {sections.map((section) => <MenuItem key={section} value={section}>{section === "all" ? "All Sections" : section}</MenuItem>)}
                        </Select></FormControl>
                        <FormControl><InputLabel>Status</InputLabel><Select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as MemberStatus | "all")}>
                            <MenuItem value="all">All Statuses</MenuItem>{memberStatuses.map((status) => <MenuItem key={status} value={status}>{statusLabel(status)}</MenuItem>)}
                        </Select></FormControl>
                    </Box>
                </Paper>

                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
                {loading ? <Box sx={{ minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress color="success" /></Box> :
                    <Box sx={{ display: "grid", gap: 2 }}>
                        {visibleMembers.length === 0 && <Alert severity="info">No members match the current filters.</Alert>}
                        {visibleMembers.map((member) => <Paper key={member.id} variant="outlined" sx={{ p: 2.5 }}>
                            <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, justifyContent: "space-between", gap: 2 }}>
                                <Box><Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                                    <Typography variant="h5" color="secondary">{member.displayName}</Typography>
                                    <Chip label={statusLabel(member.status)} color={statusColor(member.status)} size="small" />
                                    {member.section && <Chip label={member.section} variant="outlined" size="small" />}
                                </Stack><Typography sx={{ mt: 1 }}>Parent / Guardian: {member.parentName || "Not provided"}</Typography>
                                <Typography sx={{ mt: .5 }}>Phone: {member.mobileNumber || "Not provided"}</Typography></Box>
                                <Button variant="contained" color="success" onClick={() => void openMember(member)}>Manage</Button>
                            </Box>
                        </Paper>)}
                    </Box>}

                <Dialog open={Boolean(selected && draft)} onClose={() => { setSelected(null); setDraft(null); }} maxWidth="lg" fullWidth>
                    {selected && draft && <><DialogTitle>Member — {draft.displayName}</DialogTitle><DialogContent dividers>
                        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
                        <Typography variant="h5" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Member Details</Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
                            <TextField label="First name" value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
                            <TextField label="Last name" value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
                            <TextField required label="Display name" value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} />
                            <TextField type="date" label="Date of birth" value={draft.dateOfBirth} slotProps={{ inputLabel: { shrink: true } }} onChange={(e) => setDraft({ ...draft, dateOfBirth: e.target.value })} />
                            <FormControl><InputLabel>Section</InputLabel><Select label="Section" value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })}>{sections.filter((s) => s !== "all").map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}</Select></FormControl>
                            <FormControl><InputLabel>Status</InputLabel><Select label="Status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as MemberStatus })}>{memberStatuses.map((s) => <MenuItem key={s} value={s}>{statusLabel(s)}</MenuItem>)}</Select></FormControl>
                            <TextField label="Parent / Guardian" value={draft.parentName} onChange={(e) => setDraft({ ...draft, parentName: e.target.value })} />
                            <TextField label="Email address" value={draft.emailAddress} onChange={(e) => setDraft({ ...draft, emailAddress: e.target.value })} />
                            <TextField label="Mobile number" value={draft.mobileNumber} onChange={(e) => setDraft({ ...draft, mobileNumber: e.target.value })} />
                            <TextField label="Emergency contact" value={draft.emergencyContactName} onChange={(e) => setDraft({ ...draft, emergencyContactName: e.target.value })} />
                            <TextField label="Emergency contact phone" value={draft.emergencyContactPhone} onChange={(e) => setDraft({ ...draft, emergencyContactPhone: e.target.value })} />
                        </Box>
                        <Typography variant="h5" color="secondary" sx={{ mt: 4, mb: 2, fontWeight: 800 }}>Consent Indicators</Typography>
                        {loadingConsents ? <CircularProgress size={24} /> : consents.length === 0 ? <Alert severity="info">No matching consent records were found for this member.</Alert> :
                            <Stack spacing={1.5}>{consents.map((consent) => <Paper key={consent.consentId} variant="outlined" sx={{ p: 2 }}>
                                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
                                    <Chip size="small" label={consentExpired(consent.consentTo) ? "Expired" : "Consent found"} color={consentExpired(consent.consentTo) ? "error" : "success"} />
                                    {consent.hasMedicalAlert && <Chip size="small" label="Medical alert" color="warning" />}{consent.hasMedicationManagement && <Chip size="small" label="Medication" color="error" />}
                                </Stack><Typography variant="body2" color="text.secondary">{consent.section || "No section"} · Submitted {formatDate(consent.submittedAt)} · Consent to {consent.consentTo || "not provided"}</Typography>
                            </Paper>)}</Stack>}
                    </DialogContent><DialogActions><Button onClick={() => { setSelected(null); setDraft(null); }}>Close</Button>
                        <Button variant="contained" color="success" disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save Member"}</Button>
                    </DialogActions></>}
                </Dialog>
            </Container>
        </Box>
    );
}
