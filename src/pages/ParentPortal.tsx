import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from "@mui/material";
import { sendPasswordResetEmail } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { OperationalErrorState, OperationalLoading, OperationalPermissionState } from "../components/admin/OperationalStates";
import ParentAdventureSkillsSection from "../components/parent/ParentAdventureSkillsSection";
import ParentConsentSection from "../components/parent/ParentConsentSection";
import ParentEventConsentSection from "../components/parent/ParentEventConsentSection";
import ParentThingsToDo from "../components/parent/ParentThingsToDo";
import { auth } from "../firebase";
import { classifyFirestoreFailure, firestoreFailureMessage } from "../services/firestoreErrors";
import type { ParentChildRequest } from "../services/parentChildMatching";
import { createParentAccessForCurrentUser, loadParentAccount, loginParent, logoutParent, registerParent } from "../services/parentPortal";
import type { ParentAccount } from "../services/parentPortal";

const emptyChild = (): ParentChildRequest => ({ firstName: "", lastName: "", dateOfBirth: "" });

function firebaseErrorCode(error: unknown): string {
    if (typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string") return (error as { code: string }).code;
    return "";
}

function ChildFields({ children, setChildren }: { children: ParentChildRequest[]; setChildren: (value: ParentChildRequest[]) => void }) {
    const update = (index: number, field: keyof ParentChildRequest, value: string) => setChildren(children.map((child, i) => i === index ? { ...child, [field]: value } : child));
    return <Stack spacing={2}>
        <Typography variant="h6">Your child or children</Typography>
        <Typography color="text.secondary">Provide only the child's name and date of birth. These details are submitted for verification and never grant access automatically.</Typography>
        {children.map((child, index) => <Paper key={index} variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
                <Typography sx={{ fontWeight: 800 }}>Child {index + 1}</Typography>
                <TextField label={`Child ${index + 1} first name`} value={child.firstName} onChange={(event) => update(index, "firstName", event.target.value)} required />
                <TextField label={`Child ${index + 1} surname`} value={child.lastName} onChange={(event) => update(index, "lastName", event.target.value)} required />
                <TextField label={`Child ${index + 1} date of birth`} type="date" value={child.dateOfBirth} onChange={(event) => update(index, "dateOfBirth", event.target.value)} slotProps={{ inputLabel: { shrink: true } }} required />
                {children.length > 1 && <Button color="secondary" onClick={() => setChildren(children.filter((_, i) => i !== index))}>Remove Child {index + 1}</Button>}
            </Stack>
        </Paper>)}
        {children.length < 8 && <Button variant="outlined" color="secondary" onClick={() => setChildren([...children, emptyChild()])}>Add another child</Button>}
    </Stack>;
}

export default function ParentPortal() {
    const { user, adminProfile, loading: adminAuthLoading } = useAdminAuth();
    const leaderAccount = Boolean(adminProfile);
    const [mode, setMode] = useState<"login" | "register">("login");
    const [accountReady, setAccountReady] = useState(false);
    const [account, setAccount] = useState<ParentAccount | null>(null);
    const [accountLoadError, setAccountLoadError] = useState<unknown>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [mobileNumber, setMobileNumber] = useState("");
    const [children, setChildren] = useState<ParentChildRequest[]>([emptyChild()]);
    const [working, setWorking] = useState(false);
    const [resettingPassword, setResettingPassword] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [taskSummaryVersion, setTaskSummaryVersion] = useState(0);
    const location = useLocation();
    const leaderAccessDenied = Boolean((location.state as { leaderAccessDenied?: boolean } | null)?.leaderAccessDenied);

    const loadAccount = useCallback(async () => {
        if (adminAuthLoading) return;
        if (!user) { setAccount(null); setAccountLoadError(null); setAccountReady(true); return; }
        setAccountReady(false); setAccountLoadError(null); setEmail(user.email || "");
        try { setAccount(await loadParentAccount(user.uid)); }
        catch (loadError) { console.error("Unable to load parent account:", loadError); setAccount(null); setAccountLoadError(loadError); }
        finally { setAccountReady(true); }
    }, [adminAuthLoading, user]);
    useEffect(() => { void loadAccount(); }, [loadAccount]);

    const validateRegistration = () => {
        if (!displayName.trim()) return "Your name is required.";
        if (!mobileNumber.trim()) return "Your mobile number is required.";
        if (children.length === 0 || children.some((child) => !child.firstName.trim() || !child.lastName.trim() || !child.dateOfBirth.trim())) return "Enter a first name, surname and date of birth for each child.";
        return "";
    };

    const submit = async () => {
        setWorking(true); setError(""); setMessage("");
        try {
            if (mode === "register") {
                const validation = validateRegistration();
                if (validation) { setError(validation); return; }
                await registerParent(email, password, displayName, mobileNumber, children);
                const newUser = auth.currentUser;
                if (newUser) { setAccountLoadError(null); setAccount(await loadParentAccount(newUser.uid)); setAccountReady(true); }
            } else await loginParent(email, password);
        } catch (submitError) {
            console.error("Parent portal sign-in error:", submitError);
            const code = firebaseErrorCode(submitError);
            if (code === "auth/email-already-in-use") { setMode("login"); setError("An account already exists for this email. Sign in with your existing password."); }
            else if (code === "auth/invalid-credential") setError("The email or password was not recognised.");
            else if (code === "auth/weak-password") setError("Please choose a password with at least 6 characters.");
            else if (code === "auth/invalid-email") setError("Please enter a valid email address.");
            else setError(mode === "register" ? "Unable to create the parent account. Check the details and try again." : "Unable to sign in. Check the email and password and try again.");
        } finally { setWorking(false); }
    };

    const resetPassword = async () => {
        const trimmedEmail = email.trim();
        if (!trimmedEmail) { setError("Enter your email address first, then select Forgot Password."); setMessage(""); return; }
        setResettingPassword(true); setError(""); setMessage("");
        try { await sendPasswordResetEmail(auth, trimmedEmail); }
        catch (resetError) { console.error("Unable to send parent password reset email:", resetError); }
        finally { setMessage("If an account exists for that email address, a password-reset email has been sent. Check your inbox and spam folder."); setResettingPassword(false); }
    };

    const enableExistingAccount = async () => {
        const validation = validateRegistration();
        if (validation) { setError(validation); return; }
        setWorking(true); setError("");
        try {
            await createParentAccessForCurrentUser(displayName, mobileNumber, children);
            const current = auth.currentUser;
            if (current) { setAccountLoadError(null); setAccount(await loadParentAccount(current.uid)); }
        } catch (setupError) { console.error("Unable to enable parent access:", setupError); setError("Unable to enable parent access for this account."); }
        finally { setWorking(false); }
    };

    const leaderHeader = leaderAccount ? <><LeaderDashboardHeader /><LeaderPageHeader title="Parent Portal" description={account ? `Manage parent access for ${account.displayName || account.email}.` : "Set up parent access using the same account you use for Leader Dashboard."} /></> : null;
    const shellWidth = leaderAccount ? "xl" : account ? "lg" : "sm";

    if (adminAuthLoading || (user && !accountReady)) return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 4 }}><Container maxWidth={shellWidth}>{leaderHeader}<Paper sx={{ p: 4 }}><OperationalLoading minHeight={140} label="Loading parent access" /></Paper></Container></Box>;

    if (user && accountLoadError) {
        const loadMessage = firestoreFailureMessage(accountLoadError, "Unable to load your parent access record.");
        const permissionDenied = classifyFirestoreFailure(accountLoadError) === "permission";
        return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 4 }}><Container maxWidth={leaderAccount ? "xl" : "sm"}>{leaderHeader}<Paper sx={{ p: 4 }}>{permissionDenied ? <OperationalPermissionState title="Parent access record restricted" actionLabel="Retry" onAction={() => void loadAccount()}>{loadMessage}</OperationalPermissionState> : <OperationalErrorState title="Parent access record could not be loaded" actionLabel="Retry" onAction={() => void loadAccount()}>{loadMessage}</OperationalErrorState>}<Button onClick={() => void logoutParent()}>Sign Out</Button></Paper></Container></Box>;
    }

    if (user && !account) return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 4 }}><Container maxWidth={leaderAccount ? "xl" : "sm"}>{leaderHeader}<Paper sx={{ p: 4 }}>{!leaderAccount && <Typography component="h1" variant="h3" color="secondary">Parent Portal</Typography>}{leaderAccessDenied && <Alert severity="warning" sx={{ mt: 2 }}>This account does not have leader access.</Alert>}<Alert severity="info" sx={{ my: 2 }}>Set up parent access by identifying your child or children. The details are submitted for leader verification; no child information is shown before approval.</Alert><Stack spacing={2}><TextField label="Parent / Guardian name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /><TextField label="Mobile number" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} /><ChildFields children={children} setChildren={setChildren} />{error && <Alert severity="error">{error}</Alert>}<Button variant="contained" color="success" disabled={working} onClick={() => void enableExistingAccount()}>{working ? "Please wait…" : "Enable Parent Access"}</Button><Button onClick={() => void logoutParent()}>Sign Out</Button></Stack></Paper></Container></Box>;

    if (account) return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 4 }}><Container maxWidth={leaderAccount ? "xl" : "lg"}>{leaderHeader}<Paper sx={{ p: { xs: 3, md: 4 } }}>{!leaderAccount && <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", gap: 2 }}><Box><Typography component="h1" variant="h3" color="secondary">Parent Portal</Typography><Typography color="text.secondary">Signed in as {account.displayName || account.email}</Typography></Box><Stack direction={{ xs: "column", sm: "row" }} spacing={1}><Button component={Link} to="/leader/register" variant="outlined">Request Leader Access</Button><Button variant="outlined" onClick={() => void logoutParent()}>Sign Out</Button></Stack></Box>}{account.status === "pending" && <Alert severity="info" sx={{ mt: leaderAccount ? 0 : 3 }}>Your child's details have been submitted for verification. A leader must verify and approve each relationship before any protected child information becomes available.</Alert>}{account.status === "rejected" && <Alert severity="warning" sx={{ mt: 3 }}>This access request has not been approved. Please contact the Scout Group if you believe this is incorrect.</Alert>}{account.status === "revoked" && <Alert severity="warning" sx={{ mt: 3 }}>Parent access has been revoked. No linked child information is available.</Alert>}{account.status === "approved" && <><Alert severity="success" sx={{ mb: 3 }}>Your account is approved and linked to {account.memberIds.length} member record{account.memberIds.length === 1 ? "" : "s"}.</Alert><ParentThingsToDo memberIds={account.memberIds} sections={account.linkedSections} refreshVersion={taskSummaryVersion} /><Box id="parent-adventure-skills" sx={{ mt: 4 }}><Typography variant="h5" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Adventure Skills Progress</Typography><ParentAdventureSkillsSection memberIds={account.memberIds} /></Box><Box id="parent-event-consent" sx={{ mt: 4 }}><Typography variant="h5" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Upcoming Events & Event Consent</Typography><ParentEventConsentSection sections={account.linkedSections} /></Box><Box id="parent-medical-consent" sx={{ mt: 4 }}><Typography variant="h5" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Consent & Medical Forms</Typography><ParentConsentSection memberIds={account.memberIds} onSaved={() => setTaskSummaryVersion((version) => version + 1)} /></Box></>}</Paper></Container></Box>;

    return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 7 } }}><Container maxWidth="sm"><Paper elevation={3} sx={{ p: { xs: 3, md: 4 } }}><Typography component="h1" variant="h3" color="secondary">Parent Portal</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Sign in to view your children’s Adventure Skills progress, upcoming events and event consent, and manage linked consent and medical information.</Typography><Alert severity="info" sx={{ mt: 2, mb: 3 }}>Already a leader? Do not register again. Sign in here using the same email and password as Leader Login.</Alert>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}<Stack spacing={2}>{mode === "register" && <><TextField label="Parent / Guardian name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /><TextField label="Mobile number" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} required /><ChildFields children={children} setChildren={setChildren} /></>}<TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /><TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /><Button variant="contained" color="success" disabled={working} onClick={() => void submit()}>{working ? "Please wait…" : mode === "register" ? "Create Parent Account" : "Sign In"}</Button>{mode === "login" && <Button disabled={resettingPassword} onClick={() => void resetPassword()}>Forgot Password?</Button>}<Button color="secondary" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Need an account? Register" : "Already registered? Sign In"}</Button></Stack></Paper></Container></Box>;
}
