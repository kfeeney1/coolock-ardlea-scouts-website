import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import {
    OperationalEmptyState,
    OperationalErrorState,
    OperationalLoading,
    OperationalPermissionState
} from "../components/admin/OperationalStates";
import {
    Alert,
    Box,
    Button,
    Chip,
    Container,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    createMember,
    loadMemberConsentSummaries,
    loadMembers,
    updateMember
} from "../services/memberAdmin";
import type {
    CreateMemberInput,
    MemberConsentSummary,
    MemberRecord,
    MemberStatus
} from "../services/memberAdmin";
import { classifyFirestoreFailure, firestoreFailureMessage } from "../services/firestoreErrors";
import { moveToUiTargetAfterRender } from "../services/uiTargeting";

const sections = ["all", "Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group", "Other"];
const memberStatuses: MemberStatus[] = ["active", "inactive", "left"];

const emptyMember: CreateMemberInput = {
    firstName: "",
    lastName: "",
    displayName: "",
    dateOfBirth: "",
    section: "",
    parentName: "",
    emailAddress: "",
    mobileNumber: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    status: "active"
};

const statusLabel = (status: MemberStatus) =>
    status === "active" ? "Active" : status === "inactive" ? "Inactive" : "Left";

const statusColor = (status: MemberStatus): "success" | "warning" | "default" =>
    status === "active" ? "success" : status === "inactive" ? "warning" : "default";

const statusChangeConsequence = (status: MemberStatus) => {
    if (status === "active") return "The member will return to active status in the member register.";
    if (status === "inactive") return "The member will be marked inactive while their record and lifecycle history are retained.";
    return "The member will be marked as having left while their record and lifecycle history are retained.";
};

const formatDate = (value: Date | null) =>
    value
        ? new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(value)
        : "Unknown";

const consentExpired = (value: string) => Boolean(value && value < new Date().toISOString().slice(0, 10));

