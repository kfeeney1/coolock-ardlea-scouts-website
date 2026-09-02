import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";

import { loadOperationalHealth, type OperationalHealthItem } from "../../services/operationalHealth";

const chipColor: Record<OperationalHealthItem["status"], "success" | "warning" | "default"> = {
    healthy: "success",
    warning: "warning",
    unavailable: "default"
};

export default function OperationalHealthPanel() {
    const [items, setItems] = useState<OperationalHealthItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

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

    return <Paper elevation={2} sx={{ p: { xs: 2.5, md: 3 }, mb: 3 }}>
        <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", gap: 2, mb: 2 }}>
            <Box>
                <Typography variant="h5" color="secondary">Operational health</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    Super-admin view of non-sensitive deployment and service capability status.
                </Typography>
            </Box>
            <Button variant="outlined" onClick={() => void refresh()} disabled={loading}>Refresh status</Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {loading ? <Box sx={{ minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center" }}><CircularProgress size={28} /></Box> :
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
                {items.map((item) => <Paper key={item.id} variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                        <Typography sx={{ fontWeight: 700 }}>{item.label}</Typography>
                        <Chip size="small" color={chipColor[item.status]} label={item.status === "healthy" ? "Healthy" : item.status === "warning" ? "Check" : "Unavailable"} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word" }}>{item.detail}</Typography>
                </Paper>)}
            </Box>}
    </Paper>;
}
