import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import AdminOverviewPanel from "../components/admin/AdminOverviewPanel";
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
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography
} from "@mui/material";

import {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    useAdminAuth
} from "../components/admin/AdminAuthProvider";

import {
    loadAdminRecords,
    updateRecordStatus
} from "../services/adminRecords";

import type {
    AdminRecord
} from "../services/adminRecords";

type RecordFilter =
    | "all"
    | "join"
    | "consent";

const HIDDEN_KEYS = new Set([
    "authorisedScouters"
]);

function formatDate(date: Date | null): string {
    if (!date) return "Unknown date";
    return new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function prettyKey(key: string): string {
    return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function displayValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "object") {
        if ("seconds" in value || "nanoseconds" in value) return "";
        return JSON.stringify(value, null, 2);
    }
    return String(value);
}

export default function AdminDashboard() {
    const { adminProfile, logout } = useAdminAuth();
    const [records, setRecords] = useState<AdminRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<RecordFilter>("all");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<AdminRecord | null>(null);
    const [updating, setUpdating] = useState(false);

    const refresh = async () => {
        setLoading(true);
        setError("");
        try {
            setRecords(await loadAdminRecords());
        } catch (refreshError) {
            console.error("Unable to load leader records:", refreshError);
            setError("Unable to load submissions. Check that this leader account is authorised in Firestore.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void refresh(); }, []);

    const visibleRecords = useMemo(() => records.filter((record) => {
        if (filter !== "all" && record.kind !== filter) return false;
        const query = search.trim().toLowerCase();
        if (!query) return true;
        return [record.title, record.subtitle, record.status, JSON.stringify(record.data)].join(" ").toLowerCase().includes(query);
    }), [records, filter, search]);

    const changeStatus = async (record: AdminRecord, status: string) => {
        setUpdating(true);
        setError("");
        try {
            await updateRecordStatus(record, status);
            setRecords((current) => current.map((item) => item.id === record.id && item.kind === record.kind ? { ...item, status } : item));
            if (selected?.id === record.id && selected.kind === record.kind) setSelected({ ...selected, status });
        } catch (statusError) {
            console.error("Unable to update status:", statusError);
            setError("Unable to update the record status.");
        } finally {
            setUpdating(false);
        }
    };

    return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
        <Container maxWidth="xl">
            <LeaderDashboardHeader />
            <AdminOverviewPanel />
            <Paper elevation={2} sx={{ p: { xs: 2.5, md: 4 }, mb: 3 }}>
                <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, justifyContent: "space-between", alignItems: { xs: "stretch", md: "center" }, gap: 2 }}>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>Signed in as {adminProfile?.displayName}</Typography>
                    <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap", justifyContent: { xs: "stretch", md: "flex-end" }, width: { xs: "100%", md: "auto" }, "& > .MuiButton-root": { minHeight: 42, flex: { xs: "1 1 100%", sm: "1 1 180px", lg: "0 1 auto" }, whiteSpace: "nowrap" } }}>
                        <Button variant="outlined" color="secondary" onClick={() => void refresh()}>Refresh</Button>
                        <Button variant="contained" color="secondary" onClick={() => void logout()}>Sign Out</Button>
                    </Stack>
                </Box>
            </Paper>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            <Paper elevation={2} sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" }, gap: 2 }}>
                    <TextField label="Search submissions" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, section, email, status..." />
                    <FormControl>
                        <InputLabel>Submission type</InputLabel>
                        <Select label="Submission type" value={filter} onChange={(event) => setFilter(event.target.value as RecordFilter)}>
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="join">Join Applications</MenuItem>
                            <MenuItem value="consent">Consent Forms</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </Paper>

            {loading ? <Box sx={{ minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress color="success" /></Box> :
                <Box sx={{ display: "grid", gap: 2 }}>
                    {visibleRecords.length === 0 && <Alert severity="info">No submissions match the current filters.</Alert>}
                    {visibleRecords.map((record) => <Paper key={`${record.kind}-${record.id}`} variant="outlined" sx={{ p: 2.5 }}>
                        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between", gap: 2 }}>
                            <Box>
                                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                                    <Typography variant="h6" color="secondary">{record.title}</Typography>
                                    <Chip size="small" label={record.kind === "join" ? "Join" : "Consent"} color={record.kind === "join" ? "primary" : "secondary"} />
                                    <Chip size="small" variant="outlined" label={record.status} />
                                </Stack>
                                <Typography color="text.secondary" sx={{ mt: 0.75 }}>{record.subtitle}</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{formatDate(record.submittedAt)}</Typography>
                            </Box>
                            <Button variant="contained" color="success" onClick={() => setSelected(record)}>View</Button>
                        </Box>
                    </Paper>)}
                </Box>}

            <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
                {selected && <>
                    <DialogTitle>{selected.title}</DialogTitle>
                    <DialogContent dividers>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }}>
                            <FormControl size="small" sx={{ minWidth: 180 }}>
                                <InputLabel>Status</InputLabel>
                                <Select label="Status" value={selected.status} disabled={updating} onChange={(event) => void changeStatus(selected, event.target.value)}>
                                    {(selected.kind === "join" ? ["new", "contacted", "waiting-list", "accepted", "closed"] : ["active", "reviewed", "expired", "archived"]).map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Stack>
                        <Divider sx={{ mb: 2 }} />
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                            {Object.entries(selected.data).filter(([key]) => !HIDDEN_KEYS.has(key) && key !== "submittedAt").map(([key, value]) => {
                                const text = displayValue(value);
                                if (!text) return null;
                                const isObject = typeof value === "object" && value !== null;
                                return <Paper key={key} variant="outlined" sx={{ p: 2, gridColumn: isObject ? { sm: "1 / -1" } : undefined }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{prettyKey(key)}</Typography>
                                    <Typography sx={{ mt: 0.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{text}</Typography>
                                </Paper>;
                            })}
                        </Box>
                    </DialogContent>
                    <DialogActions><Button onClick={() => setSelected(null)}>Close</Button></DialogActions>
                </>}
            </Dialog>
        </Container>
    </Box>;
}
