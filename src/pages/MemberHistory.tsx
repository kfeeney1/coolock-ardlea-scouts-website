import { Box, Chip, Container, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Typography } from "@mui/material";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import OperationalSearchField from "../components/admin/OperationalSearchField";
import OperationalStatusChip from "../components/admin/OperationalStatusChip";
import {
  OperationalEmptyState,
  OperationalErrorState,
  OperationalLoading,
  OperationalPermissionState
} from "../components/admin/OperationalStates";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { db } from "../firebase";
import { classifyFirestoreFailure, firestoreFailureMessage } from "../services/firestoreErrors";
import { loadMemberLifecycleHistory, type MemberLifecycleHistoryRecord } from "../services/memberAdmin";
import { lifecycleChangeLabel } from "../services/memberLifecycleLogic";

type MemberOption = { id: string; displayName: string; section: string; status: string };

function formatDate(value: Date | null): string {
  return value
    ? new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(value)
    : "Date unavailable";
}

function matchesSearch(member: MemberOption, value: string): boolean {
  const normalized = value.trim().toLocaleLowerCase();
  return !normalized
    || member.displayName.toLocaleLowerCase().includes(normalized)
    || member.section.toLocaleLowerCase().includes(normalized)
    || member.status.toLocaleLowerCase().includes(normalized);
}

function memberStatusTone(status: string): "success" | "warning" | "default" {
  if (status === "active") return "success";
  if (status === "inactive") return "warning";
  return "default";
}

export default function MemberHistory() {
  const { adminProfile } = useAdminAuth();
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<MemberLifecycleHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [memberLoadError, setMemberLoadError] = useState<unknown>(null);
  const [historyLoadError, setHistoryLoadError] = useState<unknown>(null);
  const [memberRetryVersion, setMemberRetryVersion] = useState(0);
  const [historyRetryVersion, setHistoryRetryVersion] = useState(0);

  const isAdmin = adminProfile?.role === "admin" || adminProfile?.role === "super-admin";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setMemberLoadError(null);
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
          setSelectedId((current) => current && loaded.some((member) => member.id === current) ? current : loaded[0]?.id || "");
        }
      } catch (loadError) {
        console.error("Unable to load members for lifecycle history:", loadError);
        if (!cancelled) setMemberLoadError(loadError);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [adminProfile?.sections, isAdmin, memberRetryVersion]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedId) {
      setHistory([]);
      setHistoryLoadError(null);
      return;
    }
    void (async () => {
      setHistoryLoading(true);
      setHistoryLoadError(null);
      try {
        const loaded = await loadMemberLifecycleHistory(selectedId);
        if (!cancelled) setHistory(loaded);
      } catch (loadError) {
        console.error("Unable to load lifecycle entries:", loadError);
        if (!cancelled) setHistoryLoadError(loadError);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId, historyRetryVersion]);

  const filteredMembers = useMemo(
    () => members.filter((member) => matchesSearch(member, search)),
    [members, search]
  );
  const selected = useMemo(
    () => filteredMembers.find((member) => member.id === selectedId),
    [filteredMembers, selectedId]
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    const matches = members.filter((member) => matchesSearch(member, value));
    if (!matches.some((member) => member.id === selectedId)) {
      setSelectedId(matches[0]?.id || "");
    }
  };

  const memberErrorState = memberLoadError ? (
    classifyFirestoreFailure(memberLoadError) === "permission" ? (
      <OperationalPermissionState
        title="Member history access unavailable"
        actionLabel="Retry"
        onAction={() => setMemberRetryVersion((value) => value + 1)}
        testId="member-history-members-permission"
      >
        {firestoreFailureMessage(memberLoadError, "Unable to load the member list for lifecycle history.")}
      </OperationalPermissionState>
    ) : (
      <OperationalErrorState
        title="Members could not be loaded"
        actionLabel="Retry"
        onAction={() => setMemberRetryVersion((value) => value + 1)}
        testId="member-history-members-error"
      >
        {firestoreFailureMessage(memberLoadError, "Unable to load the member list for lifecycle history. Please try again.")}
      </OperationalErrorState>
    )
  ) : null;

  const historyErrorState = historyLoadError ? (
    classifyFirestoreFailure(historyLoadError) === "permission" ? (
      <OperationalPermissionState
        title="Lifecycle history access unavailable"
        actionLabel="Retry"
        onAction={() => setHistoryRetryVersion((value) => value + 1)}
        testId="member-history-detail-permission"
      >
        {firestoreFailureMessage(historyLoadError, "Unable to load lifecycle entries for this member.")}
      </OperationalPermissionState>
    ) : (
      <OperationalErrorState
        title="Lifecycle history could not be loaded"
        actionLabel="Retry"
        onAction={() => setHistoryRetryVersion((value) => value + 1)}
        testId="member-history-detail-error"
      >
        {firestoreFailureMessage(historyLoadError, "Unable to load lifecycle entries for this member. Please try again.")}
      </OperationalErrorState>
    )
  ) : null;

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
      <Container maxWidth="xl">
        <LeaderDashboardHeader />
        <LeaderPageHeader
          title="Member History"
          description="Search members and review recorded section transfers and membership status changes. History is append-only and follows the member record."
        />

        <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
          {loading ? (
            <OperationalLoading minHeight={100} label="Loading members" />
          ) : memberErrorState ? (
            memberErrorState
          ) : members.length === 0 ? (
            <OperationalEmptyState>No member records are available in your assigned sections.</OperationalEmptyState>
          ) : (
            <Stack spacing={2}>
              <OperationalSearchField
                label="Search members"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search by name, section or status"
                testId="member-history-search"
              />
              {filteredMembers.length === 0 ? (
                <OperationalEmptyState>No members match your search.</OperationalEmptyState>
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

        {selected && !memberLoadError && (
          <Paper variant="outlined" sx={{ p: 3 }} data-testid="member-history-detail">
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center", mb: 2 }}>
              <Typography variant="h4" color="secondary" sx={{ fontWeight: 800 }}>{selected.displayName}</Typography>
              <Chip label={selected.section || "No section"} variant="outlined" />
              <OperationalStatusChip label={selected.status} tone={memberStatusTone(selected.status)} />
            </Stack>

            {historyLoading ? (
              <OperationalLoading minHeight={120} label="Loading member history" />
            ) : historyErrorState ? (
              historyErrorState
            ) : history.length === 0 ? (
              <OperationalEmptyState>No section transfers or membership status changes have been recorded for this member yet.</OperationalEmptyState>
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
