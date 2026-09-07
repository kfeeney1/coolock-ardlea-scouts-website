import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import { loadOperationalHealth, type OperationalDataHealth, type OperationalHealthItem } from "../../services/operationalHealth";

const managementLinks: Record<string, { label: string; href: string }> = {
    members: { label: "Members", href: "/leader/members" },
    parentAccounts: { label: "Parent access", href: "/leader/parent-access" },
    weeklyMeetings: { label: "Weekly Meetings", href: "/leader/weekly" },
    events: { label: "Events", href: "/leader/events" },
    eventConsentLinks: { label: "Event consent", href: "/leader/event-consent" },
    eventConsentResponses: { label: "Event consent", href: "/leader/event-consent" },
    consentApplications: { label: "Consent records", href: "/leader/consents" },
    equipmentCategories: { label: "Equipment", href: "/leader/equipment" },
    equipmentLocations: { label: "Equipment", href: "/leader/equipment" },
    equipmentItems: { label: "Equipment", href: "/leader/equipment" },
    equipmentLoans: { label: "Equipment", href: "/leader/equipment" },
    equipmentIncidents: { label: "Equipment", href: "/leader/equipment" },
    equipmentHistory: { label: "Equipment", href: "/leader/equipment" },
    equipmentProgrammeRequirements: { label: "Equipment", href: "/leader/equipment" },
    financeTransactions: { label: "Section finances", href: "/leader/finance" },
    financeReconciliations: { label: "Section finances", href: "/leader/finance" }
};

const chipColor: Record<OperationalHealthItem["status"], "success" | "warning" | "default"> = {
    healthy: "success",
    warning: "warning",
    unavailable: "default"
};

export default function OperationalHealthPanel() {
    const [items, setItems] = useState<OperationalHealthItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [dataHealth, setDataHealth] = useState<OperationalDataHealth | null>(null);
    const [checkingData, setCheckingData] = useState(false);

    const refresh = async () => {
        setLoading(true);
        setError("");
        try {
            setItems(await loadOperationalHealth());
        } catch (refreshError) {
            console.error("Unable to load operational health:", refreshError);
            setError("Unable to load operational status right now.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void refresh(); }, []);

    const checkData = async () => {
        setCheckingData(true);
        setError("");
        try {
            const { loadOperationalDataHealth } = await import("../../services/operationalDataHealth");
            const result = await loadOperationalDataHealth();
            setDataHealth(result);
            setItems((current) => current.map((item) => item.id === "data-integrity" ? result.item : item));
        } catch (checkError) {
            console.error("Unable to check operational data integrity:", checkError);
            setError("Unable to complete the read-only data check right now.");
        } finally {
            setCheckingData(false);
        }
    };

    const affectedLinks = [...new Map((dataHealth?.affectedCollections ?? []).flatMap((name) => {
        const link = managementLinks[name];
        return link ? [[link.href, link] as const] : [];
    })).values()];

    return <Paper elevation={2} sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }}>
        <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", gap: 2, mb: 2 }}>
            <Box>
                <Typography variant="h5" color="secondary">Operational health</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    Super-admin view of non-sensitive deployment and service capability status.
                </Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button variant="outlined" onClick={() => void refresh()} disabled={loading || checkingData}>Refresh status</Button>
                <Button variant="contained" color="success" onClick={() => void checkData()} disabled={loading || checkingData}>
                    {checkingData ? "Checking data…" : "Run data check"}
                </Button>
            </Stack>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading ? <Box sx={{ minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress size={28} /></Box> :
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
                {items.map((item) => <Paper key={item.id} variant="outlined" sx={{ p: 2 }} data-testid={`operational-health-${item.id}`}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                        <Typography sx={{ fontWeight: 700 }}>{item.label}</Typography>
                        <Chip size="small" color={chipColor[item.status]} label={item.status === "healthy" ? "Healthy" : item.status === "warning" ? "Check" : "Unavailable"} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word" }}>{item.detail}</Typography>
                    {item.id === "data-integrity" && affectedLinks.length > 0 && <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.5, flexWrap: "wrap" }}>
                        {affectedLinks.map((link) => <Button key={link.href} size="small" href={link.href}>{link.label}</Button>)}
                    </Stack>}
                </Paper>)}
            </Box>}
    </Paper>;
}
