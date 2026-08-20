import {
    Alert,
    Box,
    Button,
    Container,
    Paper,
    TextField,
    Typography
} from "@mui/material";
import { sendPasswordResetEmail } from "firebase/auth";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { auth } from "../firebase";
import { brandColours } from "../theme/theme";

type LocationState = { from?: string };

export default function AdminLogin() {
    const { login, authorised, loading } = useAdminAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [resettingPassword, setResettingPassword] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const state = location.state as LocationState | null;

    if (!loading && authorised) return <Navigate to="/leader" replace />;

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!email.trim() || !password) {
            setError("Enter your email address and password.");
            return;
        }
        setSubmitting(true);
        setError("");
        setMessage("");
        try {
            await login(email.trim(), password);
            navigate(state?.from || "/leader", { replace: true });
        } catch (loginError) {
            console.error("Leader login failed:", loginError);
            setError("Unable to sign in. Check your password and make sure an administrator has approved your leader account.");
        } finally {
            setSubmitting(false);
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
            setMessage(
                "If an account exists for that email address, Firebase has sent a password-reset email. Check your inbox and spam folder."
            );
        } catch (resetError) {
            console.error("Unable to send leader password reset email:", resetError);
            setMessage(
                "If an account exists for that email address, a password-reset email will be sent. Check your inbox and spam folder."
            );
        } finally {
            setResettingPassword(false);
        }
    };

    return (
        <Box sx={{ minHeight: "70vh", backgroundColor: "background.default", py: { xs: 5, md: 8 } }}>
            <Container maxWidth="sm">
                <Paper elevation={4} sx={{ overflow: "hidden" }}>
                    <Box sx={{ background: `linear-gradient(135deg, ${brandColours.coral}, ${brandColours.navy})`, color: "white", p: { xs: 3, md: 5 }, textAlign: "center" }}>
                        <Typography variant="h3" component="h1">Leader Login</Typography>
                        <Typography sx={{ mt: 1 }}>80th 160th Coolock Ardlea Scout Group</Typography>
                    </Box>
                    <Box component="form" onSubmit={submit} sx={{ p: { xs: 3, md: 5 } }}>
                        <Alert severity="info" sx={{ mb: 3 }}>This area is restricted to approved Scout leaders.</Alert>
                        <TextField fullWidth required type="email" label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
                        <TextField fullWidth required type="password" label="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" sx={{ mt: 3 }} />
                        {error && <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert>}
                        {message && <Alert severity="success" sx={{ mt: 3 }}>{message}</Alert>}
                        <Button fullWidth type="submit" variant="contained" color="success" size="large" disabled={submitting || resettingPassword} sx={{ mt: 4 }}>
                            {submitting ? "Signing in..." : "Sign In"}
                        </Button>
                        <Button
                            fullWidth
                            type="button"
                            variant="text"
                            color="secondary"
                            disabled={submitting || resettingPassword}
                            onClick={() => void resetPassword()}
                            sx={{ mt: 1 }}
                        >
                            {resettingPassword ? "Sending reset email..." : "Forgot Password?"}
                        </Button>
                        <Button fullWidth component={Link} to="/leader/register" variant="outlined" color="secondary" size="large" sx={{ mt: 2 }}>
                            Request Leader Access
                        </Button>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
}
