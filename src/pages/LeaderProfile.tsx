import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";

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
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import {
    changeLeaderPassword,
    loadLeaderProfile,
    updateLeaderProfile
} from "../services/leaderProfile";
import type { LeaderProfileData } from "../services/leaderProfile";

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

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setProfileError("");
            try {
                setProfile(await loadLeaderProfile());
            } catch (error) {
                console.error("Unable to load leader profile:", error);
                setProfileError("Unable to load your leader profile.");
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

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
            console.error("Unable to update leader profile:", error);
            setProfileError("Unable to update your details. Please try again.");
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
            console.error("Unable to change leader password:", error);
            setPasswordError("Unable to change your password. Check your current password and try again.");
        } finally {
            setChangingPassword(false);
        }
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
                        <TextField type="password" label="Current password" value={currentPassword}
                            onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password"
                            sx={{ gridColumn: { sm: "1 / -1" } }} />
                        <TextField type="password" label="New password" value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" helperText="At least 8 characters." />
                        <TextField type="password" label="Confirm new password" value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" />
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 4 }}>
                        <Button variant="contained" color="secondary" disabled={changingPassword} onClick={() => void changePassword()}>
                            {changingPassword ? "Changing..." : "Change Password"}
                        </Button>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
}
