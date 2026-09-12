import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import {
    Alert, Box, Button, Checkbox, Chip, CircularProgress, Container, Dialog,
    DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel,
    Paper, Stack, TextField, Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

import { recordAuditEvent } from "../services/auditLog";
import { loadMembers } from "../services/memberAdmin";
import type { MemberRecord } from "../services/memberAdmin";
import { matchParentChildRequest } from "../services/parentChildMatching";
import { linkConsentRecordsToMembers } from "../services/parentConsent";
import { loadParentAccounts, updateParentAccess } from "../services/parentPortal";
import type { ParentAccount, ParentAccessStatus } from "../services/parentPortal";

type ParentDecision = { parent: ParentAccount; status: "approved" | "rejected" };

export default function ParentAccessManagement() {
    const [parents, setParents] = useState<ParentAccount[]>([]);
    const [members, setMembers] = useState<MemberRecord[]>([]);
    const [selected, setSelected] = useState<Record<string, string[]>>({});
    const [activeParentUid, setActiveParentUid] = useState("");
    const [memberSearch, setMemberSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [workingUid, setWorkingUid] = useState("");
    const [decisionTarget, setDecisionTarget] = useState<ParentDecision | null>(null);
    const [revokeTarget, setRevokeTarget] = useState<ParentAccount | null>(null);
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
            setError("Confirm at least one member before approving parent access.");
            return;
        }
        const linkedSections = [...new Set(members.filter((member) => memberIds.includes(member.id)).map((member) => member.section).filter(Boolean))];
        setWorkingUid(parent.uid);
        setError("");
        setMessage("");
        try {
            const linked = status === "approved" ? await linkConsentRecordsToMembers(memberIds) : 0;
            await updateParentAccess(parent.uid, status, status === "approved" ? memberIds : [], status === "approved" ? linkedSections : []);
            const action = status === "approved" ? "Parent access approved" : status === "revoked" ? "Parent access revoked" : "Parent access rejected";
            const description = status === "approved"
                ? `Approved parent access and linked ${memberIds.length} authoritative member record${memberIds.length === 1 ? "" : "s"}. Requested-child matching was used only as review assistance.`
                : status === "revoked" ? "Revoked parent access and cleared all linked member and section access." : "Rejected parent access.";
            await recordAuditEvent({ category: "parent-access", action, targetId: parent.uid, targetLabel: parent.displayName || parent.email, section: status === "approved" ? linkedSections.join(", ") : "", description });
            setMessage(`${parent.displayName || parent.email} access updated.${status === "approved" ? ` ${linked} existing consent record${linked === 1 ? " was" : "s were"} linked.` : ""}`);
            await load();
        } catch (saveError) {
            console.error("Unable to update parent access:", saveError);
            setError("Unable to update parent access or link the consent records.");
        } finally { setWorkingUid(""); }
    };

    const requestDecision = (parent: ParentAccount, status: "approved" | "rejected") => {
        if (status === "approved" && (selected[parent.uid] || []).length === 0) {
            setError("Confirm at least one member before approving parent access.");
            return;
        }
        setError("");
        setMessage("");
        setDecisionTarget({ parent, status });
    };

    const confirmDecision = () => {
        if (!decisionTarget) return;
        const { parent, status } = decisionTarget;
        setDecisionTarget(null);
        void save(parent, status);
    };
    const confirmRevoke = () => {
        if (!revokeTarget) return;
        const parent = revokeTarget;
        setRevokeTarget(null);
        void save(parent, "revoked");
    };
    const decisionMemberIds = decisionTarget ? selected[decisionTarget.parent.uid] || [] : [];
    const decisionSections = [...new Set(members.filter((member) => decisionMemberIds.includes(member.id)).map((member) => member.section).filter(Boolean))];

    return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
        <Container maxWidth="xl">
            <LeaderDashboardHeader />
            <LeaderPageHeader title="Parent Access" description="Review requested children against existing member records, then explicitly confirm the correct links. Matching never grants access." actions={<Button variant="outlined" color="secondary" onClick={() => void load()}>Refresh</Button>} />
            {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
            <Alert severity="warning" sx={{ mb: 3 }}>Only approve after verifying the parent or guardian. A likely match is review assistance only; it is not selected until a leader explicitly confirms it.</Alert>
            {loading ? <Box sx={{ minHeight: 300, display: "grid", placeItems: "center" }}><CircularProgress /></Box> : <Box sx={{ display: "grid", gap: 2 }}>
                {parents.length === 0 && <Alert severity="info">No parent accounts have registered yet.</Alert>}
                {parents.map((parent) => {
                    const isActive = activeParentUid === parent.uid;
                    const linkedIds = selected[parent.uid] || [];
                    const query = isActive ? memberSearch.trim().toLowerCase() : "";
                    const manualMatches = query ? members.filter((member) => `${member.displayName} ${member.section}`.toLowerCase().includes(query)).slice(0, 30) : [];
                    const childMatches = parent.requestedChildren.map((request) => matchParentChildRequest(request, members));
                    return <Paper key={parent.uid} data-testid={`parent-access-${parent.uid}`} variant="outlined" sx={{ p: 2.5 }}>
                        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, justifyContent: "space-between", gap: 2 }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}><Typography variant="h5" color="secondary">{parent.displayName || "Unnamed parent"}</Typography><Chip label={parent.status} size="small" color={parent.status === "approved" ? "success" : parent.status === "pending" ? "warning" : "error"} /></Stack>
                                <Typography sx={{ mt: 0.75 }}>{parent.email}</Typography>
                                {parent.mobileNumber && <Typography color="text.secondary">{parent.mobileNumber}</Typography>}
                                <Typography color="text.secondary" sx={{ mt: 1 }}>{parent.memberIds.length} approved linked child{parent.memberIds.length === 1 ? "" : "ren"}</Typography>
                                {parent.memberIds.length > 0 && <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>{parent.memberIds.map((id) => { const member = memberById.get(id); return <Chip key={id} size="small" label={member ? `${member.displayName} · ${member.section}` : id} />; })}</Stack>}
                            </Box>
                            <Stack spacing={1} sx={{ minWidth: 190 }}>
                                <Button variant={isActive ? "contained" : "outlined"} color="secondary" aria-expanded={isActive} onClick={() => toggleParent(parent.uid)}>{isActive ? "Close Child Linking" : "Manage Linked Children"}</Button>
                                {parent.status !== "approved" && <Button variant="contained" color="success" disabled={workingUid === parent.uid} onClick={() => requestDecision(parent, "approved")}>Approve Access</Button>}
                                {parent.status === "approved" ? <Button variant="outlined" color="error" disabled={workingUid === parent.uid} onClick={() => setRevokeTarget(parent)}>Revoke Access</Button> : <Button variant="outlined" color="error" disabled={workingUid === parent.uid} onClick={() => requestDecision(parent, "rejected")}>Reject Access</Button>}
                            </Stack>
                        </Box>
                        {isActive && <Box data-testid={`parent-child-linking-${parent.uid}`} sx={{ mt: 3, pt: 2.5, borderTop: "1px solid", borderColor: "divider" }}>
                            <Typography variant="h6" sx={{ mb: 0.5 }}>Requested children</Typography>
                            {childMatches.length === 0 ? <Alert severity="info" sx={{ mb: 2 }}>This is a legacy parent request with no supplied child identity. Use manual member search.</Alert> : <Stack spacing={1.5} sx={{ mb: 3 }}>
                                {childMatches.map((match, index) => {
                                    const candidate = match.candidateMemberId ? memberById.get(match.candidateMemberId) : null;
                                    const alreadyApproved = Boolean(candidate && parent.memberIds.includes(candidate.id));
                                    const selectedForApproval = Boolean(candidate && linkedIds.includes(candidate.id));
                                    return <Paper key={`${match.request.firstName}-${match.request.lastName}-${match.request.dateOfBirth}-${index}`} variant="outlined" sx={{ p: 2 }} data-testid={`requested-child-${parent.uid}-${index}`}>
                                        <Typography fontWeight={800}>{match.request.firstName} {match.request.lastName}</Typography>
                                        <Typography color="text.secondary">DOB supplied by parent: {match.request.dateOfBirth}</Typography>
                                        {match.outcome === "matched" && candidate && <Stack spacing={1.25} sx={{ mt: 1.5 }}><Alert severity={alreadyApproved || selectedForApproval ? "success" : "info"}><strong>Likely existing member:</strong> {candidate.displayName} · {candidate.section}. {alreadyApproved ? "Already approved and linked." : selectedForApproval ? "Confirmed for this approval." : "Verify the relationship, then confirm this link."}</Alert>{!alreadyApproved && <Button variant={selectedForApproval ? "outlined" : "contained"} color={selectedForApproval ? "secondary" : "success"} onClick={() => toggleMember(parent.uid, candidate.id)}>{selectedForApproval ? "Remove Confirmed Link" : "Confirm & Link"}</Button>}</Stack>}
                                        {match.outcome === "none" && <Alert severity="warning" sx={{ mt: 1.5 }}>No exact existing member match. Manual review is required; no new member will be created.</Alert>}
                                        {match.outcome === "ambiguous" && <Alert severity="warning" sx={{ mt: 1.5 }}>Multiple existing records match these details. Do not guess; use manual review.</Alert>}
                                    </Paper>;
                                })}
                            </Stack>}
                            <Typography variant="h6" sx={{ mb: 0.5 }}>Manual member review</Typography>
                            <Typography color="text.secondary" sx={{ mb: 2 }}>Use manual search for no-match, ambiguous or corrected links. The full member list is not shown automatically.</Typography>
                            <TextField fullWidth label={`Search members for ${parent.displayName || parent.email}`} value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Start typing a name or section" />
                            {!query && <Alert severity="info" sx={{ mt: 2 }}>Enter a name or section to find a child member record manually.</Alert>}
                            {query && manualMatches.length === 0 && <Alert severity="info" sx={{ mt: 2 }}>No member records match this search.</Alert>}
                            {manualMatches.length > 0 && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 0.5, mt: 2 }}>{manualMatches.map((member) => <FormControlLabel key={member.id} control={<Checkbox checked={linkedIds.includes(member.id)} onChange={() => toggleMember(parent.uid, member.id)} />} label={`${member.displayName} (${member.section})`} />)}</Box>}
                        </Box>}
                    </Paper>;
                })}
            </Box>}
        </Container>
        <Dialog open={Boolean(decisionTarget)} onClose={() => setDecisionTarget(null)} aria-labelledby="parent-decision-dialog-title" fullWidth maxWidth="sm">
            <DialogTitle id="parent-decision-dialog-title">{decisionTarget?.status === "approved" ? "Approve parent access?" : "Reject parent access?"}</DialogTitle>
            <DialogContent>{decisionTarget?.status === "approved" ? <Stack spacing={2} sx={{ pt: 1 }}><Typography>Approve <strong>{decisionTarget.parent.displayName || decisionTarget.parent.email}</strong> for {decisionMemberIds.length} confirmed child record{decisionMemberIds.length === 1 ? "" : "s"}{decisionSections.length ? ` across ${decisionSections.join(", ")}` : ""}?</Typography><Alert severity="warning">Approval grants access to the selected authoritative member records. A requested-child match alone never grants access. Existing consent records will be linked where possible.</Alert><Typography color="text.secondary">Only continue after verifying the parent/guardian identity and every selected child.</Typography></Stack> : <Stack spacing={2} sx={{ pt: 1 }}><Typography>Reject the access request from <strong>{decisionTarget?.parent.displayName || decisionTarget?.parent.email}</strong>?</Typography><Alert severity="warning">No child or section access will be granted.</Alert></Stack>}</DialogContent>
            <DialogActions><Button onClick={() => setDecisionTarget(null)}>Back to review</Button><Button variant="contained" color={decisionTarget?.status === "approved" ? "success" : "error"} onClick={confirmDecision}>{decisionTarget?.status === "approved" ? "Approve Access" : "Reject Access"}</Button></DialogActions>
        </Dialog>
        <Dialog open={Boolean(revokeTarget)} onClose={() => setRevokeTarget(null)} aria-labelledby="parent-revoke-dialog-title"><DialogTitle id="parent-revoke-dialog-title">Revoke parent access?</DialogTitle><DialogContent><DialogContentText>Revoke access for {revokeTarget?.displayName || revokeTarget?.email}? This immediately clears all linked children and sections. The account and historical records are not deleted.</DialogContentText></DialogContent><DialogActions><Button onClick={() => setRevokeTarget(null)}>Cancel</Button><Button color="error" variant="contained" onClick={confirmRevoke}>Revoke Access</Button></DialogActions></Dialog>
    </Box>;
}
