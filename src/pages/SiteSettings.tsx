import FeatureSettingSwitch from "../components/admin/FeatureSettingSwitch";
import MaintenanceDirectorySettings from "../components/admin/MaintenanceDirectorySettings";
import BadgeworkExperienceSettings from "../components/admin/BadgeworkExperienceSettings";
import HallHireSettings from "../components/admin/HallHireSettings";
import MeetingExperienceSettings from "../components/admin/MeetingExperienceSettings";
import LeaderTrainingExperienceSettings from "../components/admin/LeaderTrainingExperienceSettings";
import { applicationErrorMessage } from "../services/applicationErrors.ts";
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
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { settingsAccessFor } from "../security/settingsAccess";
import MeetingRecordsExperienceSettings from "../components/admin/MeetingRecordsExperienceSettings";
import CalendarExperienceSettings from "../components/admin/CalendarExperienceSettings";
import MaintenanceExperienceSettings from "../components/admin/MaintenanceExperienceSettings";
import AttendanceExperienceSettings from "../components/admin/AttendanceExperienceSettings";
import ScheduleExperienceSettings from "../components/admin/ScheduleExperienceSettings";
import LeaderNavigationSettings from "../components/admin/LeaderNavigationSettings";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import SubsSettingsPanel from "../components/admin/SubsSettingsPanel";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import {
    loadParentLoginEnabled,
    loadParentConsentEnabled,
    loadSessionSettings,
    saveParentConsentEnabled,
    saveParentLoginEnabled,
    saveSessionSettings
} from "../services/siteSettings";
import type { SessionSettings } from "../services/siteSettings";
import { trySecondaryRefresh } from "../services/secondaryRefresh";

function minutesValue(value: string): number {
    return Number.parseInt(value, 10);
}

