import { Alert, Box, CircularProgress, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useState } from "react";

import ParentConsentEditor from "./ParentConsentEditor";
import {
    loadParentConsents
} from "../../services/parentConsent";
import type { ParentConsentRecord } from "../../services/parentConsent";

type Props = {
    memberIds: string[];
};

export default function ParentConsentSection({ memberIds }: Props) {
    const [records, setRecords] = useState<ParentConsentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setRecords(await loadParentConsents(memberIds));
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

    if (loading) {
        return <Box sx={{ minHeight: 160, display: "grid", placeItems: "center" }}><CircularProgress /></Box>;
    }

    if (error) return <Alert severity="error">{error}</Alert>;

    if (records.length === 0) {
        return (
            <Alert severity="info">
                No linked youth consent form was found yet. A leader may need to re-save your Parent Access approval so the existing form can be matched to the member record.
            </Alert>
        );
    }

    return (
        <Stack spacing={3}>
            <Typography color="text.secondary">
                You can update consent, contact, emergency and medical information for your linked children. Identity and leader-only fields remain locked.
            </Typography>
            {records.map((record) => (
                <ParentConsentEditor key={record.id} consent={record} onSaved={load} />
            ))}
        </Stack>
    );
}
