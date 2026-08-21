import {
    Alert,
    Box,
    Button,
    Checkbox,
    Container,
    FormControl,
    FormControlLabel,
    FormHelperText,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    TextField,
    Typography
} from "@mui/material";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { auth } from "../firebase";
import { brandColours } from "../theme/theme";
import { registerLeader } from "../services/leaderRegistrations";
import type {
    LeaderRegistrationInput,
    RequestedLeaderRole,
    RequestedSection
} from "../services/leaderRegistrations";

type Errors = Partial<
    Record<keyof LeaderRegistrationInput | "confirmPassword", string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s+\-()]{7,20}$/;

const initialForm: LeaderRegistrationInput = {
    fullName: "",
    email: "",
    password: "",
    mobileNumber: "",
    requestedRole: "",
    requestedSection: "",
    reason: "",
    privacyConfirmed: false
};

export default function LeaderRegister() {
    const [formData, setFormData] = useState<LeaderRegistrationInput>(initialForm);
    const [confirmPassword, setConfirmPassword] = useState("");
    const [usingExistingAccount, setUsingExistingAccount] = useState(false);
    const [errors, setErrors] = useState<Errors>({});
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        return onAuthStateChanged(auth, (user) => {
            const existing = Boolean(user);
            setUsingExistingAccount(existing);
            if (user?.email) {
                setFormData((current) => ({
                    ...current,
                    email: user.email || current.email,
                    password: ""
                }));
                setConfirmPassword("");
            }
        });
    }, []);

    const clear = (field: keyof Errors) =>
        setErrors((current) => ({ ...current, [field]: undefined }));

    const validate = () => {
        const nextErrors: Errors = {};
        if (!formData.fullName.trim()) nextErrors.fullName = "Full name is required.";
        if (!formData.email.trim()) nextErrors.email = "Email address is required.";
        else if (!EMAIL_RE.test(formData.email.trim())) nextErrors.email = "Enter a valid email address.";
        if (!PHONE_RE.test(formData.mobileNumber.trim())) nextErrors.mobileNumber = "Enter a valid mobile number.";
        if (!usingExistingAccount) {
            if (formData.password.length < 8) nextErrors.password = "Use at least 8 characters.";
            if (confirmPassword !== formData.password) nextErrors.confirmPassword = "Passwords do not match.";
        }
        if (!formData.requestedRole) nextErrors.requestedRole = "Select the role you are requesting.";
        if (!formData.requestedSection) nextErrors.requestedSection = "Select the section.";
        if (!formData.privacyConfirmed) nextErrors.privacyConfirmed = "You must confirm this before registering.";
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!validate() || submitting) return;
        setSubmitting(true);
        setSubmitError("");
        try {
            await registerLeader(formData);
            setSubmitted(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (error) {
            console.error("Unable to register leader:", error);
            setSubmitError(
                usingExistingAccount
                    ? "Unable to create the leader access request for this account. A request may already exist; contact an administrator if needed."
                    : "Unable to create the registration request. The email address may already have an account, or Firebase rejected the request."
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <Box sx={{ minHeight: "70vh", backgroundColor: "background.default", py: { xs: 5, md: 8 } }}>
                <Container maxWidth="sm">
                    <Paper elevation={4} sx={{ p: { xs: 3, md: 5 }, textAlign: "center", borderTop: `7px solid ${brandColours.green}` }}>
                        <Typography variant="h3" color="secondary">Registration Received</Typography>
                        <Alert severity="success" sx={{ mt: 3 }}>
                            Your leader registration request has been sent to the group administrator.
                        </Alert>
                        <Typography sx={{ mt: 3 }}>
                            You will not be able to access the Leader Dashboard until an administrator approves your account.
                        </Typography>
                        <Button component={Link} to={usingExistingAccount ? "/parent" : "/leader/login"} variant="contained" color="secondary" sx={{ mt: 4 }}>
                            {usingExistingAccount ? "Return to Parent Portal" : "Return to Leader Login"}
                        </Button>
                    </Paper>
                </Container>
            </Box>
        );
    }

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 7 } }}>
            <Container maxWidth="md">
                <Paper elevation={4} sx={{ overflow: "hidden" }}>
                    <Box sx={{ background: `linear-gradient(135deg, ${brandColours.coral}, ${brandColours.navy})`, color: "white", p: { xs: 3, md: 5 }, textAlign: "center" }}>
                        <Typography variant="h3" component="h1">Leader Registration</Typography>
                        <Typography sx={{ mt: 1.5 }}>80th 160th Coolock Ardlea Scout Group</Typography>
                    </Box>

                    <Box component="form" onSubmit={submit} noValidate sx={{ p: { xs: 3, md: 5 } }}>
                        <Alert severity="info" sx={{ mb: 4 }}>
                            {usingExistingAccount
                                ? "You are already signed in. This request will add Leader Access to the same account after administrator approval — no second login or password is needed."
                                : "Registration creates a pending account request. An existing administrator must approve it before Leader Dashboard access is granted."}
                        </Alert>

                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 3 }}>
                            <TextField required label="Full name" value={formData.fullName}
                                onChange={(e) => { setFormData(c => ({ ...c, fullName: e.target.value })); clear("fullName"); }}
                                error={Boolean(errors.fullName)} helperText={errors.fullName} />

                            <TextField required type="email" label="Email address" value={formData.email}
                                disabled={usingExistingAccount}
                                onChange={(e) => { setFormData(c => ({ ...c, email: e.target.value })); clear("email"); }}
                                error={Boolean(errors.email)} helperText={usingExistingAccount ? "Uses your current signed-in account." : errors.email} />

                            <TextField required label="Mobile number" value={formData.mobileNumber}
                                onChange={(e) => { setFormData(c => ({ ...c, mobileNumber: e.target.value })); clear("mobileNumber"); }}
                                error={Boolean(errors.mobileNumber)} helperText={errors.mobileNumber} />

                            <FormControl required error={Boolean(errors.requestedRole)}>
                                <InputLabel>Requested role</InputLabel>
                                <Select label="Requested role" value={formData.requestedRole}
                                    onChange={(e) => { setFormData(c => ({ ...c, requestedRole: e.target.value as RequestedLeaderRole })); clear("requestedRole"); }}>
                                    <MenuItem value="Scouter">Scouter</MenuItem>
                                    <MenuItem value="Section Leader">Section Leader</MenuItem>
                                    <MenuItem value="Group Leader">Group Leader</MenuItem>
                                    <MenuItem value="Other">Other</MenuItem>
                                </Select>
                                {errors.requestedRole && <FormHelperText>{errors.requestedRole}</FormHelperText>}
                            </FormControl>

                            <FormControl required error={Boolean(errors.requestedSection)}>
                                <InputLabel>Section</InputLabel>
                                <Select label="Section" value={formData.requestedSection}
                                    onChange={(e) => { setFormData(c => ({ ...c, requestedSection: e.target.value as RequestedSection })); clear("requestedSection"); }}>
                                    {["Beavers", "Cubs", "Scouts", "Ventures", "Rovers", "Group", "Other"].map(section => (
                                        <MenuItem key={section} value={section}>{section}</MenuItem>
                                    ))}
                                </Select>
                                {errors.requestedSection && <FormHelperText>{errors.requestedSection}</FormHelperText>}
                            </FormControl>

                            {!usingExistingAccount && <Box />}

                            {!usingExistingAccount && (
                                <TextField required type="password" label="Password" value={formData.password}
                                    onChange={(e) => { setFormData(c => ({ ...c, password: e.target.value })); clear("password"); }}
                                    error={Boolean(errors.password)} helperText={errors.password ?? "At least 8 characters."} autoComplete="new-password" />
                            )}

                            {!usingExistingAccount && (
                                <TextField required type="password" label="Confirm password" value={confirmPassword}
                                    onChange={(e) => { setConfirmPassword(e.target.value); clear("confirmPassword"); }}
                                    error={Boolean(errors.confirmPassword)} helperText={errors.confirmPassword} autoComplete="new-password" />
                            )}
                        </Box>

                        <TextField fullWidth multiline minRows={4} label="Reason / additional information" value={formData.reason}
                            onChange={(e) => setFormData(c => ({ ...c, reason: e.target.value }))}
                            helperText="Optional information for the approving administrator." sx={{ mt: 3 }} />

                        <FormControl error={Boolean(errors.privacyConfirmed)} sx={{ mt: 3 }}>
                            <FormControlLabel control={<Checkbox color="success" checked={formData.privacyConfirmed}
                                onChange={(e) => { setFormData(c => ({ ...c, privacyConfirmed: e.target.checked })); clear("privacyConfirmed"); }} />}
                                label="I confirm that the information supplied is accurate and may be used by the Scout Group to assess this leader access request." />
                            {errors.privacyConfirmed && <FormHelperText>{errors.privacyConfirmed}</FormHelperText>}
                        </FormControl>

                        {submitError && <Alert severity="error" sx={{ mt: 3 }}>{submitError}</Alert>}

                        <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2, justifyContent: "space-between", mt: 4 }}>
                            <Button component={Link} to={usingExistingAccount ? "/parent" : "/leader/login"} color="secondary">
                                {usingExistingAccount ? "Back to Parent Portal" : "Back to Login"}
                            </Button>
                            <Button type="submit" variant="contained" color="success" disabled={submitting}>
                                {submitting ? "Registering..." : "Request Leader Access"}
                            </Button>
                        </Box>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
}
