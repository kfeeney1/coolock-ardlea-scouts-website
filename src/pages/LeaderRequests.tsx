import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Container,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Paper,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import {
    approveLeaderRegistration,
    loadLeaderRegistrationRequests,
    rejectLeaderRegistration
} from "../services/leaderRegistrations";
import type { LeaderRegistrationRequest } from "../services/leaderRegistrations";

function formatDate(value: Date | null) {
    if (!value) return "Unknown date";
    return new Intl.DateTimeFormat("en-IE", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(value);
}

export default function LeaderRequests() {
    const { user, adminProfile } = useAdminAuth();
    const [requests, setRequests] = useState<LeaderRegistrationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<LeaderRegistrationRequest | null>(null);
    const [reviewNote, setReviewNote] = useState("");
    const [saving, setSaving] = useState(false);

    const refresh = async () => {
        setLoading(true);
        setError("");
        try {
            setRequests(await loadLeaderRegistrationRequests());
        } catch (err) {
            console.error(err);
            setError("Unable to load leader registration requests.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void refresh();
    }, []);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return !q
            ? requests
            : requests.filter((request) =>
                  [
                      request.fullName,
                      request.email,
                      request.mobileNumber,
                      request.requestedRole,
                      request.requestedSection,
                      request.status
                  ]
                      .join(" ")
                      .toLowerCase()
                      .includes(q)
              );
    }, [requests, search]);

    const pendingCount = requests.filter((request) => request.status === "pending").length;

    const finish = async (approved: boolean) => {
        if (!selected || !user) return;
        setSaving(true);
        setError("");
        setMessage("");
        try {
            if (approved) {
                await approveLeaderRegistration(selected, user.uid, reviewNote);
                setMessage(`${selected.fullName} has been approved as a Leader for ${selected.requestedSection || "their assigned section"}.`);
            } else {
                await rejectLeaderRegistration(selected.uid, user.uid, reviewNote);
                setMessage(`${selected.fullName}'s leader access request has been rejected.`);
            }
            setSelected(null);
            setReviewNote("");
            await refresh();
        } catch (err) {
            console.error(err);
            setError("Unable to review this leader request.");
        } finally {
            setSaving(false);
        }
    };

    if (!adminProfile || !["admin", "super-admin"].includes(adminProfile.role)) {
        return (
            <Container maxWidth="md" sx={{ py: 6 }}>
                <Alert severity="error">Administrator access is required to review leader registrations.</Alert>
            </Container>
        );
    }

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
                <LeaderDashboardHeader />
                <LeaderPageHeader
                    title="Leader Requests"
                    description="Review pending leader access requests. Approval creates an active section-scoped Leader account; use Leader Access afterwards for additional sections or role changes."
                    actions={
                        <>
                            <Button variant="outlined" color="secondary" onClick={() => void refresh()}>Refresh</Button>
                            <Button component={Link} to="/leader/access" variant="outlined" color="secondary">Leader Access</Button>
                        </>
                    }
                />

                {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, mb: 2 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
                        <TextField
                            fullWidth
                            label="Search requests"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                        <Chip
                            label={`${pendingCount} pending`}
                            color={pendingCount > 0 ? "warning" : "default"}
                            sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
                        />
                    </Stack>
                </Paper>

                {loading ? (
                    <Box sx={{ minHeight: 260, display: "grid", placeItems: "center" }}>
                        <CircularProgress color="success" />
                    </Box>
                ) : (
                    <Stack spacing={2}>
                        {visible.length === 0 && <Alert severity="info">No leader registration requests match this view.</Alert>}
                        {visible.map((request) => (
                            <Paper key={request.uid} variant="outlined" sx={{ p: 2.5 }}>
                                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
                                    <Box>
                                        <Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>{request.fullName}</Typography>
                                        <Typography>{request.email}</Typography>
                                        <Typography color="text.secondary">
                                            {request.requestedRole} · {request.requestedSection}
                                        </Typography>
                                        {request.mobileNumber && <Typography color="text.secondary">{request.mobileNumber}</Typography>}
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                            Submitted {formatDate(request.submittedAt)}
                                        </Typography>
                                        {request.reason && <Typography sx={{ mt: 1.25 }}>{request.reason}</Typography>}
                                        {request.reviewNote && request.status !== "pending" && (
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                                Review note: {request.reviewNote}
                                            </Typography>
                                        )}
                                    </Box>
                                    <Stack spacing={1} sx={{ alignItems: "flex-end" }}>
                                        <Chip
                                            label={request.status}
                                            color={request.status === "approved" ? "success" : request.status === "rejected" ? "error" : "warning"}
                                        />
                                        {request.status === "pending" && (
                                            <Button variant="contained" color="success" onClick={() => setSelected(request)}>
                                                Review Request
                                            </Button>
                                        )}
                                    </Stack>
                                </Box>
                            </Paper>
                        ))}
                    </Stack>
                )}

                <Dialog open={Boolean(selected)} onClose={() => !saving && setSelected(null)} fullWidth maxWidth="sm">
                    <DialogTitle>Review leader request</DialogTitle>
                    <DialogContent>
                        {selected && (
                            <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
                                Approving {selected.fullName} creates an active Leader account for {selected.requestedSection}. Additional sections can then be assigned from Leader Access.
                            </Alert>
                        )}
                        <TextField
                            fullWidth
                            multiline
                            minRows={3}
                            label="Review note"
                            value={reviewNote}
                            onChange={(event) => setReviewNote(event.target.value)}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button color="error" onClick={() => void finish(false)} disabled={saving}>Reject</Button>
                        <Button variant="contained" color="success" onClick={() => void finish(true)} disabled={saving}>
                            {saving ? "Saving…" : "Approve as Leader"}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </Box>
    );
}
