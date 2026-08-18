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
            console.error("Unable to load leader requests:", err);
            setError("Unable to load leader registration requests.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void refresh(); }, []);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return requests;
        return requests.filter((request) =>
            [request.fullName, request.email, request.mobileNumber, request.requestedRole, request.requestedSection, request.status]
                .join(" ").toLowerCase().includes(q)
        );
    }, [requests, search]);

    const approve = async () => {
        if (!selected || !user) return;
        setSaving(true);
        setError("");
        try {
            await approveLeaderRegistration(selected, user.uid, reviewNote);
            setSelected(null);
            setReviewNote("");
            await refresh();
        } catch (err) {
            console.error("Unable to approve leader:", err);
            setError("Unable to approve this leader request.");
        } finally {
            setSaving(false);
        }
    };

    const reject = async () => {
        if (!selected || !user) return;
        setSaving(true);
        setError("");
        try {
            await rejectLeaderRegistration(selected.uid, user.uid, reviewNote);
            setSelected(null);
            setReviewNote("");
            await refresh();
        } catch (err) {
            console.error("Unable to reject leader:", err);
            setError("Unable to reject this leader request.");
        } finally {
            setSaving(false);
        }
    };

    if (adminProfile?.role !== "admin") {
        return (
            <Container maxWidth="md" sx={{ py: 6 }}>
                <Alert severity="error">Administrator access is required to review leader registrations.</Alert>
            </Container>
        );
    }

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="lg">
                <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 }, mb: 3 }}>
                    <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2, justifyContent: "space-between", alignItems: { sm: "center" } }}>
                        <Box>
                            <Typography variant="h3" color="secondary">Leader Registration Requests</Typography>
                            <Typography color="text.secondary" sx={{ mt: 0.5 }}>Approve or reject pending leader access requests.</Typography>
                        </Box>
                        <Button component={Link} to="/leader" variant="outlined" color="secondary">Back to Dashboard</Button>
                    </Box>
                </Paper>

                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                <Paper elevation={2} sx={{ p: 2.5, mb: 3 }}>
                    <TextField fullWidth label="Search requests" value={search} onChange={(e) => setSearch(e.target.value)} />
                </Paper>

                {loading ? (
                    <Box sx={{ minHeight: 280, display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress color="success" /></Box>
                ) : (
                    <Box sx={{ display: "grid", gap: 2 }}>
                        {visible.length === 0 && <Alert severity="info">No registration requests found.</Alert>}
                        {visible.map((request) => (
                            <Paper key={request.uid} variant="outlined" sx={{ p: 2.5 }}>
                                <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, justifyContent: "space-between", gap: 2, alignItems: { md: "center" } }}>
                                    <Box>
                                        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center", rowGap: 1 }}>
                                            <Typography variant="h6" color="secondary">{request.fullName}</Typography>
                                            <Chip size="small" label={request.status} color={request.status === "pending" ? "warning" : request.status === "approved" ? "success" : "default"} />
                                        </Stack>
                                        <Typography sx={{ mt: 0.75 }}>{request.requestedRole} · {request.requestedSection}</Typography>
                                        <Typography variant="body2" color="text.secondary">{request.email} · {request.mobileNumber}</Typography>
                                        <Typography variant="body2" color="text.secondary">Submitted {formatDate(request.submittedAt)}</Typography>
                                    </Box>
                                    <Button variant="contained" color="success" onClick={() => { setSelected(request); setReviewNote(request.reviewNote); }}>Review</Button>
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                )}

                <Dialog open={Boolean(selected)} onClose={() => !saving && setSelected(null)} maxWidth="sm" fullWidth>
                    {selected && (
                        <>
                            <DialogTitle>{selected.fullName}</DialogTitle>
                            <DialogContent dividers>
                                <Typography><strong>Email:</strong> {selected.email}</Typography>
                                <Typography><strong>Mobile:</strong> {selected.mobileNumber}</Typography>
                                <Typography><strong>Requested role:</strong> {selected.requestedRole}</Typography>
                                <Typography><strong>Section:</strong> {selected.requestedSection}</Typography>
                                <Typography sx={{ mt: 2 }}><strong>Reason:</strong></Typography>
                                <Typography color="text.secondary">{selected.reason || "No additional information supplied."}</Typography>
                                <TextField fullWidth multiline minRows={3} label="Admin review note" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} sx={{ mt: 3 }} />
                            </DialogContent>
                            <DialogActions sx={{ p: 2 }}>
                                <Button onClick={() => setSelected(null)} disabled={saving}>Close</Button>
                                {selected.status === "pending" && (
                                    <>
                                        <Button color="error" onClick={() => void reject()} disabled={saving}>Reject</Button>
                                        <Button variant="contained" color="success" onClick={() => void approve()} disabled={saving}>{saving ? "Saving..." : "Approve"}</Button>
                                    </>
                                )}
                            </DialogActions>
                        </>
                    )}
                </Dialog>
            </Container>
        </Box>
    );
}
