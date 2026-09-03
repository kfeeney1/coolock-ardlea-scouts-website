import { Alert, Box, Button, Chip, Collapse, Paper, Stack, TextField, Typography } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  OperationalEmptyState,
  OperationalErrorState,
  OperationalLoading,
  OperationalPermissionState,
  OperationalUnavailableState
} from "../admin/OperationalStates";
import ParentConsentEditor from "./ParentConsentEditor";
import { classifyFirestoreFailure, firestoreFailureMessage } from "../../services/firestoreErrors";
import { loadLinkedMembers, loadParentConsents } from "../../services/parentConsent";
import type { ParentConsentRecord, ParentLinkedMember } from "../../services/parentConsent";

type Props = { memberIds: string[]; };

function formatDate(date: Date | null): string {
  if (!date) return "Not updated yet";
  return new Intl.DateTimeFormat("en-IE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function ParentConsentSection({ memberIds }: Props) {
  const [records, setRecords] = useState<ParentConsentRecord[]>([]);
  const [members, setMembers] = useState<ParentLinkedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [search, setSearch] = useState("");
  const [openMemberId, setOpenMemberId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [loadedRecords, loadedMembers] = await Promise.all([
        loadParentConsents(memberIds),
        loadLinkedMembers(memberIds)
      ]);
      setRecords(loadedRecords);
      setMembers(loadedMembers);
    } catch (error) {
      console.error("Unable to load linked parent consent records:", error);
      setLoadError(error);
    } finally {
      setLoading(false);
    }
  }, [memberIds]);

  useEffect(() => { void load(); }, [load]);

  const recordsByMember = useMemo(() => {
    const grouped = new Map<string, ParentConsentRecord[]>();
    for (const record of records) grouped.set(record.memberId, [...(grouped.get(record.memberId) || []), record]);
    return grouped;
  }, [records]);

  const visibleMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? members.filter((member) => [member.displayName, member.section].join(" ").toLowerCase().includes(query))
      : members;
  }, [members, search]);

  if (loading) {
    return <OperationalLoading minHeight={160} label="Loading linked consent and medical forms" />;
  }

  if (loadError) {
    const message = firestoreFailureMessage(loadError, "Unable to load the linked consent and medical forms.");
    if (classifyFirestoreFailure(loadError) === "permission") {
      return (
        <OperationalPermissionState
          title="Consent forms access restricted"
          actionLabel="Retry"
          onAction={() => void load()}
          testId="parent-consent-permission"
        >
          {message}
        </OperationalPermissionState>
      );
    }
    return (
      <OperationalErrorState
        title="Consent forms could not be loaded"
        actionLabel="Retry"
        onAction={() => void load()}
        testId="parent-consent-error"
      >
        {message}
      </OperationalErrorState>
    );
  }

  if (members.length === 0) {
    return (
      <OperationalUnavailableState title="Consent forms not available yet" testId="parent-consent-unavailable">
        Your account is approved but no linked member records are available. Please ask a leader to review Parent Access.
      </OperationalUnavailableState>
    );
  }

  return (
    <Stack spacing={3}>
      <Typography color="text.secondary">
        Find a linked child, review the consent status, and open only the form you want to update. Identity and leader-only fields remain locked.
      </Typography>
      <TextField
        fullWidth
        label="Search children"
        placeholder="Name or section"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        slotProps={{ htmlInput: { "data-testid": "parent-consent-search" } }}
      />
      <Typography variant="body2" color="text.secondary" role="status" aria-live="polite">
        Showing {visibleMembers.length} of {members.length} linked child{members.length === 1 ? "" : "ren"}.
      </Typography>
      <Box
        sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2 }}
        data-testid="parent-consent-tiles"
      >
        {visibleMembers.map((member) => {
          const memberRecords = recordsByMember.get(member.id) || [];
          const latest = memberRecords
            .map((record) => record.parentUpdatedAt)
            .filter((date): date is Date => Boolean(date))
            .sort((a, b) => b.getTime() - a.getTime())[0] || null;
          const open = openMemberId === member.id;
          return (
            <Paper key={member.id} variant="outlined" sx={{ p: 2.5 }} data-testid={`parent-consent-tile-${member.id}`}>
              <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>{member.displayName}</Typography>
                {member.section && <Chip size="small" variant="outlined" label={member.section} />}
                <Chip
                  size="small"
                  color={memberRecords.length > 0 ? "success" : "warning"}
                  label={memberRecords.length > 0 ? "Consent linked" : "Consent not linked"}
                />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {memberRecords.length > 0
                  ? (latest
                      ? `Last updated by parent ${formatDate(latest)}`
                      : "Linked consent found. No parent update has been recorded yet.")
                  : "A leader needs to link this child’s existing youth consent record before it can be edited here."}
              </Typography>
              {memberRecords.length > 0 && (
                <Button
                  variant="outlined"
                  color="secondary"
                  sx={{ mt: 2 }}
                  aria-expanded={open}
                  onClick={() => setOpenMemberId(open ? "" : member.id)}
                >
                  {open ? "Close Consent" : "Review Consent"}
                </Button>
              )}
              <Collapse in={open} unmountOnExit>
                <Stack spacing={2} sx={{ mt: 2 }}>
                  {memberRecords.map((record) => (
                    <Box key={record.id}>
                      <Alert severity={record.updatedByParent ? "success" : "info"} sx={{ mb: 1.5 }}>
                        {record.updatedByParent
                          ? `This form was last updated by a parent on ${formatDate(record.parentUpdatedAt || record.updatedAt)}.`
                          : "This linked form has not yet been updated through the Parent Portal."}
                      </Alert>
                      <ParentConsentEditor consent={record} onSaved={load} />
                    </Box>
                  ))}
                </Stack>
              </Collapse>
            </Paper>
          );
        })}
      </Box>
      {visibleMembers.length === 0 && (
        <OperationalEmptyState title="No matching linked children">
          No linked children match that search.
        </OperationalEmptyState>
      )}
      {records.length === 0 && (
        <OperationalUnavailableState title="Consent forms not linked yet">
          No linked youth consent form was found yet. A leader may need to re-save your Parent Access approval so the existing form can be matched to the member record.
        </OperationalUnavailableState>
      )}
    </Stack>
  );
}