export default function SiteSettings() {
    const { adminProfile, refreshSessionSettings } = useAdminAuth();
    const [searchParams] = useSearchParams();
    const navigationView = searchParams.get("view");
    const pageIdentity = navigationView === "quartermaster" ? "qm-settings" : navigationView === "treasurer" ? "treasurer-settings" : "settings";
    const pageTitle = navigationView === "quartermaster" ? "QM Settings" : navigationView === "treasurer" ? "Treasurer Settings" : "Settings";
    const canManageSiteSettings = settingsAccessFor(adminProfile, "session").edit;
    const showFeatures = settingsAccessFor(adminProfile, "features").edit && pageIdentity === "settings";
    const directoryAccess = settingsAccessFor(adminProfile, "maintenance-directory");
    const showSessionSettings = canManageSiteSettings && pageIdentity === "settings";
    const [settings, setSettings] = useState<SessionSettings | null>(null);
    const [loading, setLoading] = useState(showSessionSettings);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [parentLoginEnabled, setParentLoginEnabled] = useState<boolean | null>(null);
    const [parentLoginLoading, setParentLoginLoading] = useState(showFeatures);
    const [parentLoginSaving, setParentLoginSaving] = useState(false);
    const [parentLoginMessage, setParentLoginMessage] = useState("");
    const [parentLoginError, setParentLoginError] = useState("");
    const parentLoginSaveInFlight = useRef(false);
    const [parentConsentEnabled, setParentConsentEnabled] = useState<boolean | null>(null);
    const [parentConsentLoading, setParentConsentLoading] = useState(showFeatures);
    const [parentConsentSaving, setParentConsentSaving] = useState(false);
    const [parentConsentMessage, setParentConsentMessage] = useState("");
    const [parentConsentError, setParentConsentError] = useState("");
    const parentConsentSaveInFlight = useRef(false);
    const parentLoginSettingsLoading = showFeatures
        && (parentLoginLoading || (parentLoginEnabled === null && !parentLoginError));

    useEffect(() => {
        if (!showSessionSettings) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const loaded = await loadSessionSettings();
                if (!cancelled) setSettings(loaded);
            } catch (loadError) {
                if (!cancelled) setError(applicationErrorMessage(loadError, "Unable to load site settings.", "SiteSettings"));
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [showSessionSettings]);

    useEffect(() => {
        if (!showFeatures) {
            setParentLoginLoading(false);
            return;
        }
        let cancelled = false;
        setParentLoginError("");
        void loadParentLoginEnabled().then((enabled) => {
            if (!cancelled) setParentLoginEnabled(enabled);
        }).catch((loadError) => {
            if (!cancelled) {
                setParentLoginEnabled(null);
                setParentLoginError(applicationErrorMessage(loadError, "Unable to load Parent Login settings. Reload the page and try again.", "SiteSettings"));
            }
        }).finally(() => {
            if (!cancelled) setParentLoginLoading(false);
        });
        return () => { cancelled = true; };
    }, [showFeatures]);

    useEffect(() => {
        if (!showFeatures) {
            setParentConsentLoading(false);
            return;
        }
        let cancelled = false;
        setParentConsentLoading(true);
        setParentConsentError("");
        void loadParentConsentEnabled().then((enabled) => {
            if (!cancelled) setParentConsentEnabled(enabled);
        }).catch((loadError) => {
            if (!cancelled) {
                setParentConsentEnabled(null);
                setParentConsentError(applicationErrorMessage(loadError, "Unable to load Parent Portal consent settings. Reload the page and try again.", "SiteSettings"));
            }
        }).finally(() => {
            if (!cancelled) setParentConsentLoading(false);
        });
        return () => { cancelled = true; };
    }, [showFeatures]);

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
            const refreshed = await trySecondaryRefresh(refreshSessionSettings, "session settings");
            setMessage(refreshed
                ? "Site settings saved. New inactivity limits apply immediately to this session and when other signed-in users next load the settings."
                : "Site settings saved, but this screen could not refresh the active session. Reload the page before relying on the new inactivity limit in this session.");
        } catch (saveError) {
            setError(applicationErrorMessage(saveError, "Unable to save site settings.", "SiteSettings"));
        } finally {
            setSaving(false);
        }
    };

    const changeParentLogin = async (enabled: boolean) => {
        if (parentLoginSaveInFlight.current || parentLoginEnabled === null || enabled === parentLoginEnabled) return;
        parentLoginSaveInFlight.current = true;
        const previousValue = parentLoginEnabled;
        setParentLoginSaving(true);
        setParentLoginMessage("");
        setParentLoginError("");
        try {
            await saveParentLoginEnabled(enabled, previousValue);
            setParentLoginEnabled(enabled);
            setParentLoginMessage(`Parent Login ${enabled ? "enabled" : "disabled"}. Public navigation will use this setting immediately.`);
        } catch (saveError) {
            const persisted = await loadParentLoginEnabled().catch(() => null);
            setParentLoginEnabled(persisted);
            setParentLoginError(applicationErrorMessage(saveError, persisted === null
                ? "Unable to verify the saved Parent Login setting. Reload settings and try again."
                : "Unable to save Parent Login settings. Check the current setting and try again.", "SiteSettings"));
        } finally {
            parentLoginSaveInFlight.current = false;
            setParentLoginSaving(false);
        }
    };

    const changeParentConsent = async (enabled: boolean) => {
        if (parentConsentSaveInFlight.current || parentConsentEnabled === null || enabled === parentConsentEnabled) return;
        parentConsentSaveInFlight.current = true;
        const previousValue = parentConsentEnabled;
        setParentConsentSaving(true);
        setParentConsentMessage("");
        setParentConsentError("");
        try {
            await saveParentConsentEnabled(enabled, previousValue);
            setParentConsentEnabled(enabled);
            setParentConsentMessage(`Parent Portal Consent and Medical Consent ${enabled ? "enabled" : "disabled"}. The saved setting applies when Parent Portal content next loads.`);
        } catch (saveError) {
            const persisted = await loadParentConsentEnabled().catch(() => null);
            setParentConsentEnabled(persisted);
            setParentConsentError(applicationErrorMessage(saveError, persisted === null
                ? "Unable to verify the saved Parent Portal consent setting. Reload settings and try again."
                : "Unable to save Parent Portal consent settings. Check the current setting and try again.", "SiteSettings"));
        } finally {
            parentConsentSaveInFlight.current = false;
            setParentConsentSaving(false);
        }
    };

    return (
        <Box data-testid={`page-${pageIdentity}`} sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
                <LeaderDashboardHeader />
                <LeaderPageHeader title={pageTitle} />

                {message && <Alert severity="success" sx={{ mb: 3 }}>{message}</Alert>}
                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                {showSessionSettings && (
                    <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, maxWidth: 760 }}>
                        <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Session inactivity</Typography>
                        <Typography color="text.secondary" sx={{ mt: 0.75, mb: 3 }}>
                            Signed-in users are automatically logged out when they have not interacted with the site for the configured period. Parent-only accounts use one limit on every device; leader accounts can use different desktop and phone limits.
                        </Typography>

                        {loading ? (
                            <Typography color="text.secondary">Loading settings…</Typography>
                        ) : settings && (
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
                )}

                {showFeatures && (
                    <Box component="section" aria-labelledby="feature-settings-heading" sx={{ mt: 3 }}>
                        <Typography id="feature-settings-heading" component="h2" variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Feature rollout</Typography>
                        <LeaderNavigationSettings />
                        <ScheduleExperienceSettings />
                        <MeetingExperienceSettings />
                        <MeetingRecordsExperienceSettings />
                        <AttendanceExperienceSettings />
                        <AttendanceExperienceSettings reports />
                        <AttendanceExperienceSettings eventEdit />
                        <MaintenanceExperienceSettings />
                        <CalendarExperienceSettings />
                        <LeaderTrainingExperienceSettings />
                        <BadgeworkExperienceSettings />
                        <HallHireSettings />
                    </Box>
                )}

                {showFeatures && (
                    <Typography component="h2" variant="h5" color="secondary" sx={{ mt: 3, fontWeight: 800 }}>Public and parent access</Typography>
                )}

                {showFeatures && (
                    <Paper aria-busy={parentLoginSaving} variant="outlined" sx={{ p: { xs: 2, md: 3 }, maxWidth: 760, mt: 3, borderRadius: 2 }}>
                        <FeatureSettingSwitch
                            label="Enable Parent Login"
                            checked={parentLoginEnabled === true}
                            disabled={parentLoginSettingsLoading || parentLoginEnabled === null || parentLoginSaving}
                            onChange={enabled => void changeParentLogin(enabled)}
                        />
                        {parentLoginSettingsLoading && <Typography role="status">Loading Parent Login setting…</Typography>}
                        {parentLoginSaving && <Typography role="status">Saving Parent Login setting…</Typography>}
                        {parentLoginMessage && <Alert severity="success" role="status">{parentLoginMessage}</Alert>}
                        {parentLoginError && <Alert severity="error">{parentLoginError}</Alert>}
                    </Paper>
                )}

                {showFeatures && (
                    <Paper aria-busy={parentConsentSaving} variant="outlined" sx={{ p: { xs: 2, md: 3 }, maxWidth: 760, mt: 3, borderRadius: 2 }}>
                        <FeatureSettingSwitch
                            label="Enable Parent Portal Consent and Medical Consent"
                            checked={parentConsentEnabled === true}
                            disabled={parentConsentLoading || parentConsentEnabled === null || parentConsentSaving}
                            onChange={enabled => void changeParentConsent(enabled)}
                        />
                        {parentConsentLoading && <Typography role="status">Loading Parent Portal consent setting…</Typography>}
                        {parentConsentSaving && <Typography role="status">Saving Parent Portal consent setting…</Typography>}
                        {parentConsentMessage && <Alert severity="success" role="status">{parentConsentMessage}</Alert>}
                        {parentConsentError && <Alert severity="error">{parentConsentError}</Alert>}
                    </Paper>
                )}

                {pageIdentity === "settings" && directoryAccess.view && (
                    <MaintenanceDirectorySettings canRefresh={directoryAccess.edit} />
                )}

                {pageIdentity === "qm-settings" ? (
                    <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, maxWidth: 760 }} data-testid="qm-settings-empty-state">
                        <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Quartermaster settings</Typography>
                        <Alert severity="info" role="status" sx={{ mt: 2 }}>No current settings.</Alert>
                    </Paper>
                ) : <SubsSettingsPanel />}
            </Container>
        </Box>
    );
}
