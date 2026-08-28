import {
    Alert,
    Box,
    Button,
    Container,
    Paper,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useState } from "react";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import {
    loadSessionSettings,
    saveSessionSettings
} from "../services/siteSettings";
import type { SessionSettings } from "../services/siteSettings";

function minutesValue(value: string): number {
    return Number.parseInt(value, 10);
}

export default function SiteSettings() {
    const { refreshSessionSettings } = useAdminAuth();
    const [settings, setSettings] = useState<SessionSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const loaded = await loadSessionSettings();
                if (!cancelled) setSettings(loaded);
            } catch (loadError) {
                console.error("Unable to load site settings:", loadError);
                if (!cancelled) setError("Unable to load site settings.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    const changeMinutes = (key: keyof SessionSettings, value: string) => {
        setSettings((current) => current ? { ...current, [key]: minutesValue(value) } : current);
        setMessage("");
        setError("");
    };

    const save = async () => {
        if (!settings) return;
        setSaving(true);
        setMessage("");
        setError("");
        try {
            await saveSessionSettings(settings);
            await refreshSessionSettings();
            setMessage("Site settings saved. New inactivity limits apply immediately to this session and when other signed-in users next load the settings.");
        } catch (saveError) {
            console.error("Unable to save site settings:", saveError);
            setError(saveError instanceof Error ? saveError.message : "Unable to save site settings.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
                <LeaderDashboardHeader />
                <LeaderPageHeader
                    title="Site Settings"
                    description="Manage site-wide operational settings. This page is available only to admins and super-admins and is intended to grow as additional configurable settings are introduced."
                />

                {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, maxWidth: 760 }}>
                    <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Session inactivity</Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.75, mb: 3 }}>
                        Signed-in users are automatically logged out when they have not interacted with the site for the configured period. Parent-only accounts use one limit on every device; leader accounts can use different desktop and phone limits.
                    </Typography>

                    {loading || !settings ? (
                        <Typography color="text.secondary">Loading settings…</Typography>
                    ) : (
                        <Stack spacing={2.25}>
                            <TextField
                                label="Parent account inactivity timeout"
                                type="number"
                                value={Number.isFinite(settings.parentInactivityMinutes) ? settings.parentInactivityMinutes : ""}
                                onChange={(event) => changeMinutes("parentInactivityMinutes", event.target.value)}
                                helperText="Minutes on all devices. Default: 20."
                                slotProps={{ htmlInput: { min: 5, max: 240, step: 1 } }}
                            />
                            <TextField
                                label="Leader desktop inactivity timeout"
                                type="number"
                                value={Number.isFinite(settings.leaderDesktopInactivityMinutes) ? settings.leaderDesktopInactivityMinutes : ""}
                                onChange={(event) => changeMinutes("leaderDesktopInactivityMinutes", event.target.value)}
                                helperText="Minutes on desktop/PC sessions. Default: 20."
                                slotProps={{ htmlInput: { min: 5, max: 240, step: 1 } }}
                            />
                            <TextField
                                label="Leader phone inactivity timeout"
                                type="number"
                                value={Number.isFinite(settings.leaderPhoneInactivityMinutes) ? settings.leaderPhoneInactivityMinutes : ""}
                                onChange={(event) => changeMinutes("leaderPhoneInactivityMinutes", event.target.value)}
                                helperText="Minutes on phone sessions. Default: 90."
                                slotProps={{ htmlInput: { min: 5, max: 240, step: 1 } }}
                            />
                            <Box>
                                <Button variant="contained" color="success" disabled={saving} onClick={() => void save()}>
                                    {saving ? "Saving…" : "Save Settings"}
                                </Button>
                            </Box>
                        </Stack>
                    )}
                </Paper>
            </Container>
        </Box>
    );
}
