import { applicationErrorMessage } from "../services/applicationErrors.ts";
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import PasswordField from "../components/PasswordField";
import { confirmMemberInactivation, loadMemberInactivationContext } from "../services/emailNotifications";
import type { MemberInactivationContext } from "../services/emailNotifications";
import { loginParent, logoutParent } from "../services/parentPortal";

function errorMessage(error: unknown, fallback: string): string {
    return applicationErrorMessage(error, fallback, "Member lifecycle");
}

export default function ParentMemberInactivation() {
    const { actionToken = "" } = useParams();
    const { user, loading: authLoading } = useAdminAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [context, setContext] = useState<MemberInactivationContext | null>(null);
    const [loading, setLoading] = useState(false);
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const [complete, setComplete] = useState(false);

    useEffect(() => {
        if (authLoading || !user || !actionToken) return;
        let cancelled = false;
        setLoading(true);
        setError("");
        void loadMemberInactivationContext(actionToken)
            .then((result) => { if (!cancelled) setContext(result); })
            .catch((loadError) => { if (!cancelled) setError(errorMessage(loadError, "Unable to load the member lifecycle action.")); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [actionToken, authLoading, user]);

    const signIn = async () => {
        setWorking(true);
        setError("");
        try {
            await loginParent(email, password);
        } catch (failure) {
            setError(applicationErrorMessage(failure, "Unable to sign in. Check the email and password and try again.", "ParentMemberInactivation"));
        } finally {
            setWorking(false);
        }
    };

    const applyInactivation = async () => {
        if (!context || context.member.status !== "active") return;
        setWorking(true);
        setError("");
        try {
            await confirmMemberInactivation(actionToken);
            setComplete(true);
            setContext({ ...context, member: { ...context.member, status: "inactive" } });
        } catch (actionError) {
            setError(errorMessage(actionError, "Unable to update the member status. Nothing was changed."));
        } finally {
            setWorking(false);
        }
    };

    return (
        <Box sx={{ minHeight: "75vh", backgroundColor: "background.default", py: { xs: 4, md: 7 } }}>
            <Container maxWidth="sm">
                <Paper elevation={3} sx={{ p: { xs: 3, md: 4 } }}>
                    <Typography component="h1" variant="h3" color="secondary">Member status</Typography>
                    <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                        This link opens a secure portal workflow. Opening the email does not change any member information.
                    </Typography>

                    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                    {!authLoading && !user && <Stack spacing={2}>
                        <Alert severity="info">Sign in to confirm that you are authorised for the member in this link.</Alert>
                        <TextField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
                        <PasswordField label="Password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
                        <Button variant="contained" color="success" disabled={working || !email.trim() || !password} onClick={() => void signIn()}>
                            {working ? "Signing in…" : "Sign In and Continue"}
                        </Button>
                        <Button component={Link} to="/parent">Open Parent Portal instead</Button>
                    </Stack>}

                    {user && loading && <Alert severity="info">Checking your access and the current member status…</Alert>}

                    {user && context && !complete && <Stack spacing={2.5}>
                        <Typography variant="h5" color="secondary">Mark {context.member.displayName || "this member"} as inactive?</Typography>
                        {context.member.section && <Typography>Current section: <strong>{context.member.section}</strong></Typography>}
                        {context.member.status === "active" ? <>
                            <Alert severity="warning">
                                This will remove {context.member.displayName || "the member"} from normal active-member workflows. It does not delete their record.
                            </Alert>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                                <Button component={Link} to="/parent" variant="outlined">Cancel</Button>
                                <Button variant="contained" color="warning" disabled={working} onClick={() => void applyInactivation()}>
                                    {working ? "Updating…" : "Confirm inactive"}
                                </Button>
                            </Stack>
                        </> : <Alert severity="info">
                            This member is already {context.member.status}. No additional lifecycle change is required.
                        </Alert>}
                        <Button onClick={() => void logoutParent()}>Sign in with a different account</Button>
                    </Stack>}

                    {complete && <Stack spacing={2}>
                        <Alert severity="success">The member has been marked inactive. Relevant leadership has been notified.</Alert>
                        <Button component={Link} to="/parent" variant="contained" color="success">Return to Parent Portal</Button>
                    </Stack>}
                </Paper>
            </Container>
        </Box>
    );
}
