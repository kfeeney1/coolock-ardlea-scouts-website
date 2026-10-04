import { applicationErrorMessage } from "../services/applicationErrors.ts";
import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import HealthAndSafetyOutlinedIcon from "@mui/icons-material/HealthAndSafetyOutlined";

import {
    Alert,
    Box,
    Button,
    Container,
    Divider,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    TextField,
    Typography
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import PasswordField from "../components/PasswordField";
import {
    changeLeaderPassword,
    loadLeaderProfile,
    updateLeaderProfile
} from "../services/leaderProfile";
import type { LeaderProfileData } from "../services/leaderProfile";
import { loadRoverSelfMembership, setRoverSelfMembership } from "../services/memberAdmin";

const sections = ["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group", "Other"];
const PHONE_RE = /^[\d\s+\-()]{7,20}$/;

export default function LeaderProfile() {
    const { adminProfile } = useAdminAuth();
    const [profile, setProfile] = useState<LeaderProfileData>({
        displayName: "",
        email: "",
        mobileNumber: "",
        section: "",
        role: ""
    });
    const [loading, setLoading] = useState(true);
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileMessage, setProfileMessage] = useState("");
    const [profileError, setProfileError] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState("");
    const [passwordError, setPasswordError] = useState("");
    const [roverActive, setRoverActive] = useState(false);
    const [roverFirstName, setRoverFirstName] = useState("");
    const [roverLastName, setRoverLastName] = useState("");
    const [roverLoading, setRoverLoading] = useState(true);
    const [roverSaving, setRoverSaving] = useState(false);
    const [roverError, setRoverError] = useState("");
    const [roverMessage, setRoverMessage] = useState("");

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setProfileError("");
            try {
                setProfile(await loadLeaderProfile());
            } catch (error) {
                setProfileError(applicationErrorMessage(error, "Unable to load your leader profile.", "LeaderProfile"));
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    useEffect(() => {
        let active = true;
        void loadRoverSelfMembership().then((membership) => {
            if (!active) return;
            setRoverActive(membership.active);
            setRoverFirstName(membership.firstName || adminProfile?.displayName?.trim().split(/\s+/)[0] || "");
            setRoverLastName(membership.lastName || adminProfile?.displayName?.trim().split(/\s+/).slice(1).join(" ") || "");
        }).catch((error) => {
            if (active) setRoverError(applicationErrorMessage(error, "Unable to check your Rover membership.", "LeaderProfile"));
        }).finally(() => { if (active) setRoverLoading(false); });
        return () => { active = false; };
    }, [adminProfile?.displayName]);

    const saveProfile = async () => {
        setProfileError("");
        setProfileMessage("");
        if (!profile.displayName.trim()) {
            setProfileError("Display name is required.");
            return;
        }
        if (profile.mobileNumber.trim() && !PHONE_RE.test(profile.mobileNumber.trim())) {
            setProfileError("Enter a valid mobile number.");
            return;
        }
        if (!profile.section) {
            setProfileError("Select your Scout section.");
            return;
        }
        setSavingProfile(true);
        try {
            await updateLeaderProfile({
                displayName: profile.displayName,
                mobileNumber: profile.mobileNumber,
                section: profile.section
            });
            setProfileMessage("Your leader details have been updated.");
        } catch (error) {
            setProfileError(applicationErrorMessage(error, "Unable to update your details. Please try again.", "LeaderProfile"));
        } finally {
            setSavingProfile(false);
        }
    };

    const changePassword = async () => {
        setPasswordError("");
        setPasswordMessage("");
        if (!currentPassword) {
            setPasswordError("Enter your current password.");
            return;
        }
        if (newPassword.length < 8) {
            setPasswordError("The new password must contain at least 8 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError("The new passwords do not match.");
            return;
        }
        if (currentPassword === newPassword) {
            setPasswordError("Choose a new password that is different from your current password.");
            return;
        }
        setChangingPassword(true);
        try {
            await changeLeaderPassword(currentPassword, newPassword);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPasswordMessage("Your password has been changed successfully.");
        } catch (error) {
            setPasswordError(applicationErrorMessage(error, "Unable to change your password. Check your current password and try again.", "LeaderProfile"));
        } finally {
            setChangingPassword(false);
        }
    };

    const saveRoverMembership = async (enabled: boolean) => {
        setRoverSaving(true); setRoverError(""); setRoverMessage("");
        try {
            await setRoverSelfMembership({ firstName: roverFirstName, lastName: roverLastName, enabled });
            const membership = await loadRoverSelfMembership();
            setRoverActive(membership.active);
            setRoverMessage(enabled ? "Your Rover membership is active and linked to your account." : "Your Rover membership has ended. Your member history and other section memberships remain." );
        } catch (error) {
            setRoverError(applicationErrorMessage(error, "Unable to update Rover membership.", "LeaderProfile"));
        } finally { setRoverSaving(false); }
    };

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
            <Container maxWidth="xl">
                <LeaderDashboardHeader />
                <LeaderPageHeader
                    title="My Profile"
                    description="Update your leader details and account settings."
                />

                <Paper elevation={2} sx={{ p: { xs: 2.5, md: 3 }, mb: 3, borderRadius: 2 }}>
                    <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>
                        Leader Details
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
                        Signed in as {adminProfile?.displayName}
                    </Typography>

                    {profileError && <Alert severity="error" sx={{ mb: 3 }}>{profileError}</Alert>}
                    {profileMessage && <Alert severity="success" sx={{ mb: 3 }}>{profileMessage}</Alert>}

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3 }}>
                        <TextField required label="Display name" value={profile.displayName} disabled={loading}
                            onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))} />
                        <TextField label="Email address" value={profile.email} disabled helperText="Email changes are managed separately." />
                        <TextField label="Mobile number" value={profile.mobileNumber} disabled={loading}
                            onChange={(event) => setProfile((current) => ({ ...current, mobileNumber: event.target.value }))} />
                        <FormControl disabled={loading}>
                            <InputLabel>Section</InputLabel>
                            <Select label="Section" value={profile.section}
                                onChange={(event) => setProfile((current) => ({ ...current, section: event.target.value }))}>
                                {sections.map((section) => <MenuItem key={section} value={section}>{section}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <TextField label="Role" value={profile.role} disabled helperText="Only an administrator can change access roles."
                            sx={{ gridColumn: { sm: "1 / -1" } }} />
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 4 }}>
                        <Button variant="contained" color="success" disabled={loading || savingProfile} onClick={() => void saveProfile()}>
                            {savingProfile ? "Saving..." : "Save Details"}
                        </Button>
                    </Box>

                    <Divider sx={{ my: 5 }} />

                    <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>
                        Change Password
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.75, mb: 3 }}>
                        For security, enter your current password before choosing a new one.
                    </Typography>

                    {passwordError && <Alert severity="error" sx={{ mb: 3 }}>{passwordError}</Alert>}
                    {passwordMessage && <Alert severity="success" sx={{ mb: 3 }}>{passwordMessage}</Alert>}

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3 }}>
                        <PasswordField label="Current password" value={currentPassword}
                            onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password"
                            sx={{ gridColumn: { sm: "1 / -1" } }} />
                        <PasswordField label="New password" value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" helperText="At least 8 characters." />
                        <PasswordField label="Confirm new password" value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 4 }}>
                        <Button variant="contained" color="secondary" disabled={changingPassword} onClick={() => void changePassword()}>
                            {changingPassword ? "Changing..." : "Change Password"}
                        </Button>
                    </Box>
                </Paper>

                <Paper data-testid="scouter-consent-tile" component="section" variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, mb: 3, borderRadius: 3, borderWidth: 2, borderColor: "secondary.main", backgroundColor: "background.paper" }}>
                    <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2.5, alignItems: { sm: "center" } }}>
                        <HealthAndSafetyOutlinedIcon aria-hidden="true" color="secondary" sx={{ fontSize: 48, flexShrink: 0 }} />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="h5" color="secondary" sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>My Scouter Consent & Medical Form</Typography>
                            <Typography color="text.secondary" sx={{ mt: 0.5 }}>Complete the confidential ES3 18+ Medical Advice Form using the existing secure consent workflow.</Typography>
                            <Typography data-testid="scouter-consent-status" sx={{ mt: 1, fontWeight: 700 }}>Status: Available</Typography>
                        </Box>
                        <Button component={Link} to="/leader/profile/consent" variant="contained" color="secondary" sx={{ minHeight: 44, flexShrink: 0, alignSelf: { xs: "stretch", sm: "center" } }}>Open My Form</Button>
                    </Box>
                </Paper>

                <Paper elevation={2} sx={{ p: { xs: 2.5, md: 3 }, mb: 3, borderRadius: 2 }} data-testid="rover-self-membership">
                    <Typography variant="h5" color="secondary" sx={{ fontWeight: 800 }}>Rover Membership</Typography>
                    <Typography color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                        Explicitly join or leave Rovers. Eligibility is checked against your active, approved leader account. This does not grant leader access.
                    </Typography>
                    {roverError && <Alert severity="error" sx={{ mb: 2 }}>{roverError}</Alert>}
                    {roverMessage && <Alert severity="success" sx={{ mb: 2 }}>{roverMessage}</Alert>}
                    {!roverActive && <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mb: 2 }}>
                        <TextField label="First name" value={roverFirstName} disabled={roverLoading || roverSaving} onChange={(event) => setRoverFirstName(event.target.value)} />
                        <TextField label="Last name" value={roverLastName} disabled={roverLoading || roverSaving} onChange={(event) => setRoverLastName(event.target.value)} />
                    </Box>}
                    <Button variant="contained" color={roverActive ? "warning" : "success"} disabled={roverLoading || roverSaving || (!roverActive && (!roverFirstName.trim() || !roverLastName.trim()))} onClick={() => void saveRoverMembership(!roverActive)}>
                        {roverLoading ? "Checking membership…" : roverSaving ? "Saving…" : roverActive ? "End Rover Membership" : "Join Rovers"}
                    </Button>
                </Paper>
            </Container>
        </Box>
    );
}
