import { Alert, Box, Button, Container, FormControl, InputLabel, MenuItem, Paper, Select, Stack, TextField, Typography } from "@mui/material";
import { sendPasswordResetEmail } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import PasswordField from "../components/PasswordField";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { OperationalErrorState, OperationalLoading, OperationalPermissionState } from "../components/admin/OperationalStates";
import ParentAdventureSkillsSection from "../components/parent/ParentAdventureSkillsSection";
import ParentConsentSection from "../components/parent/ParentConsentSection";
import ParentEventConsentSection from "../components/parent/ParentEventConsentSection";
import ParentThingsToDo from "../components/parent/ParentThingsToDo";
import { backDismissStack } from "../services/backDismissHistory";
import { loadLinkedMembers } from "../services/parentConsent";
import type { ParentLinkedMember } from "../services/parentConsent";
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
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [linkedChildren, setLinkedChildren] = useState<ParentLinkedMember[]>([]);
    const [childrenLoadError, setChildrenLoadError] = useState(false);
    const [pendingChildId, setPendingChildId] = useState<string | null>(null);
    const pendingChildIdRef = useRef<string | null>(null);
    const portalContentRef = useRef<HTMLDivElement | null>(null);
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

    useEffect(() => {
        let cancelled = false;
        if (!account || account.status !== "approved" || account.memberIds.length === 0) {
            setLinkedChildren([]);
            return;
        }
        setChildrenLoadError(false);
        void loadLinkedMembers(account.memberIds).then((children) => {
            if (!cancelled) setLinkedChildren(children);
        }).catch((loadError) => {
            console.error("Unable to load linked child context:", loadError);
            if (!cancelled) setChildrenLoadError(true);
        });
        return () => { cancelled = true; };
    }, [account]);

    const requestedChildId = searchParams.get("child") || "";
    const selectedChild = linkedChildren.find((child) => child.id === requestedChildId) || linkedChildren[0] || null;
    useEffect(() => {
        if (!selectedChild || requestedChildId === selectedChild.id) return;
        const next = new URLSearchParams(searchParams);
        next.set("child", selectedChild.id);
        navigate({ pathname: "/parent", search: next.toString(), hash: location.hash }, { replace: true, state: location.state });
    }, [requestedChildId, searchParams, selectedChild, navigate, location.hash]);

    const rememberChildSelection = (childId: string) => {
        pendingChildIdRef.current = childId;
        setPendingChildId(childId);
    };
    const commitChildSelectionAfterClose = () => {
        const childId = pendingChildIdRef.current;
        if (!childId) return;
        const commitWhenOverlayIsGone = () => {
            const routerState = (window.history.state as { usr?: unknown } | null)?.usr ?? location.state;
            const hasPendingOverlayMarker = backDismissStack(routerState).some((marker) => marker.startsWith("transient-overlay:"));
            const hasVisibleListbox = Array.from(document.querySelectorAll<HTMLElement>('[role="listbox"]'))
                .some((listbox) => listbox.getClientRects().length > 0 && listbox.getAttribute("aria-hidden") !== "true");
            if (hasPendingOverlayMarker || hasVisibleListbox) {
                window.requestAnimationFrame(commitWhenOverlayIsGone);
                return;
            }
            pendingChildIdRef.current = null;
            setPendingChildId(null);
            const next = new URLSearchParams(window.location.search);
            next.set("child", childId);
            navigate({ pathname: "/parent", search: `?${next.toString()}`, hash: window.location.hash }, { state: routerState });
        };
        window.requestAnimationFrame(commitWhenOverlayIsGone);
    };

    useEffect(() => {
        if (!location.hash || !account || account.status !== "approved" || linkedChildren.length === 0) return;
        const targetId = decodeURIComponent(location.hash.slice(1));
        let settleTimer = 0;
        const scrollToTarget = () => {
            document.getElementById(targetId)?.scrollIntoView({ behavior: "auto", block: "start" });
            window.clearTimeout(settleTimer);
            settleTimer = window.setTimeout(() => observer.disconnect(), 750);
        };
        const observer = new ResizeObserver(scrollToTarget);
        if (portalContentRef.current) observer.observe(portalContentRef.current);
        const frame = window.requestAnimationFrame(() => window.requestAnimationFrame(scrollToTarget));
        const timeout = window.setTimeout(() => observer.disconnect(), 4_000);
        return () => {
            window.cancelAnimationFrame(frame);
            window.clearTimeout(settleTimer);
            window.clearTimeout(timeout);
            observer.disconnect();
        };
    }, [location.hash, account, linkedChildren, selectedChild?.id]);

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
            if (code === "auth/invalid-credential") setError("The email or password was not recognised. If this email is already used for Leader access, use the same password so the registrations can be linked during approval.");
            else if (code === "auth/weak-password") setError("Please choose a password with at least 6 characters.");
            else if (code === "auth/invalid-email") setError("Please enter a valid email address.");
            else setError(mode === "register" ? "Unable to create the parent registration. Check the details and try again." : "Unable to sign in. Check the email and password and try again.");
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
        } catch (setupError) { console.error("Unable to submit parent registration:", setupError); setError("Unable to submit parent registration for this account."); }
        finally { setWorking(false); }
    };

    const leaderHeader = leaderAccount ? <><LeaderDashboardHeader /><LeaderPageHeader title="Parent Portal" description={account ? `Manage parent access for ${account.displayName || account.email}.` : "Submit parent registration using the same login as your Leader account."} /></> : null;
    const shellWidth = leaderAccount ? "xl" : account ? "lg" : "sm";

    if (adminAuthLoading || (user && !accountReady)) return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 4 }}><Container maxWidth={shellWidth}>{leaderHeader}<Paper sx={{ p: 4 }}><OperationalLoading minHeight={140} label="Loading parent access" /></Paper></Container></Box>;

    if (user && accountLoadError) {
        const loadMessage = firestoreFailureMessage(accountLoadError, "Unable to load your parent access record.");
        const permissionDenied = classifyFirestoreFailure(accountLoadError) === "permission";
        return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 4 }}><Container maxWidth={leaderAccount ? "xl" : "sm"}>{leaderHeader}<Paper sx={{ p: 4 }}>{permissionDenied ? <OperationalPermissionState title="Parent access record restricted" actionLabel="Retry" onAction={() => void loadAccount()}>{loadMessage}</OperationalPermissionState> : <OperationalErrorState title="Parent access record could not be loaded" actionLabel="Retry" onAction={() => void loadAccount()}>{loadMessage}</OperationalErrorState>}<Button onClick={() => void logoutParent()}>Sign Out</Button></Paper></Container></Box>;
    }

    if (user && !account) return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 4 }}><Container maxWidth={leaderAccount ? "xl" : "sm"}>{leaderHeader}<Paper sx={{ p: 4 }}>{!leaderAccount && <Typography component="h1" variant="h3" color="secondary">Parent Portal</Typography>}{leaderAccessDenied && <Alert severity="warning" sx={{ mt: 2 }}>This account does not have leader access.</Alert>}<Alert severity="info" sx={{ my: 2 }}>Submit parent registration by identifying your child or children. The details are reviewed separately from any Leader access and never grant child access automatically.</Alert><Stack spacing={2}><TextField label="Parent / Guardian name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /><TextField label="Mobile number" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} /><ChildFields children={children} setChildren={setChildren} />{error && <Alert severity="error">{error}</Alert>}<Button variant="contained" color="success" disabled={working} onClick={() => void enableExistingAccount()}>{working ? "Please wait…" : "Submit Parent Registration"}</Button><Button onClick={() => void logoutParent()}>Sign Out</Button></Stack></Paper></Container></Box>;

    if (account) {
        const activeMemberIds = selectedChild ? [selectedChild.id] : [];
        const activeSections = selectedChild?.sections ?? [];
        const portalLinks = [
            ["Things to do", "parent-things-to-do"],
            ["Badgework", "parent-adventure-skills"],
            ["Consent & Medical", "parent-medical-consent"],
            ["Meetings & Events", "parent-event-consent"]
        ] as const;
        return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 4 }}><Container maxWidth={leaderAccount ? "xl" : "lg"}>{leaderHeader}<Paper ref={portalContentRef} sx={{ p: { xs: 3, md: 4 } }}>{leaderAccessDenied && <Alert severity="warning" sx={{ mb: 3 }}>This account does not have leader access.</Alert>}{!leaderAccount && <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", gap: 2 }}><Box><Typography component="h1" variant="h3" color="secondary">Parent Portal</Typography><Typography color="text.secondary">Signed in as {account.displayName || account.email}</Typography></Box><Button variant="outlined" onClick={() => void logoutParent()}>Sign Out</Button></Box>}{account.status === "pending" && <Alert severity="info" sx={{ mt: leaderAccount ? 0 : 3 }}>Your child's details have been submitted for verification. A leader must verify and approve each relationship before any protected child information becomes available.</Alert>}{account.status === "rejected" && <Alert severity="warning" sx={{ mt: 3 }}>This access request has not been approved. Please contact the Scout Group if you believe this is incorrect.</Alert>}{account.status === "revoked" && <Alert severity="warning" sx={{ mt: 3 }}>Parent access has been revoked. No linked child information is available.</Alert>}{account.status === "approved" && <><Alert severity="success" sx={{ mb: 3 }}>Your account is approved and linked to {account.memberIds.length} member record{account.memberIds.length === 1 ? "" : "s"}.</Alert>
            {childrenLoadError ? <Alert severity="warning" sx={{ mb: 3 }}>Child details could not be loaded. Portal navigation remains limited to the approved linked records.</Alert> : linkedChildren.length > 0 && <FormControl fullWidth sx={{ mb: 2 }}><InputLabel id="parent-child-context-label">Viewing information for</InputLabel><Select labelId="parent-child-context-label" label="Viewing information for" value={pendingChildId ?? selectedChild?.id ?? ""} onChange={(event) => rememberChildSelection(event.target.value)} onClose={commitChildSelectionAfterClose} data-testid="parent-child-context">{linkedChildren.map((child) => <MenuItem key={child.id} value={child.id}>{child.displayName} · {child.sections.join(", ")}</MenuItem>)}</Select></FormControl>}
            {selectedChild && <Typography role="status" aria-live="polite" sx={{ mb: 2 }}>Viewing {selectedChild.displayName} · {selectedChild.sections.join(", ")}</Typography>}
            <Box component="nav" aria-label="Parent Portal sections" sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(0, 1fr))" }, gap: 1, mb: 3 }} data-testid="parent-portal-menu">{portalLinks.map(([label, id]) => <Button key={id} component={Link} to={`/parent?child=${encodeURIComponent(selectedChild?.id || "") }#${id}`} onClick={() => window.requestAnimationFrame(() => window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "auto", block: "start" })))} variant="outlined" color="secondary" sx={{ minHeight: 48 }}>{label}</Button>)}</Box>
            <Box id="parent-things-to-do" sx={{ scrollMarginTop: 24 }}><ParentThingsToDo memberIds={activeMemberIds} sections={activeSections} refreshVersion={taskSummaryVersion} /></Box>
            <Box id="parent-adventure-skills" sx={{ mt: 4, scrollMarginTop: 24 }}><Typography variant="h5" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Adventure Skills Progress</Typography><ParentAdventureSkillsSection memberIds={activeMemberIds} /></Box>
            <Box id="parent-event-consent" sx={{ mt: 4, scrollMarginTop: 24 }}><Typography variant="h5" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Upcoming Events & Event Consent</Typography><ParentEventConsentSection memberIds={activeMemberIds} sections={activeSections} /></Box>
            <Box id="parent-medical-consent" sx={{ mt: 4, scrollMarginTop: 24 }}><Typography variant="h5" color="secondary" sx={{ mb: 2, fontWeight: 800 }}>Consent & Medical Forms</Typography><ParentConsentSection memberIds={activeMemberIds} onSaved={() => setTaskSummaryVersion((version) => version + 1)} /></Box>
            </>}</Paper></Container></Box>;
    }

    return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 7 } }}><Container maxWidth="sm"><Paper elevation={3} sx={{ p: { xs: 3, md: 4 } }}><Typography component="h1" variant="h3" color="secondary">Parent Portal</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Sign in to view your children’s Adventure Skills progress, upcoming events and event consent, and manage linked consent and medical information.</Typography><Alert severity="info" sx={{ mt: 2, mb: 3 }}>Parent and Leader registrations are reviewed separately. If you are both, register on each side with the same email and password; the approving administrator will confirm the shared login before granting access.</Alert>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}<Stack spacing={2}>{mode === "register" && <><TextField label="Parent / Guardian name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /><TextField label="Mobile number" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} required /><ChildFields children={children} setChildren={setChildren} /></>}<TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /><PasswordField label="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} /><Button variant="contained" color="success" disabled={working} onClick={() => void submit()}>{working ? "Please wait…" : mode === "register" ? "Create Parent Account" : "Sign In"}</Button>{mode === "login" && <Button disabled={resettingPassword} onClick={() => void resetPassword()}>Forgot Password?</Button>}<Button color="secondary" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Need an account? Register" : "Already registered? Sign In"}</Button></Stack></Paper></Container></Box>;
}
