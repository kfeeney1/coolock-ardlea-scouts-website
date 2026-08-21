import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Container,
    Paper,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { sendPasswordResetEmail } from "firebase/auth";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import ParentConsentSection from "../components/parent/ParentConsentSection";
import ParentEventConsentSection from "../components/parent/ParentEventConsentSection";
import { auth } from "../firebase";
import {
    createParentAccessForCurrentUser,
    loadParentAccount,
    loginParent,
    logoutParent,
    registerParent
} from "../services/parentPortal";
import type { ParentAccount } from "../services/parentPortal";

function firebaseErrorCode(error: unknown): string {
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
    ) {
        return (error as { code: string }).code;
    }
    return "";
}

export default function ParentPortal() {
    const { user, adminProfile, loading: adminAuthLoading } = useAdminAuth();
    const leaderAccount = Boolean(adminProfile);
    const [mode, setMode] = useState<"login" | "register">("login");
    const [accountReady, setAccountReady] = useState(false);
    const [account, setAccount] = useState<ParentAccount | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [mobileNumber, setMobileNumber] = useState("");
    const [working, setWorking] = useState(false);
    const [resettingPassword, setResettingPassword] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const location = useLocation();
    const leaderAccessDenied = Boolean(
        (location.state as { leaderAccessDenied?: boolean } | null)?.leaderAccessDenied
    );

    useEffect(() => {
        if (adminAuthLoading) return;

        let cancelled = false;
        const load = async () => {
            if (!user) {
                if (!cancelled) {
                    setAccount(null);
                    setAccountReady(true);
                }
                return;
            }

            setAccountReady(false);
            setEmail(user.email || "");
            try {
                const parentAccount = await loadParentAccount(user.uid);
                if (!cancelled) setAccount(parentAccount);
            } catch (loadError) {
                console.error("Unable to load parent account:", loadError);
                if (!cancelled) setError("Unable to load your parent access record.");
            } finally {
                if (!cancelled) setAccountReady(true);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [adminAuthLoading, user]);

    const submit = async () => {
        setWorking(true);
        setError("");
        setMessage("");
        try {
            if (mode === "register") {
                if (!displayName.trim()) {
                    setError("Your name is required.");
                    return;
                }
                await registerParent(email, password, displayName, mobileNumber);
                const newUser = auth.currentUser;
                if (newUser) {
                    setAccount(await loadParentAccount(newUser.uid));
                    setAccountReady(true);
                }
            } else {
                await loginParent(email, password);
            }
        } catch (submitError) {
            console.error("Parent portal sign-in error:", submitError);
            const code = firebaseErrorCode(submitError);
            if (code === "auth/email-already-in-use") {
                setMode("login");
                setError("An account already exists for this email. If you are already a leader, use the same email and password you use for Leader Login.");
            } else if (code === "auth/invalid-credential") {
                setError("The email or password was not recognised. If you are already a leader, use exactly the same email and password as Leader Login.");
            } else if (code === "auth/weak-password") {
                setError("Please choose a password with at least 6 characters.");
            } else if (code === "auth/invalid-email") {
                setError("Please enter a valid email address.");
            } else {
                setError(mode === "register" ? "Unable to create the parent account. Check the details and try again." : "Unable to sign in. Check the email and password and try again.");
            }
        } finally {
            setWorking(false);
        }
    };

    const resetPassword = async () => {
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            setError("Enter your email address first, then select Forgot Password.");
            setMessage("");
            return;
        }

        setResettingPassword(true);
        setError("");
        setMessage("");
        try {
            await sendPasswordResetEmail(auth, trimmedEmail);
            setMessage("If an account exists for that email address, a password-reset email has been sent. Check your inbox and spam folder.");
        } catch (resetError) {
            console.error("Unable to send parent password reset email:", resetError);
            setMessage("If an account exists for that email address, a password-reset email will be sent. Check your inbox and spam folder.");
        } finally {
            setResettingPassword(false);
        }
    };

    const enableExistingAccount = async () => {
        if (!displayName.trim()) {
            setError("Your parent / guardian name is required.");
            return;
        }
        setWorking(true);
        setError("");
        try {
            await createParentAccessForCurrentUser(displayName, mobileNumber);
            const current = auth.currentUser;
            if (current) setAccount(await loadParentAccount(current.uid));
        } catch (setupError) {
            console.error("Unable to enable parent access:", setupError);
            setError("Unable to enable parent access for this account.");
        } finally {
            setWorking(false);
        }
    };

    const leaderHeader = leaderAccount ? (
        <>
            <LeaderDashboardHeader />
            <LeaderPageHeader
                title="Parent Portal"
                description={account
                    ? `Manage parent access for ${account.displayName || account.email}, including upcoming event consent and linked medical forms.`
                    : "Set up and manage parent access using the same account you use for Leader Dashboard."}
                actions={
                    account ? (
                        <Button variant="outlined" color="secondary" onClick={() => void logoutParent()}>
                            Sign Out
                        </Button>
                    ) : undefined
                }
            />
        </>
    ) : null;

    const shellWidth = leaderAccount ? "xl" : account ? "lg" : "sm";

    if (adminAuthLoading || (user && !accountReady)) {
        return (
            <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
                <Container maxWidth={shellWidth}>
                    {leaderHeader}
                    <Paper variant={leaderAccount ? "outlined" : "elevation"} elevation={leaderAccount ? 0 : 3} sx={{ p: { xs: 3, md: 4 }, minHeight: 240, borderRadius: 2 }}>
                        {!leaderAccount && <Typography variant="h3" color="secondary">Parent Consent Portal</Typography>}
                        <Box sx={{ minHeight: 140, display: "grid", placeItems: "center" }}>
                            <CircularProgress color="success" size={32} />
                        </Box>
                    </Paper>
                </Container>
            </Box>
        );
    }

    if (user && !account) {
        return (
            <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
                <Container maxWidth={leaderAccount ? "xl" : "sm"}>
                    {leaderHeader}
                    <Paper variant={leaderAccount ? "outlined" : "elevation"} elevation={leaderAccount ? 0 : 3} sx={{ p: { xs: 3, md: 4 }, borderRadius: 2 }}>
                        {!leaderAccount && <Typography variant="h3" color="secondary">Parent Consent Portal</Typography>}
                        {leaderAccessDenied && <Alert severity="warning" sx={{ mt: leaderAccount ? 0 : 2 }}>This account does not have leader access. Parent accounts cannot open Leader Dashboard pages.</Alert>}
                        <Alert severity="info" sx={{ mt: leaderAccount ? 0 : 2, mb: 3 }}>
                            {leaderAccount ? "Use this same Leader account for parent access — no second login or password is required." : "You are already signed in. Set up parent access for this existing account."}
                        </Alert>
                        <Stack spacing={2}>
                            <TextField label="Parent / Guardian name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                            <TextField label="Mobile number" value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} />
                            {error && <Alert severity="error">{error}</Alert>}
                            <Button variant="contained" color="success" disabled={working} onClick={() => void enableExistingAccount()}>{working ? "Please wait…" : "Enable Parent Access"}</Button>
                            <Button variant="text" color="secondary" onClick={() => void logoutParent()}>Sign Out</Button>
                        </Stack>
                    </Paper>
                </Container>
            </Box>
        );
    }

    if (account) {
        return (
            <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 6 } }}>
                <Container maxWidth={leaderAccount ? "xl" : "lg"}>
                    {leaderHeader}
                    <Paper variant={leaderAccount ? "outlined" : "elevation"} elevation={leaderAccount ? 0 : 3} sx={{ p: { xs: 3, md: 4 }, borderRadius: 2 }}>
                        {!leaderAccount && (
                            <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", gap: 2 }}>
                                <Box>
                                    <Typography variant="h3" color="secondary">Parent Consent Portal</Typography>
                                    <Typography color="text.secondary" sx={{ mt: 1 }}>Signed in as {account.displayName || account.email}</Typography>
                                </Box>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                    <Button component={Link} to="/leader/register" variant="outlined" color="secondary">Request Leader Access</Button>
                                    <Button variant="outlined" color="secondary" onClick={() => void logoutParent()}>Sign Out</Button>
                                </Stack>
                            </Box>
                        )}

                        {leaderAccessDenied && !leaderAccount && <Alert severity="warning" sx={{ mt: 3 }}>Parent access does not include Leader Dashboard access. Only accounts with an active leader record can open leader pages.</Alert>}
                        {account.status === "pending" && <Alert severity="info" sx={{ mt: leaderAccount ? 0 : 3 }}>Your parent account has been registered and is waiting for an administrator to verify and link it to your child or children. You do not need to enable anything yourself. Medical and consent information remains hidden until approval is complete.</Alert>}
                        {account.status === "rejected" && <Alert severity="warning" sx={{ mt: leaderAccount ? 0 : 3 }}>This access request has not been approved. Please contact the Scout Group if you believe this is incorrect.</Alert>}
                        {account.status === "approved" && (
                            <>
                                <Alert severity="success" sx={{ mb: 3 }}>
                                    Your account is approved and linked to {account.memberIds.length} member record{account.memberIds.length === 1 ? "" : "s"}.
                                </Alert>

                                <Typography variant="h5" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Upcoming Events & Event Consent</Typography>
                                <ParentEventConsentSection sections={account.linkedSections} />

                                <Typography variant="h5" color="secondary" sx={{ mt: 4, mb: 2, fontWeight: 800 }}>Consent & Medical Forms</Typography>
                                <ParentConsentSection memberIds={account.memberIds} />
                            </>
                        )}
                    </Paper>
                </Container>
            </Box>
        );
    }

    return (
        <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 7 } }}>
            <Container maxWidth="sm">
                <Paper elevation={3} sx={{ p: { xs: 3, md: 4 } }}>
                    <Typography variant="h3" color="secondary">Parent Consent Portal</Typography>
                    <Typography color="text.secondary" sx={{ mt: 1 }}>Sign in to manage consent and medical information for children linked to your parent account.</Typography>
                    <Alert severity="info" sx={{ mt: 2, mb: 3 }}>Already a leader? Do not register again. Sign in here using the same email and password as Leader Login.</Alert>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
                    <Stack spacing={2}>
                        {mode === "register" && <><TextField label="Parent / Guardian name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /><TextField label="Mobile number" value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} /></>}
                        <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                        <TextField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} helperText={mode === "register" ? "Use at least 6 characters." : undefined} />
                        <Button variant="contained" color="success" disabled={working || resettingPassword || !email || !password} onClick={() => void submit()}>{working ? "Please wait…" : mode === "register" ? "Create Parent Account" : "Sign In"}</Button>
                        {mode === "login" && (
                            <Button variant="text" color="secondary" disabled={working || resettingPassword} onClick={() => void resetPassword()}>
                                {resettingPassword ? "Sending reset email…" : "Forgot Password?"}
                            </Button>
                        )}
                        <Button variant="text" color="secondary" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Need an account? Register" : "Already registered? Sign in"}</Button>
                    </Stack>
                </Paper>
            </Container>
        </Box>
    );
}
