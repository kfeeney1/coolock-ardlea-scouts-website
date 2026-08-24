import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Container,
    FormControlLabel,
    Paper,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import { loadMembers } from "../services/memberAdmin";
import type { MemberRecord } from "../services/memberAdmin";
import { loadParentAccounts, updateParentAccess } from "../services/parentPortal";
import type { ParentAccount, ParentAccessStatus } from "../services/parentPortal";
import { linkConsentRecordsToMembers } from "../services/parentConsent";
import { recordAuditEvent } from "../services/auditLog";

export default function ParentAccessManagement() {
    const [parents, setParents] = useState<ParentAccount[]>([]);
    const [members, setMembers] = useState<MemberRecord[]>([]);
    const [selected, setSelected] = useState<Record<string, string[]>>({});
    const [activeParentUid, setActiveParentUid] = useState("");
    const [memberSearch, setMemberSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [workingUid, setWorkingUid] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            const [loadedParents, loadedMembers] = await Promise.all([loadParentAccounts(), loadMembers()]);
            setParents(loadedParents);
            setMembers(loadedMembers.filter((member) => member.status !== "left"));
            setSelected(Object.fromEntries(loadedParents.map((parent) => [parent.uid, parent.memberIds])));
        } catch (loadError) {
            console.error("Unable to load parent access requests:", loadError);
            setError("Unable to load parent access requests.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

    const toggleParent = (uid: string) => {
        setActiveParentUid((current) => current === uid ? "" : uid);
        setMemberSearch("");
        setError("");
    };

    const toggleMember = (uid: string, memberId: string) => {
        setSelected((current) => {
            const ids = current[uid] || [];
            return { ...current, [uid]: ids.includes(memberId) ? ids.filter((id) => id !== memberId) : [...ids, memberId] };
        });
    };

    const save = async (parent: ParentAccount, status: ParentAccessStatus) => {
        const memberIds = selected[parent.uid] || [];
        if (status === "approved" && memberIds.length === 0) {
            setError("Select at least one member before approving parent access.");
            return;
        }
        const linkedSections = [...new Set(members.filter((member) => memberIds.includes(member.id)).map((member) => member.section).filter(Boolean))];
        setWorkingUid(parent.uid);
        setError("");
        setMessage("");
        try {
            const linked = status === "approved" ? await linkConsentRecordsToMembers(memberIds) : 0;
            await updateParentAccess(parent.uid, status, status === "approved" ? memberIds : [], status === "approved" ? linkedSections : []);
            await recordAuditEvent({
                category: "parent-access",
                action: status === "approved" ? "Parent access approved" : "Parent access rejected",
                targetId: parent.uid,
                targetLabel: parent.displayName || parent.email,
                section: status === "approved" ? linkedSections.join(", ") : "",
                description: status === "approved" ? `Approved parent access and linked ${memberIds.length} member record${memberIds.length === 1 ? "" : "s"}.` : "Rejected parent access."
            });
            setMessage(`${parent.displayName || parent.email} access updated.${status === "approved" ? ` ${linked} existing consent record${linked === 1 ? " was" : "s were"} linked to the selected member${memberIds.length === 1 ? "" : "s"}.` : ""}`);
            await load();
        } catch (saveError) {
            console.error("Unable to update parent access:", saveError);
            setError("Unable to update parent access or link the consent records.");
        } finally {
            setWorkingUid("");
        }
    };

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
                <LeaderDashboardHeader />
                <LeaderPageHeader
                    title="Parent Access"
                    description="Review a parent account, then search for and link only the correct child member records."
                    actions={<Button variant="outlined" color="secondary" onClick={() => void load()}>Refresh</Button>}
                />
                {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
                <Alert severity="warning" sx={{ mb: 3 }}>Only approve a parent or guardian after verifying their identity. Approval also links any existing youth consent form that exactly matches the selected member's name and date of birth.</Alert>

                {loading ? (
                    <Box sx={{ minHeight: 300, display: "grid", placeItems: "center" }}><CircularProgress /></Box>
                ) : (
                    <Box sx={{ display: "grid", gap: 2 }}>
                        {parents.length === 0 && <Alert severity="info">No parent accounts have registered yet.</Alert>}
                        {parents.map((parent) => {
                            const isActive = activeParentUid === parent.uid;
                            const linkedIds = selected[parent.uid] || [];
                            const query = isActive ? memberSearch.trim().toLowerCase() : "";
                            const matches = query ? members.filter((member) => `${member.displayName} ${member.section}`.toLowerCase().includes(query)).slice(0, 30) : [];
                            return (
                                <Paper key={parent.uid} variant="outlined" sx={{ p: 2.5 }}>
                                    <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, justifyContent: "space-between", gap: 2 }}>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                                                <Typography variant="h5" color="secondary">{parent.displayName || "Unnamed parent"}</Typography>
                                                <Chip label={parent.status} size="small" color={parent.status === "approved" ? "success" : parent.status === "rejected" ? "error" : "warning"} />
                                            </Stack>
                                            <Typography sx={{ mt: 0.75 }}>{parent.email}</Typography>
                                            {parent.mobileNumber && <Typography color="text.secondary">{parent.mobileNumber}</Typography>}
                                            <Typography color="text.secondary" sx={{ mt: 1 }}>{linkedIds.length} linked child{linkedIds.length === 1 ? "" : "ren"}</Typography>
                                            {linkedIds.length > 0 && (
                                                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>
                                                    {linkedIds.map((id) => {
                                                        const member = memberById.get(id);
                                                        return <Chip key={id} size="small" label={member ? `${member.displayName} · ${member.section}` : id} />;
                                                    })}
                                                </Stack>
                                            )}
                                        </Box>
                                        <Stack spacing={1} sx={{ minWidth: 190 }}>
                                            <Button variant={isActive ? "contained" : "outlined"} color="secondary" aria-expanded={isActive} onClick={() => toggleParent(parent.uid)}>{isActive ? "Close Child Linking" : "Manage Linked Children"}</Button>
                                            <Button variant="contained" color="success" disabled={workingUid === parent.uid} onClick={() => void save(parent, "approved")}>Approve Access</Button>
                                            <Button variant="outlined" color="error" disabled={workingUid === parent.uid} onClick={() => void save(parent, "rejected")}>Reject Access</Button>
                                        </Stack>
                                    </Box>

                                    {isActive && (
                                        <Box data-testid={`parent-child-linking-${parent.uid}`} sx={{ mt: 3, pt: 2.5, borderTop: "1px solid", borderColor: "divider" }}>
                                            <Typography variant="h6" sx={{ mb: 0.5 }}>Link child members</Typography>
                                            <Typography color="text.secondary" sx={{ mb: 2 }}>Search by child name or section. The full member list is no longer shown automatically.</Typography>
                                            <TextField fullWidth label={`Search members for ${parent.displayName || parent.email}`} value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Start typing a name or section" />
                                            {!query && <Alert severity="info" sx={{ mt: 2 }}>Enter a name or section to find a child member record.</Alert>}
                                            {query && matches.length === 0 && <Alert severity="info" sx={{ mt: 2 }}>No member records match this search.</Alert>}
                                            {matches.length > 0 && (
                                                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 0.5, mt: 2 }}>
                                                    {matches.map((member) => (
                                                        <FormControlLabel key={member.id} control={<Checkbox checked={linkedIds.includes(member.id)} onChange={() => toggleMember(parent.uid, member.id)} />} label={`${member.displayName} (${member.section})`} />
                                                    ))}
                                                </Box>
                                            )}
                                        </Box>
                                    )}
                                </Paper>
                            );
                        })}
                    </Box>
                )}
            </Container>
        </Box>
    );
}