export default function MemberManagement() {
    const [members, setMembers] = useState<MemberRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [memberLoadError, setMemberLoadError] = useState<unknown>(null);
    const [saveError, setSaveError] = useState("");
    const [message, setMessage] = useState("");
    const [search, setSearch] = useState("");
    const [sectionFilter, setSectionFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState<MemberStatus | "all">("active");
    const [selected, setSelected] = useState<MemberRecord | null>(null);
    const [draft, setDraft] = useState<MemberRecord | null>(null);
    const [saving, setSaving] = useState(false);
    const [statusConfirmationOpen, setStatusConfirmationOpen] = useState(false);
    const [consents, setConsents] = useState<MemberConsentSummary[]>([]);
    const [loadingConsents, setLoadingConsents] = useState(false);
    const [consentLoadError, setConsentLoadError] = useState<unknown>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [addDraft, setAddDraft] = useState<CreateMemberInput>({ ...emptyMember });
    const [creating, setCreating] = useState(false);
    const [addError, setAddError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setMemberLoadError(null);
        try {
            setMembers(await loadMembers());
        } catch (loadError) {
            console.error("Unable to load members:", loadError);
            setMemberLoadError(loadError);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const visibleMembers = useMemo(() => members.filter((member) => {
        if (sectionFilter !== "all" && member.section !== sectionFilter) return false;
        if (statusFilter !== "all" && member.status !== statusFilter) return false;
        const query = search.trim().toLowerCase();
        return !query || [
            member.displayName,
            member.parentName,
            member.emailAddress,
            member.mobileNumber,
            member.section,
            member.emergencyContactName,
            member.emergencyContactPhone
        ].join(" ").toLowerCase().includes(query);
    }), [members, sectionFilter, statusFilter, search]);

    const counts = useMemo(() => ({
        total: members.length,
        active: members.filter((member) => member.status === "active").length,
        inactive: members.filter((member) => member.status === "inactive").length,
        left: members.filter((member) => member.status === "left").length
    }), [members]);

    const summary: Array<[string, number, MemberStatus | "all"]> = [
        ["Total", counts.total, "all"],
        ["Active", counts.active, "active"],
        ["Inactive", counts.inactive, "inactive"],
        ["Left", counts.left, "left"]
    ];

    const selectStatus = (status: MemberStatus | "all") => {
        setStatusFilter(status);
        moveToUiTargetAfterRender("member-results", { focus: true });
    };

    const loadMemberConsents = async (member: MemberRecord) => {
        setLoadingConsents(true);
        setConsentLoadError(null);
        try {
            setConsents(await loadMemberConsentSummaries(member));
        } catch (consentError) {
            console.error("Unable to load linked consents:", consentError);
            setConsentLoadError(consentError);
        } finally {
            setLoadingConsents(false);
        }
    };

    const closeMember = () => {
        setStatusConfirmationOpen(false);
        setSelected(null);
        setDraft(null);
    };

    const openMember = async (member: MemberRecord) => {
        setStatusConfirmationOpen(false);
        setSelected(member);
        setDraft({ ...member });
        setConsents([]);
        setSaveError("");
        setMessage("");
        await loadMemberConsents(member);
    };

    const save = async (statusConfirmed = false) => {
        if (!selected || !draft) return;
        if (!draft.displayName.trim()) return setSaveError("Member name is required.");
        if (!statusConfirmed && draft.status !== selected.status) {
            setSaveError("");
            setMessage("");
            setStatusConfirmationOpen(true);
            return;
        }
        setSaving(true);
        setSaveError("");
        setMessage("");
        try {
            await updateMember(selected.id, {
                firstName: draft.firstName,
                lastName: draft.lastName,
                displayName: draft.displayName,
                dateOfBirth: draft.dateOfBirth,
                section: draft.section,
                parentName: draft.parentName,
                emailAddress: draft.emailAddress,
                mobileNumber: draft.mobileNumber,
                emergencyContactName: draft.emergencyContactName,
                emergencyContactPhone: draft.emergencyContactPhone,
                status: draft.status
            });
            const updated = { ...draft, id: selected.id };
            setMembers((current) => current.map((member) => member.id === selected.id ? updated : member));
            setSelected(updated);
            setDraft(updated);
            setMessage("Member details updated.");
        } catch (error) {
            console.error("Unable to save member:", error);
            setSaveError("Unable to update the member record.");
        } finally {
            setSaving(false);
        }
    };

    const confirmStatusChange = () => {
        setStatusConfirmationOpen(false);
        void save(true);
    };

    const openAddMember = () => {
        setAddDraft({ ...emptyMember });
        setAddError("");
        setAddOpen(true);
    };

    const addMember = async () => {
        setAddError("");
        if (!addDraft.displayName.trim()) return setAddError("Member name is required.");
        if (!addDraft.section) return setAddError("Select the member's section.");
        setCreating(true);
        try {
            await createMember(addDraft);
            setAddOpen(false);
            setAddDraft({ ...emptyMember });
            setStatusFilter(addDraft.status);
            setSectionFilter("all");
            setSearch("");
            await load();
        } catch (createError) {
            console.error("Unable to create member:", createError);
            setAddError("Unable to create the member record.");
        } finally {
            setCreating(false);
        }
    };

    const memberForm = (value: CreateMemberInput, setValue: (value: CreateMemberInput) => void) => (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
            <TextField label="First name" value={value.firstName} onChange={(event) => setValue({ ...value, firstName: event.target.value })} />
            <TextField label="Last name" value={value.lastName} onChange={(event) => setValue({ ...value, lastName: event.target.value })} />
            <TextField required label="Display name" value={value.displayName} onChange={(event) => setValue({ ...value, displayName: event.target.value })} helperText="Use the name leaders normally identify the member by." />
            <TextField type="date" label="Date of birth" value={value.dateOfBirth} slotProps={{ inputLabel: { shrink: true } }} onChange={(event) => setValue({ ...value, dateOfBirth: event.target.value })} />
            <FormControl required>
                <InputLabel>Section</InputLabel>
                <Select label="Section" value={value.section} onChange={(event) => setValue({ ...value, section: event.target.value })}>
                    {sections.filter((section) => section !== "all").map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}
                </Select>
            </FormControl>
            <FormControl>
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={value.status} onChange={(event) => setValue({ ...value, status: event.target.value as MemberStatus })}>
                    {memberStatuses.map((status) => <MenuItem key={status} value={status}>{statusLabel(status)}</MenuItem>)}
                </Select>
            </FormControl>
            <TextField label="Parent / Guardian" value={value.parentName} onChange={(event) => setValue({ ...value, parentName: event.target.value })} />
            <TextField label="Email address" type="email" value={value.emailAddress} onChange={(event) => setValue({ ...value, emailAddress: event.target.value })} />
            <TextField label="Mobile number" value={value.mobileNumber} onChange={(event) => setValue({ ...value, mobileNumber: event.target.value })} />
            <TextField label="Emergency contact" value={value.emergencyContactName} onChange={(event) => setValue({ ...value, emergencyContactName: event.target.value })} />
            <TextField label="Emergency contact phone" value={value.emergencyContactPhone} onChange={(event) => setValue({ ...value, emergencyContactPhone: event.target.value })} />
        </Box>
    );

    const renderMemberResults = () => {
        if (loading) {
            return <OperationalLoading minHeight={300} label="Loading member records" />;
        }
        if (memberLoadError) {
            const failureMessage = firestoreFailureMessage(memberLoadError, "Unable to load member records.");
            if (classifyFirestoreFailure(memberLoadError) === "permission") {
                return (
                    <OperationalPermissionState
                        title="Member records access restricted"
                        actionLabel="Retry"
                        onAction={() => void load()}
                        testId="member-management-permission"
                    >
                        {failureMessage}
                    </OperationalPermissionState>
                );
            }
            return (
                <OperationalErrorState
                    title="Member records could not be loaded"
                    actionLabel="Retry"
                    onAction={() => void load()}
                    testId="member-management-error"
                >
                    {failureMessage}
                </OperationalErrorState>
            );
        }
        if (members.length === 0) {
            return (
                <OperationalEmptyState title="No member records">
                    No member records are available for your assigned sections.
                </OperationalEmptyState>
            );
        }
        if (visibleMembers.length === 0) {
            return (
                <OperationalEmptyState title="No matching members">
                    No members match the current search and filters.
                </OperationalEmptyState>
            );
        }
        return (
            <Box sx={{ display: "grid", gap: 2 }}>
                {visibleMembers.map((member) => (
                    <Paper key={member.id} variant="outlined" sx={{ p: 2.5 }} data-testid={`member-card-${member.id}`}>
                        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, justifyContent: "space-between", gap: 2 }}>
                            <Box>
                                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                                    <Typography variant="h5" color="secondary">{member.displayName}</Typography>
                                    <Chip label={statusLabel(member.status)} color={statusColor(member.status)} size="small" />
                                    {member.section && <Chip label={member.section} variant="outlined" size="small" />}
                                </Stack>
                                <Typography sx={{ mt: 1 }}>Parent / Guardian: {member.parentName || "Not provided"}</Typography>
                                <Typography sx={{ mt: 0.5 }}>Phone: {member.mobileNumber || "Not provided"}</Typography>
                            </Box>
                            <Button variant="contained" color="success" onClick={() => void openMember(member)}>Manage</Button>
                        </Box>
                    </Paper>
                ))}
            </Box>
        );
    };

    const renderConsentIndicators = () => {
        if (loadingConsents) {
            return <OperationalLoading minHeight={120} label="Loading consent indicators" />;
        }
        if (consentLoadError) {
            const failureMessage = firestoreFailureMessage(
                consentLoadError,
                "Member loaded, but linked consent records could not be checked."
            );
            if (classifyFirestoreFailure(consentLoadError) === "permission") {
                return (
                    <OperationalPermissionState
                        title="Consent indicators access restricted"
                        actionLabel="Retry"
                        onAction={() => selected && void loadMemberConsents(selected)}
                        testId="member-consent-permission"
                    >
                        {failureMessage}
                    </OperationalPermissionState>
                );
            }
            return (
                <OperationalErrorState
                    title="Consent indicators could not be loaded"
                    actionLabel="Retry"
                    onAction={() => selected && void loadMemberConsents(selected)}
                    testId="member-consent-error"
                >
                    {failureMessage}
                </OperationalErrorState>
            );
        }
        if (consents.length === 0) {
            return (
                <OperationalEmptyState title="No matching consent records">
                    No matching consent records were found for this member.
                </OperationalEmptyState>
            );
        }
        return (
            <Stack spacing={1.5}>
                {consents.map((consent) => (
                    <Paper key={consent.consentId} variant="outlined" sx={{ p: 2 }}>
                        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 1 }}>
                            <Chip size="small" label={consentExpired(consent.consentTo) ? "Expired" : "Consent found"} color={consentExpired(consent.consentTo) ? "error" : "success"} />
                            {consent.hasMedicalAlert && <Chip size="small" label="Medical alert" color="warning" />}
                            {consent.hasMedicationManagement && <Chip size="small" label="Medication" color="error" />}
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                            {consent.section || "No section"} · Submitted {formatDate(consent.submittedAt)} · Consent to {consent.consentTo || "not provided"}
                        </Typography>
                    </Paper>
                ))}
            </Stack>
        );
    };

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
                <LeaderDashboardHeader />
                <LeaderPageHeader
                    title="Member Management"
                    description="Maintain member records, sections, contacts and consent indicators."
                    actions={<Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                        <Button variant="contained" color="secondary" onClick={openAddMember}>Add Member</Button>
                        <Button variant="contained" color="success" onClick={() => void load()}>Refresh</Button>
                    </Stack>}
                />

                <Box role="group" aria-label="Member status summary" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2, mb: 3 }}>
                    {summary.map(([label, value, status]) => {
                        const active = statusFilter === status;
                        return (
                            <Paper
                                key={label}
                                variant="outlined"
                                role="button"
                                tabIndex={0}
                                aria-pressed={active}
                                aria-controls="member-results"
                                onClick={() => selectStatus(status)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        selectStatus(status);
                                    }
                                }}
                                sx={{
                                    p: 2.5,
                                    textAlign: "center",
                                    cursor: "pointer",
                                    borderWidth: active ? 2 : 1,
                                    borderColor: active ? "secondary.main" : "divider",
                                    transition: "transform .15s ease, box-shadow .15s ease",
                                    "&:hover": { transform: "translateY(-2px)", boxShadow: 3 },
                                    "&:focus-visible": { outline: "3px solid", outlineColor: "secondary.main", outlineOffset: 2 }
                                }}
                            >
                                <Typography variant="h4" color="secondary">{value}</Typography>
                                <Typography variant="body2" color="text.secondary">{label}</Typography>
                            </Paper>
                        );
                    })}
                </Box>

                <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" }, gap: 2 }}>
                        <TextField label="Search members" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Member, parent, phone, email..." />
                        <FormControl>
                            <InputLabel id="member-section-filter-label">Section</InputLabel>
                            <Select labelId="member-section-filter-label" label="Section" value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}>
                                {sections.map((section) => <MenuItem key={section} value={section}>{section === "all" ? "All Sections" : section}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl>
                            <InputLabel id="member-status-filter-label">Status</InputLabel>
                            <Select labelId="member-status-filter-label" label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as MemberStatus | "all")}>
                                <MenuItem value="all">All Statuses</MenuItem>
                                {memberStatuses.map((status) => <MenuItem key={status} value={status}>{statusLabel(status)}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Box>
                </Paper>

                <Box id="member-results" role="region" aria-label="Member results" tabIndex={-1}>
                    {renderMemberResults()}
                </Box>

                <Dialog open={Boolean(selected && draft)} onClose={closeMember} maxWidth="lg" fullWidth>
                    {selected && draft && <>
                        <DialogTitle>Member — {draft.displayName}</DialogTitle>
                        <DialogContent dividers>
                            {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
                            {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
                            <Typography variant="h5" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Member Details</Typography>
                            {memberForm(draft, (value) => setDraft({ ...draft, ...value }))}
                            <Typography variant="h5" color="secondary" sx={{ mt: 4, mb: 2, fontWeight: 800 }}>Consent Indicators</Typography>
                            {renderConsentIndicators()}
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={closeMember}>Close</Button>
                            <Button variant="contained" color="success" disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save Member"}</Button>
                        </DialogActions>
                    </>}
                </Dialog>

                <Dialog
                    open={Boolean(statusConfirmationOpen && selected && draft)}
                    onClose={() => !saving && setStatusConfirmationOpen(false)}
                    aria-labelledby="member-status-confirmation-title"
                    maxWidth="sm"
                    fullWidth
                >
                    {selected && draft && <>
                        <DialogTitle id="member-status-confirmation-title">Confirm member status change?</DialogTitle>
                        <DialogContent dividers>
                            <Stack spacing={2}>
                                <Typography>
                                    <strong>{draft.displayName}</strong> will change from {statusLabel(selected.status)} to {statusLabel(draft.status)}.
                                </Typography>
                                <Alert severity={draft.status === "active" ? "info" : "warning"}>
                                    {statusChangeConsequence(draft.status)}
                                </Alert>
                                <Typography color="text.secondary">
                                    Saving this status change will use the existing member lifecycle history and audit trail.
                                </Typography>
                            </Stack>
                        </DialogContent>
                        <DialogActions>
                            <Button disabled={saving} onClick={() => setStatusConfirmationOpen(false)}>Cancel status change</Button>
                            <Button variant="contained" color={draft.status === "active" ? "success" : "warning"} disabled={saving} onClick={confirmStatusChange}>
                                {saving ? "Saving..." : "Confirm Status Change"}
                            </Button>
                        </DialogActions>
                    </>}
                </Dialog>

                <Dialog open={addOpen} onClose={() => !creating && setAddOpen(false)} maxWidth="md" fullWidth>
                    <DialogTitle>Add Existing Member</DialogTitle>
                    <DialogContent dividers>
                        <Typography color="text.secondary" sx={{ mb: 3 }}>Add a current member directly to the member register. This does not create a Join Us enquiry.</Typography>
                        {addError && <Alert severity="error" sx={{ mb: 3 }}>{addError}</Alert>}
                        {memberForm(addDraft, setAddDraft)}
                    </DialogContent>
                    <DialogActions>
                        <Button disabled={creating} onClick={() => setAddOpen(false)}>Cancel</Button>
                        <Button variant="contained" color="success" disabled={creating} onClick={() => void addMember()}>{creating ? "Adding..." : "Add Member"}</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}