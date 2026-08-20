import {
    Alert,
    Box,
    Chip,
    CircularProgress,
    Paper,
    Stack,
    Typography
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";

import ParentConsentEditor from "./ParentConsentEditor";
import {
    loadLinkedMembers,
    loadParentConsents
} from "../../services/parentConsent";
import type {
    ParentConsentRecord,
    ParentLinkedMember
} from "../../services/parentConsent";

type Props = {
    memberIds: string[];
};

function formatDate(date: Date | null): string {
    if (!date) return "Not updated yet";

    return new Intl.DateTimeFormat("en-IE", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}

export default function ParentConsentSection({ memberIds }: Props) {
    const [records, setRecords] = useState<ParentConsentRecord[]>([]);
    const [members, setMembers] = useState<ParentLinkedMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [loadedRecords, loadedMembers] = await Promise.all([
                loadParentConsents(memberIds),
                loadLinkedMembers(memberIds)
            ]);
            setRecords(loadedRecords);
            setMembers(loadedMembers);
        } catch (loadError) {
            console.error("Unable to load linked parent consent records:", loadError);
            setError("Unable to load the linked consent and medical forms.");
        } finally {
            setLoading(false);
        }
    }, [memberIds]);

    useEffect(() => {
        void load();
    }, [load]);

    const recordsByMember = useMemo(() => {
        const grouped = new Map<string, ParentConsentRecord[]>();
        for (const record of records) {
            grouped.set(record.memberId, [
                ...(grouped.get(record.memberId) || []),
                record
            ]);
        }
        return grouped;
    }, [records]);

    if (loading) {
        return <Box sx={{ minHeight: 160, display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
    }

    if (error) return <Alert severity="error">{error}</Alert>;

    return (
        <Stack spacing={3}>
            <Typography color="text.secondary">
                You can update consent, contact, emergency and medical information for your linked children. Identity and leader-only fields remain locked.
            </Typography>

            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
                    gap: 2
                }}
            >
                {members.map((member) => {
                    const memberRecords = recordsByMember.get(member.id) || [];
                    const latestParentUpdate = memberRecords
                        .map((record) => record.parentUpdatedAt)
                        .filter((date): date is Date => Boolean(date))
                        .sort((a, b) => b.getTime() - a.getTime())[0] || null;

                    return (
                        <Paper key={member.id} variant="outlined" sx={{ p: 2.5 }}>
                            <Stack
                                direction="row"
                                spacing={1}
                                useFlexGap
                                sx={{ alignItems: "center", flexWrap: "wrap" }}
                            >
                                <Typography variant="h6" color="secondary" sx={{ fontWeight: 800 }}>
                                    {member.displayName}
                                </Typography>
                                {member.section && <Chip size="small" variant="outlined" label={member.section} />}
                                <Chip
                                    size="small"
                                    color={memberRecords.length > 0 ? "success" : "warning"}
                                    label={memberRecords.length > 0 ? "Consent linked" : "Consent not linked"}
                                />
                            </Stack>

                            {memberRecords.length > 0 ? (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                    {latestParentUpdate
                                        ? `Last updated by parent ${formatDate(latestParentUpdate)}`
                                        : "Linked consent found. No parent update has been recorded yet."}
                                </Typography>
                            ) : (
                                <Typography variant="body2" color="warning.main" sx={{ mt: 1, fontWeight: 700 }}>
                                    A leader needs to link this child’s existing youth consent record before it can be edited here.
                                </Typography>
                            )}
                        </Paper>
                    );
                })}
            </Box>

            {members.length === 0 && (
                <Alert severity="warning">
                    Your account is approved but no linked member records could be loaded. Please ask a leader to review Parent Access.
                </Alert>
            )}

            {records.length === 0 && members.length > 0 && (
                <Alert severity="info">
                    No linked youth consent form was found yet. A leader may need to re-save your Parent Access approval so the existing form can be matched to the member record.
                </Alert>
            )}

            {records.map((record) => (
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
    );
}
