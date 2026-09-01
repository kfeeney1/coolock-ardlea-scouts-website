import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { loadJoinApplications } from "../services/joinAdmin";
import type { JoinApplicationRecord, JoinStatus } from "../services/joinAdmin";
import { moveToUiTargetAfterRender } from "../services/uiTargeting";

type SortOrder = "oldest" | "newest" | "name";
const statuses: JoinStatus[] = ["new", "contacted", "waiting-list", "accepted", "closed"];
const sections = ["all", "Beavers", "Cubs", "Scouts", "Ventures", "Rovers"];
const statusLabel = (status: JoinStatus) => status === "waiting-list" ? "Waiting List" : status.charAt(0).toUpperCase() + status.slice(1);
const statusColor = (status: JoinStatus): "default" | "primary" | "info" | "success" | "warning" =>
  status === "new" ? "info" : status === "contacted" ? "primary" : status === "waiting-list" ? "warning" : status === "accepted" ? "success" : "default";
const formatDate = (date: Date | null) => date ? new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Unknown";

export default function JoinManagement() {
  const [records, setRecords] = useState<JoinApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<JoinStatus | "all">("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  const load = async () => {
    setLoading(true); setError("");
    try { setRecords(await loadJoinApplications()); }
    catch (loadError) { console.error("Unable to load Join Us enquiries:", loadError); setError("Unable to load Join Us enquiries."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const visibleRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => {
      if (sectionFilter !== "all" && record.section !== sectionFilter) return false;
      if (statusFilter !== "all" && record.status !== statusFilter) return false;
      return !query || [record.childName, record.parentName, record.emailAddress, record.mobileNumber, record.section, record.status, record.notes, JSON.stringify(record.contactHistory)].join(" ").toLowerCase().includes(query);
    }).sort((left, right) => {
      if (sortOrder === "name") return left.childName.localeCompare(right.childName);
      const leftTime = left.submittedAt?.getTime() ?? 0;
      const rightTime = right.submittedAt?.getTime() ?? 0;
      return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
    });
  }, [records, sectionFilter, statusFilter, search, sortOrder]);

  const totals = useMemo(() => statuses.reduce((current, status) => ({ ...current, [status]: records.filter((record) => record.status === status).length }), {} as Record<JoinStatus, number>), [records]);
  const summaryFilters: Array<[string, number, JoinStatus | "all"]> = [["Total", records.length, "all"], ...statuses.map((status) => [statusLabel(status), totals[status] ?? 0, status] as [string, number, JoinStatus])];

  const selectStatus = (status: JoinStatus | "all") => {
    setStatusFilter(status);
    moveToUiTargetAfterRender("join-results", { focus: true });
  };

  return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
    <Container maxWidth="xl">
      <LeaderDashboardHeader />
      <LeaderPageHeader title="Join Us Management" description="Process joining enquiries, track contacts and manage the waiting list." actions={<Button variant="contained" color="success" onClick={() => void load()}>Refresh</Button>} />

      <Box role="group" aria-label="Join enquiry status summary" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(6, 1fr)" }, gap: 2, mb: 3 }}>
        {summaryFilters.map(([label, value, status]) => { const active = statusFilter === status; return <Paper key={status} variant="outlined" role="button" tabIndex={0} aria-pressed={active} aria-controls="join-results" onClick={() => selectStatus(status)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectStatus(status); } }} sx={{ p: 2.5, textAlign: "center", cursor: "pointer", borderWidth: active ? 2 : 1, borderColor: active ? "secondary.main" : "divider", transition: "transform .15s ease, box-shadow .15s ease", "&:hover": { transform: "translateY(-2px)", boxShadow: 3 }, "&:focus-visible": { outline: "3px solid", outlineColor: "secondary.main", outlineOffset: 2 } }}>
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
        {loading ? <Box sx={{ minHeight: 300, display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress color="success" /></Box> : <Box sx={{ display: "grid", gap: 2 }}>
          {visibleRecords.length === 0 && <Alert severity="info">No enquiries match the current filters.</Alert>}
          {visibleRecords.map((record) => <Paper key={record.id} component={Link} to={`/leader/join/${encodeURIComponent(record.id)}`} variant="outlined" data-testid={`join-record-${record.id}`} aria-label={`Open ${record.childName}`} sx={{ p: 2.5, display: "block", color: "inherit", textDecoration: "none", cursor: "pointer", transition: "transform .15s ease, box-shadow .15s ease", "&:hover": { transform: "translateY(-2px)", boxShadow: 3 }, "&:focus-visible": { outline: "3px solid", outlineColor: "secondary.main", outlineOffset: 2 } }}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}><Typography variant="h5" color="secondary">{record.childName}</Typography><Chip label={statusLabel(record.status)} color={statusColor(record.status)} size="small" />{record.section && <Chip label={record.section} variant="outlined" size="small" />}{record.memberId && <Chip label="Member Created" color="success" variant="outlined" size="small" />}</Stack>
            <Typography sx={{ mt: 1 }}>Parent / Guardian: {record.parentName || "Not provided"}</Typography><Typography sx={{ mt: .5 }}>Phone: {record.mobileNumber || "Not provided"}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>Submitted {formatDate(record.submittedAt)}</Typography>
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}><Button component="span" variant="contained" color="success">Open enquiry</Button></Box>
          </Paper>)}
        </Box>}
      </Box>
    </Container>
  </Box>;
}
