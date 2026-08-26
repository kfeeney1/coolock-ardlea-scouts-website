import { Alert, Box, Chip, CircularProgress, Container, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { db } from "../firebase";
import { firestoreFailureMessage } from "../services/firestoreErrors";
import { loadMemberLifecycleHistory, type MemberLifecycleHistoryRecord } from "../services/memberAdmin";
import { lifecycleChangeLabel } from "../services/memberLifecycleLogic";

type MemberOption = { id: string; displayName: string; section: string; status: string };

function formatDate(value: Date | null): string {
  return value
    ? new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(value)
    : "Date unavailable";
}

export default function MemberHistory() {
  const { adminProfile } = useAdminAuth();
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<MemberLifecycleHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const docs = isAdmin
          ? (await getDocs(collection(db, "members"))).docs
          : (await Promise.all(
              (adminProfile?.sections || []).map((section) =>
                getDocs(query(collection(db, "members"), where("section", "==", section)))
              )
            )).flatMap((snapshot) => snapshot.docs);

        const unique = new Map<string, MemberOption>();
        for (const item of docs) {
          const data = item.data();
          unique.set(item.id, {
            id: item.id,
            displayName: typeof data.displayName === "string" ? data.displayName : "Unnamed member",
            section: typeof data.section === "string" ? data.section : "",
            status: typeof data.status === "string" ? data.status : "active"
          });
        }
        const loaded = [...unique.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
        if (!cancelled) {
          setMembers(loaded);
          setSelectedId((current) => current || loaded[0]?.id || "");
        }
      } catch (loadError) {
        console.error("Unable to load members for lifecycle history:", loadError);
        if (!cancelled) {
          setError(firestoreFailureMessage(loadError, "Unable to load member lifecycle history."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [adminProfile?.sections, isAdmin]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedId) {
      setHistory([]);
      return;
    }
    void (async () => {
      setHistoryLoading(true);
      setError("");
      try {
        const loaded = await loadMemberLifecycleHistory(selectedId);
        if (!cancelled) setHistory(loaded);
      } catch (loadError) {
        console.error("Unable to load lifecycle entries:", loadError);
        if (!cancelled) {
          setError(firestoreFailureMessage(loadError, "Unable to load lifecycle entries for this member."));
        }
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredMembers = useMemo(
    () => members.filter((member) =>
      !normalizedSearch
      || member.displayName.toLocaleLowerCase().includes(normalizedSearch)
      || member.section.toLocaleLowerCase().includes(normalizedSearch)
      || member.status.toLocaleLowerCase().includes(normalizedSearch)
    ),
    [members, normalizedSearch]
  );
  const selected = useMemo(() => members.find((member) => member.id === selectedId), [members, selectedId]);

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
      <Container maxWidth="xl">
        <LeaderDashboardHeader />
        <LeaderPageHeader
          title="Member History"
          description="Search members and review recorded section transfers and membership status changes. History is append-only and follows the member record."
        />

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          {loading ? (
            <Box sx={{ minHeight: 100, display: "grid", placeItems: "center" }}><CircularProgress size={28} /></Box>
          ) : members.length === 0 ? (
            <Alert severity="info">No member records are available in your assigned sections.</Alert>
          ) : (
            <Stack spacing={2}>
              <TextField
                label="Search members"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, section or status"
                slotProps={{ htmlInput: { "data-testid": "member-history-search" } }}
              />
              {filteredMembers.length === 0 ? (
                <Alert severity="info">No members match your search.</Alert>
              ) : (
                <FormControl fullWidth>
                  <InputLabel>Member</InputLabel>
                  <Select label="Member" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                    {filteredMembers.map((member) => (
                      <MenuItem key={member.id} value={member.id}>{member.displayName} · {member.section} · {member.status}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <Typography variant="body2" color="text.secondary" data-testid="member-history-match-count">
                {filteredMembers.length} of {members.length} members shown
              </Typography>
            </Stack>
          )}
        </Paper>

        {selected && (
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center", mb: 2 }}>
              <Typography variant="h4" color="secondary" sx={{ fontWeight: 800 }}>{selected.displayName}</Typography>
              <Chip label={selected.section || "No section"} variant="outlined" />
              <Chip label={selected.status} />
            </Stack>

            {historyLoading ? (
              <Box sx={{ minHeight: 120, display: "grid", placeItems: "center" }}><CircularProgress size={28} /></Box>
            ) : history.length === 0 ? (
              <Alert severity="info">No section transfers or membership status changes have been recorded for this member yet.</Alert>
            ) : (
              <Stack spacing={1.5}>
                {history.map((entry) => (
                  <Paper key={entry.id} variant="outlined" sx={{ p: 2 }}>
                    <Typography sx={{ fontWeight: 800 }}>{lifecycleChangeLabel(entry.changeType)}</Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                      {entry.fromSection || "No section"} / {entry.fromStatus} → {entry.toSection || "No section"} / {entry.toStatus}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{formatDate(entry.changedAt)}</Typography>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        )}
      </Container>
    </Box>
  );
}
