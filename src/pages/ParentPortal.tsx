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

import {
    loadParentAccount,
    loginParent,
    logoutParent,
    observeParentAuth,
    registerParent
} from "../services/parentPortal";
import type { ParentAccount } from "../services/parentPortal";

export default function ParentPortal() {
    const [mode, setMode] = useState<"login" | "register">("login");
    const [authReady, setAuthReady] = useState(false);
    const [account, setAccount] = useState<ParentAccount | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [mobileNumber, setMobileNumber] = useState("");
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        return observeParentAuth((user) => {
            void (async () => {
                if (!user) {
                    setAccount(null);
                    setAuthReady(true);
                    return;
                }

                try {
                    setAccount(await loadParentAccount(user.uid));
                } catch (loadError) {
                    console.error("Unable to load parent account:", loadError);
                    setError("Unable to load your parent access record.");
                } finally {
                    setAuthReady(true);
                }
            })();
        });
    }, []);

    const submit = async () => {
        setWorking(true);
        setError("");

        try {
            if (mode === "register") {
                if (!displayName.trim()) {
                    setError("Your name is required.");
                    return;
                }

                await registerParent(email, password, displayName, mobileNumber);
            } else {
                await loginParent(email, password);
            }
        } catch (submitError) {
            console.error("Parent portal sign-in error:", submitError);
            setError(
                mode === "register"
                    ? "Unable to create the parent account. Check the email/password and try again."
                    : "Unable to sign in. Check the email and password and try again."
            );
        } finally {
            setWorking(false);
        }
    };

    if (!authReady) {
        return (
            <Box sx={{ minHeight: "70vh", display: "grid", placeItems: "center" }}>
                <Typography>Loading parent portal…</Typography>
            </Box>
        );
    }

    if (account) {
        return (
            <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 7 } }}>
                <Container maxWidth="md">
                    <Paper elevation={3} sx={{ p: { xs: 3, md: 4 } }}>
                        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
                            <Box>
                                <Typography variant="h3" color="secondary">
                                    Parent Consent Portal
                                </Typography>
                                <Typography color="text.secondary" sx={{ mt: 1 }}>
                                    Signed in as {account.displayName || account.email}
                                </Typography>
                            </Box>
                            <Button variant="outlined" color="secondary" onClick={() => void logoutParent()}>
                                Sign Out
                            </Button>
                        </Stack>

                        {account.status === "pending" && (
                            <Alert severity="info" sx={{ mt: 3 }}>
                                Your parent account is waiting for a leader to verify and link it to your child or children. Medical and consent information will remain hidden until that approval is complete.
                            </Alert>
                        )}

                        {account.status === "rejected" && (
                            <Alert severity="warning" sx={{ mt: 3 }}>
                                This access request has not been approved. Please contact the Scout Group if you believe this is incorrect.
                            </Alert>
                        )}

                        {account.status === "approved" && (
                            <>
                                <Alert severity="success" sx={{ mt: 3 }}>
                                    Your account is approved and linked to {account.memberIds.length} member record{account.memberIds.length === 1 ? "" : "s"}.
                                </Alert>
                                <Paper variant="outlined" sx={{ mt: 3, p: 3 }}>
                                    <Typography variant="h5" color="secondary">
                                        Consent & Medical Forms
                                    </Typography>
                                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                                        Secure member-to-consent linking is the next Stage 8.1 increment. Until that link is in place, existing medical records are intentionally not exposed here.
                                    </Typography>
                                </Paper>
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
                    <Typography variant="h3" color="secondary">
                        Parent Consent Portal
                    </Typography>
                    <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                        Sign in to manage consent and medical information for children linked to your parent account.
                    </Typography>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <Stack spacing={2}>
                        {mode === "register" && (
                            <>
                                <TextField label="Parent / Guardian name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                                <TextField label="Mobile number" value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} />
                            </>
                        )}
                        <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                        <TextField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} helperText={mode === "register" ? "Use at least 6 characters." : undefined} />
                        <Button variant="contained" color="success" disabled={working || !email || !password} onClick={() => void submit()}>
                            {working ? "Please wait…" : mode === "register" ? "Create Parent Account" : "Sign In"}
                        </Button>
                        <Button variant="text" color="secondary" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
                            {mode === "login" ? "Need an account? Register" : "Already registered? Sign in"}
                        </Button>
                    </Stack>
                </Paper>
            </Container>
        </Box>
    );
}
