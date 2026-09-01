import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import {
    Alert, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent,
    DialogTitle, Divider, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import {
    addContactHistoryEntry, convertJoinApplicationToMember, loadJoinApplications,
    updateJoinNotes, updateJoinStatus
} from "../services/joinAdmin";
import type { ContactMethod, JoinApplicationRecord, JoinStatus } from "../services/joinAdmin";
import { moveToUiTargetAfterRender } from "../services/uiTargeting";

type SortOrder = "oldest" | "newest" | "name";
const statuses: JoinStatus[] = ["new", "contacted", "waiting-list", "accepted", "closed"];
const sections = ["all", "Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];
const contactMethods: Array<{ value: ContactMethod; label: string }> = [
    { value: "phone", label: "Phone" }, { value: "email", label: "Email" }, { value: "text", label: "Text" },
    { value: "in-person", label: "In Person" }, { value: "other", label: "Other" }
];
const statusLabel = (status: JoinStatus) => status === "waiting-list" ? "Waiting List" : status.charAt(0).toUpperCase() + status.slice(1);
const statusColor = (status: JoinStatus): "default" | "primary" | "info" | "success" | "warning" =>
    status === "new" ? "info" : status === "contacted" ? "primary" : status === "waiting-list" ? "warning" : status === "accepted" ? "success" : "default";
const formatDate = (date: Date | null) => date ? new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Unknown";

export default function JoinManagement() {
    const [records, setRecords] = useState<JoinApplicationRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [search, setSearch] = useState("");
    const [sectionFilter, setSectionFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState<JoinStatus | "all">("all");
    const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
    const [selected, setSelected] = useState<JoinApplicationRecord | null>(null);
    const [notesDraft, setNotesDraft] = useState("");
    const [contactMethod, setContactMethod] = useState<ContactMethod>("phone");
    const [contactNote, setContactNote] = useState("");
    const [saving, setSaving] = useState(false);

    const load = async () => {
        setLoading(true); setError("");
        try {
            const applications = await loadJoinApplications();
            setRecords(applications);
            if (selected) {
                const refreshed = applications.find((item) => item.id === selected.id);
                if (refreshed) { setSelected(refreshed); setNotesDraft(refreshed.notes); }
            }
        } catch (loadError) { console.error("Unable to load Join Us enquiries:", loadError); setError("Unable to load Join Us enquiries."); }
        finally { setLoading(false); }
    };
    useEffect(() => { void load(); }, []);

    const visibleRecords = useMemo(() => {
        const query = search.trim().toLowerCase();
        return records.filter((record) => {
            if (sectionFilter !== "all" && record.section !== sectionFilter) return false;
            if (statusFilter !== "all" && record.status !== statusFilter) return false;
            return !query || [record.childName, record.parentName, record.emailAddress, record.mobileNumber, record.section,
                record.status, record.notes, JSON.stringify(record.contactHistory)].join(" ").toLowerCase().includes(query);
        }).sort((left, right) => {
            if (sortOrder === "name") return left.childName.localeCompare(right.childName);
            const leftTime = left.submittedAt?.getTime() ?? 0;
            const rightTime = right.submittedAt?.getTime() ?? 0;
            return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
        });
    }, [records, sectionFilter, statusFilter, search, sortOrder]);

    const totals = useMemo(() => statuses.reduce((current, status) => ({ ...current,
        [status]: records.filter((record) => record.status === status).length }), {} as Record<JoinStatus, number>), [records]);
    const summaryFilters: Array<[string, number, JoinStatus | "all"]> = [
        ["Total", records.length, "all"],
        ...statuses.map((status) => [statusLabel(status), totals[status] ?? 0, status] as [string, number, JoinStatus])
    ];

    const selectStatus = (status: JoinStatus | "all") => {
        setStatusFilter(status);
        moveToUiTargetAfterRender("join-results", { focus: true });
    };

    const openRecord = (record: JoinApplicationRecord) => {
        setSelected(record); setNotesDraft(record.notes); setContactNote(""); setContactMethod("phone"); setError(""); setMessage("");
    };

    const changeStatus = async (status: JoinStatus) => {
        if (!selected) return;
        setSaving(true); setError(""); setMessage("");
        try {
            await updateJoinStatus(selected.id, status);
            const updated = { ...selected, status };
            setSelected(updated); setRecords((current) => current.map((item) => item.id === selected.id ? updated : item));
            setMessage("Status updated.");
        } catch (statusError) { console.error("Unable to update Join Us status:", statusError); setError("Unable to update the enquiry status."); }
        finally { setSaving(false); }
    };

    const saveNotes = async () => {
        if (!selected) return;
        setSaving(true); setError(""); setMessage("");
        try {
            await updateJoinNotes(selected.id, notesDraft);
            const updated = { ...selected, notes: notesDraft };
            setSelected(updated); setRecords((current) => current.map((item) => item.id === selected.id ? updated : item));
            setMessage("Leader notes saved.");
        } catch (notesError) { console.error("Unable to save leader notes:", notesError); setError("Unable to save leader notes."); }
        finally { setSaving(false); }
    };

    const addContact = async () => {
        if (!selected || !contactNote.trim()) { setError("Enter a note describing the contact."); return; }
        setSaving(true); setError(""); setMessage("");
        try { await addContactHistoryEntry(selected, contactMethod, contactNote); setContactNote(""); await load(); setMessage("Contact history updated."); }
        catch (contactError) { console.error("Unable to add contact history:", contactError); setError("Unable to add the contact-history entry."); }
        finally { setSaving(false); }
    };

    const convertToMember = async () => {
        if (!selected || !window.confirm(`Create a member record for ${selected.childName}?`)) return;
        setSaving(true); setError(""); setMessage("");
        try {
            const memberId = await convertJoinApplicationToMember(selected);
            const updated = { ...selected, memberId };
            setSelected(updated); setRecords((current) => current.map((item) => item.id === selected.id ? updated : item));
            setMessage("Member record created successfully.");
        } catch (conversionError) { console.error("Unable to convert enquiry to member:", conversionError); setError("Unable to create the member record. Ensure the enquiry is Accepted and has not already been converted."); }
        finally { setSaving(false); }
    };

    return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
        <Container maxWidth="xl">
            <LeaderDashboardHeader />
            <LeaderPageHeader title="Join Us Management" description="Process joining enquiries, track contacts and manage the waiting list."
                actions={<Button variant="contained" color="success" onClick={() => void load()}>Refresh</Button>} />

            <Box role="group" aria-label="Join enquiry status summary" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(6, 1fr)" }, gap: 2, mb: 3 }}>
                {summaryFilters.map(([label, value, status]) => { const active = statusFilter === status; return <Paper key={status} variant="outlined" role="button" tabIndex={0}
                    aria-pressed={active} aria-controls="join-results"
                    onClick={() => selectStatus(status)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectStatus(status); } }}
                    sx={{ p: 2.5, textAlign: "center", cursor: "pointer", borderWidth: active ? 2 : 1,
                        borderColor: active ? "secondary.main" : "divider", transition: "transform .15s ease, box-shadow .15s ease",
                        "&:hover": { transform: "translateY(-2px)", boxShadow: 3 },
                        "&:focus-visible": { outline: "3px solid", outlineColor: "secondary.main", outlineOffset: 2 } }}>
                    <Typography variant="h4" color="secondary">{value}</Typography><Typography variant="body2" color="text.secondary">{label}</Typography>
                </Paper>; })}
            </Box>

            <Paper elevation={2} sx={{ p: 3, mb: 3 }}><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr 1fr" }, gap: 2 }}>
                <TextField label="Search enquiries" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Child, parent, email, phone..." />
                <FormControl><InputLabel id="join-section-filter-label">Section</InputLabel><Select labelId="join-section-filter-label" label="Section" value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>{sections.map((section) => <MenuItem key={section} value={section}>{section === "all" ? "All Sections" : section}</MenuItem>)}</Select></FormControl>
                <FormControl><InputLabel id="join-status-filter-label">Status</InputLabel><Select labelId="join-status-filter-label" label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as JoinStatus | "all")}><MenuItem value="all">All Statuses</MenuItem>{statuses.map((status) => <MenuItem key={status} value={status}>{statusLabel(status)}</MenuItem>)}</Select></FormControl>
                <FormControl><InputLabel id="join-sort-filter-label">Sort</InputLabel><Select labelId="join-sort-filter-label" label="Sort" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)}><MenuItem value="newest">Newest First</MenuItem><MenuItem value="oldest">Oldest First</MenuItem><MenuItem value="name">Name A-Z</MenuItem></Select></FormControl>
            </Box></Paper>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
            <Box id="join-results" role="region" aria-label="Join enquiry results" tabIndex={-1}>
                {loading ? <Box sx={{ minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress color="success" /></Box> :
                    <Box sx={{ display: "grid", gap: 2 }}>{visibleRecords.length === 0 && <Alert severity="info">No enquiries match the current filters.</Alert>}
                        {visibleRecords.map((record) => <Paper key={record.id} variant="outlined" sx={{ p: 2.5 }} data-testid={`join-record-${record.id}`}><Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, justifyContent: "space-between", gap: 2 }}>
                            <Box><Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}><Typography variant="h5" color="secondary">{record.childName}</Typography><Chip label={statusLabel(record.status)} color={statusColor(record.status)} size="small" />{record.section && <Chip label={record.section} variant="outlined" size="small" />}{record.memberId && <Chip label="Member Created" color="success" variant="outlined" size="small" />}</Stack>
                                <Typography sx={{ mt: 1 }}>Parent / Guardian: {record.parentName || "Not provided"}</Typography><Typography sx={{ mt: .5 }}>Phone: {record.mobileNumber || "Not provided"}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>Submitted {formatDate(record.submittedAt)}</Typography></Box>
                            <Button variant="contained" color="success" onClick={() => openRecord(record)}>Manage</Button>
                        </Box></Paper>)}</Box>}
            </Box>

            <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>{selected && <><DialogTitle>Manage Enquiry — {selected.childName}</DialogTitle><DialogContent dividers>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
                <Typography variant="h6" color="secondary">Applicant</Typography><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mt: 2 }}>
                    {[ ["CHILD", selected.childName], ["SECTION", selected.section || "Not provided"], ["PARENT / GUARDIAN", selected.parentName || "Not provided"], ["CONTACT", `${selected.mobileNumber || "No phone"}\n${selected.emailAddress || "No email"}`] ].map(([label, value]) => <Paper key={label} variant="outlined" sx={{ p: 2 }}><Typography variant="caption" color="text.secondary">{label}</Typography><Typography sx={{ fontWeight: 700, whiteSpace: "pre-line" }}>{value}</Typography></Paper>)}
                </Box><Divider sx={{ my: 3 }} />
                <Typography variant="h6" color="secondary" sx={{ mb: 2 }}>Workflow Status</Typography><FormControl fullWidth><InputLabel>Status</InputLabel><Select label="Status" value={selected.status} disabled={saving} onChange={(e) => void changeStatus(e.target.value as JoinStatus)}>{statuses.map((status) => <MenuItem key={status} value={status}>{statusLabel(status)}</MenuItem>)}</Select></FormControl>
                <Divider sx={{ my: 3 }} /><Typography variant="h6" color="secondary">Leader Notes</Typography><TextField fullWidth multiline minRows={4} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="Internal notes about this joining enquiry..." sx={{ mt: 2 }} /><Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.5 }}><Button variant="outlined" color="secondary" disabled={saving} onClick={() => void saveNotes()}>Save Notes</Button></Box>
                <Divider sx={{ my: 3 }} /><Typography variant="h6" color="secondary">Contact History</Typography><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "180px 1fr" }, gap: 2, mt: 2 }}><FormControl><InputLabel>Method</InputLabel><Select label="Method" value={contactMethod} onChange={(e) => setContactMethod(e.target.value as ContactMethod)}>{contactMethods.map((method) => <MenuItem key={method.value} value={method.value}>{method.label}</MenuItem>)}</Select></FormControl><TextField label="Contact note" value={contactNote} onChange={(e) => setContactNote(e.target.value)} /></Box><Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.5 }}><Button variant="contained" color="success" disabled={saving} onClick={() => void addContact()}>Add Contact</Button></Box>
                <Box sx={{ display: "grid", gap: 1.5, mt: 2 }}>{selected.contactHistory.length === 0 ? <Typography color="text.secondary">No contact history recorded.</Typography> : [...selected.contactHistory].reverse().map((entry) => <Paper key={entry.id} variant="outlined" sx={{ p: 2 }}><Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}><Chip label={contactMethods.find((item) => item.value === entry.method)?.label ?? entry.method} size="small" variant="outlined" /><Typography variant="body2" color="text.secondary">{entry.date ? new Date(entry.date).toLocaleString("en-IE") : "Unknown date"}</Typography></Stack><Typography sx={{ mt: 1 }}>{entry.note}</Typography></Paper>)}</Box>
                <Divider sx={{ my: 3 }} /><Typography variant="h6" color="secondary" sx={{ mb: 2 }}>Member Creation</Typography>{selected.memberId ? <Alert severity="success">This enquiry has already been converted to a member record.</Alert> : selected.status === "accepted" ? <Alert severity="info" action={<Button color="inherit" size="small" disabled={saving} onClick={() => void convertToMember()}>Create Member</Button>}>This enquiry is accepted and is ready to become a member record.</Alert> : <Alert severity="warning">Set the enquiry status to Accepted before creating a member record.</Alert>}
            </DialogContent><DialogActions><Button onClick={() => setSelected(null)}>Close</Button></DialogActions></>}</Dialog>
        </Container>
    </Box>;
}
