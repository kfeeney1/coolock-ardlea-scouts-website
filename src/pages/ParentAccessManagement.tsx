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
    Typography
} from "@mui/material";
import { useEffect, useState } from "react";

import { loadMembers } from "../services/memberAdmin";
import type { MemberRecord } from "../services/memberAdmin";
import {
    loadParentAccounts,
    updateParentAccess
} from "../services/parentPortal";
import type { ParentAccount, ParentAccessStatus } from "../services/parentPortal";

export default function ParentAccessManagement() {
    const [parents, setParents] = useState<ParentAccount[]>([]);
    const [members, setMembers] = useState<MemberRecord[]>([]);
    const [selected, setSelected] = useState<Record<string, string[]>>({});
    const [loading, setLoading] = useState(true);
    const [workingUid, setWorkingUid] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            const [loadedParents, loadedMembers] = await Promise.all([
                loadParentAccounts(),
                loadMembers()
            ]);
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

    useEffect(() => {
        void load();
    }, []);

    const toggleMember = (uid: string, memberId: string) => {
        setSelected((current) => {
            const ids = current[uid] || [];
            return {
                ...current,
                [uid]: ids.includes(memberId)
                    ? ids.filter((id) => id !== memberId)
                    : [...ids, memberId]
            };
        });
    };

    const save = async (parent: ParentAccount, status: ParentAccessStatus) => {
        const memberIds = selected[parent.uid] || [];
        if (status === "approved" && memberIds.length === 0) {
            setError("Select at least one member before approving parent access.");
            return;
        }

        setWorkingUid(parent.uid);
        setError("");
        setMessage("");
        try {
            await updateParentAccess(parent.uid, status, status === "approved" ? memberIds : []);
            setMessage(`${parent.displayName || parent.email} access updated.`);
            await load();
        } catch (saveError) {
            console.error("Unable to update parent access:", saveError);
            setError("Unable to update parent access.");
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
                    description="Verify parent accounts and explicitly link each approved account to the correct member records."
                    actions={<Button variant="outlined" color="secondary" onClick={() => void load()}>Refresh</Button>}
                />

                {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                <Alert severity="warning" sx={{ mb: 3 }}>
                    Only approve a parent or guardian after verifying their identity. Linking a member will eventually allow that parent to view and update that member's consent and medical information.
                </Alert>

                {loading ? (
                    <Box sx={{ minHeight: 300, display: "grid", placeItems: "center" }}><CircularProgress /></Box>
                ) : (
                    <Box sx={{ display: "grid", gap: 2 }}>
                        {parents.length === 0 && <Alert severity="info">No parent accounts have registered yet.</Alert>}
                        {parents.map((parent) => (
                            <Paper key={parent.uid} variant="outlined" sx={{ p: 2.5 }}>
                                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                                    <Box sx={{ flex: 1 }}>
                                        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
                                            <Typography variant="h5" color="secondary">{parent.displayName || "Unnamed parent"}</Typography>
                                            <Chip
                                                label={parent.status}
                                                size="small"
                                                color={parent.status === "approved" ? "success" : parent.status === "rejected" ? "error" : "warning"}
                                            />
                                        </Stack>
                                        <Typography sx={{ mt: 0.75 }}>{parent.email}</Typography>
                                        {parent.mobileNumber && <Typography color="text.secondary">{parent.mobileNumber}</Typography>}

                                        <Typography sx={{ mt: 2, fontWeight: 700 }}>Link member records</Typography>
                                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(3,1fr)" }, gap: 0.5, mt: 0.5 }}>
                                            {members.map((member) => (
                                                <FormControlLabel
                                                    key={member.id}
                                                    control={
                                                        <Checkbox
                                                            checked={(selected[parent.uid] || []).includes(member.id)}
                                                            onChange={() => toggleMember(parent.uid, member.id)}
                                                        />
                                                    }
                                                    label={`${member.displayName} (${member.section})`}
                                                />
                                            ))}
                                        </Box>
                                    </Box>

                                    <Stack spacing={1} sx={{ minWidth: 180 }}>
                                        <Button
                                            variant="contained"
                                            color="success"
                                            disabled={workingUid === parent.uid}
                                            onClick={() => void save(parent, "approved")}
                                        >
                                            Approve Access
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            color="error"
                                            disabled={workingUid === parent.uid}
                                            onClick={() => void save(parent, "rejected")}
                                        >
                                            Reject Access
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Paper>
                        ))}
                    </Box>
                )}
            </Container>
        </Box>
    );
}
