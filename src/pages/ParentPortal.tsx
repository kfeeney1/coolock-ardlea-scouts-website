import { reportApplicationError, applicationErrorMessage } from "../services/applicationErrors.ts";
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from "@mui/material";
import { requestPasswordReset } from "../services/passwordReset";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import LeaderDashboardHeader from "../components/admin/LeaderDashboardHeader";
import LeaderPageHeader from "../components/admin/LeaderPageHeader";
import PasswordField from "../components/PasswordField";
import { useAdminAuth } from "../components/admin/AdminAuthProvider";
import { OperationalErrorState, OperationalLoading, OperationalPermissionState } from "../components/admin/OperationalStates";
import ParentPortalSections from "../components/parent/ParentPortalSections";
import ParentChildRequestFields from "../components/ParentChildRequestFields";
import { BACK_DISMISS_STATE_KEY, backDismissStack } from "../services/backDismissHistory";
import { loadLinkedMembers } from "../services/parentConsent";
import type { ParentLinkedMember } from "../services/parentConsent";
import { auth } from "../firebase";
import { resolveJoinConsentContext } from "../services/emailNotifications";
import { classifyFirestoreFailure, firestoreFailureMessage } from "../services/firestoreErrors";
import type { ParentChildRequest } from "../services/parentChildMatching";
import { createParentAccessForCurrentUser, loadParentAccount, loginParent, logoutParent, registerParent } from "../services/parentPortal";
import type { ParentAccount } from "../services/parentPortal";

const emptyChild = (): ParentChildRequest => ({ firstName: "", lastName: "", dateOfBirth: "" });

function firebaseErrorCode(error: unknown): string {
    if (typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string") return (error as { code: string }).code;
    return "";
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
    const [joinConsentNotice, setJoinConsentNotice] = useState("");
    const [taskSummaryVersion, setTaskSummaryVersion] = useState(0);
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [linkedChildren, setLinkedChildren] = useState<ParentLinkedMember[]>([]);
    const [childrenLoadError, setChildrenLoadError] = useState(false);
    const [pendingChildId, setPendingChildId] = useState<string | null>(null);
    const pendingChildIdRef = useRef<string | null>(null);
    const handledJoinConsentTokenRef = useRef("");
    const childCommitTimerRef = useRef<number | null>(null);
    const portalContentRef = useRef<HTMLDivElement | null>(null);
    const leaderAccessDenied = Boolean((location.state as { leaderAccessDenied?: boolean } | null)?.leaderAccessDenied);

    const loadAccount = useCallback(async () => {
        if (adminAuthLoading) return;
        if (!user) { setAccount(null); setAccountLoadError(null); setAccountReady(true); return; }
        setAccountReady(false); setAccountLoadError(null); setEmail(user.email || "");
        try { setAccount(await loadParentAccount(user.uid)); }
        catch (loadError) { reportApplicationError(loadError, { area: "ParentPortal", operation: "Unable to load parent account" }); setAccount(null); setAccountLoadError(loadError); }
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
            reportApplicationError(loadError, { area: "ParentPortal", operation: "Unable to load linked child context" });
            if (!cancelled) setChildrenLoadError(true);
        });
        return () => { cancelled = true; };
    }, [account]);

    const requestedChildId = searchParams.get("child") || "";
    const joinConsentToken = searchParams.get("joinToken") || "";
    const selectedChild = linkedChildren.find((child) => child.id === pendingChildId)
        || linkedChildren.find((child) => child.id === requestedChildId)
        || linkedChildren[0]
        || null;
    useEffect(() => {
        if (pendingChildId && requestedChildId === pendingChildId) {
            pendingChildIdRef.current = null;
            setPendingChildId(null);
            return;
        }
        if (pendingChildId || !selectedChild || requestedChildId === selectedChild.id) return;
        const next = new URLSearchParams(searchParams);
        next.set("child", selectedChild.id);
        navigate({ pathname: "/parent", search: next.toString(), hash: location.hash }, { replace: true, state: location.state });
    }, [requestedChildId, searchParams, selectedChild, navigate, location.hash]);

    useEffect(() => {
        if (!joinConsentToken || !user || handledJoinConsentTokenRef.current === joinConsentToken) return;
        handledJoinConsentTokenRef.current = joinConsentToken;
        let cancelled = false;
        void resolveJoinConsentContext(joinConsentToken).then(async ({ memberId }) => {
            if (cancelled) return;
            const refreshed = await loadParentAccount(user.uid);
            if (cancelled) return;
            setAccount(refreshed);
            setAccountReady(true);
            const next = new URLSearchParams(searchParams);
            next.delete("joinToken");
            next.set("child", memberId);
            setJoinConsentNotice("Your accepted child is linked to this Parent Portal account. Review and submit the consent form below.");
            navigate({ pathname: "/parent", search: next.toString(), hash: "#parent-medical-consent" }, { replace: true, state: location.state });
        }).catch((contextError) => {
            if (cancelled) return;
            handledJoinConsentTokenRef.current = "";
            reportApplicationError(contextError, { area: "ParentPortal", operation: "Unable to resolve accepted Join Us consent context" });
            setJoinConsentNotice("This accepted-child link is unavailable for this account. Confirm that you are signed in with the parent email used for the application or contact a leader.");
        });
        return () => { cancelled = true; };
    }, [joinConsentToken, user, searchParams, navigate, location.state]);

    const rememberChildSelection = (childId: string) => {
        if (childCommitTimerRef.current !== null) window.clearTimeout(childCommitTimerRef.current);
        childCommitTimerRef.current = null;
        pendingChildIdRef.current = childId;
        setPendingChildId(childId);
    };
    const commitChildSelectionAfterClose = () => {
        const childId = pendingChildIdRef.current;
        if (!childId || childCommitTimerRef.current !== null) return;
        childCommitTimerRef.current = window.setTimeout(() => {
            childCommitTimerRef.current = null;
            if (pendingChildIdRef.current !== childId) return;
            const routerState = (window.history.state as { usr?: unknown } | null)?.usr ?? location.state;
            const nextState = routerState && typeof routerState === "object" && !Array.isArray(routerState)
                ? { ...(routerState as Record<string, unknown>) }
                : {};
            const remainingMarkers = backDismissStack(nextState).filter((marker) => !marker.startsWith("transient-overlay:"));
            if (remainingMarkers.length > 0) nextState[BACK_DISMISS_STATE_KEY] = remainingMarkers;
            else delete nextState[BACK_DISMISS_STATE_KEY];
            const next = new URLSearchParams(window.location.search);
            next.set("child", childId);
            navigate({ pathname: "/parent", search: `?${next.toString()}`, hash: window.location.hash }, { replace: true, state: nextState });
        }, 1_000);
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
        if (!joinConsentToken && (children.length === 0 || children.some((child) => !child.firstName.trim() || !child.lastName.trim() || !child.dateOfBirth.trim()))) return "Enter a first name, surname and date of birth for each child.";
        return "";
    };

    const submit = async () => {
        setWorking(true); setError(""); setMessage("");
        try {
            if (mode === "register") {
                const validation = validateRegistration();
                if (validation) { setError(validation); return; }
                await registerParent(email, password, displayName, mobileNumber, joinConsentToken ? [] : children);
                const newUser = auth.currentUser;
                if (newUser) { setAccountLoadError(null); setAccount(await loadParentAccount(newUser.uid)); setAccountReady(true); }
            } else await loginParent(email, password);
        } catch (submitError) {
            const code = firebaseErrorCode(submitError);
            if (code === "auth/invalid-credential") setError(applicationErrorMessage(submitError, "The email or password was not recognised. If this email is already used for Leader access, use the same password so the registrations can be linked during approval.", "ParentPortal"));
            else if (code === "auth/weak-password") setError(applicationErrorMessage(submitError, "Please choose a password with at least 6 characters.", "ParentPortal"));
            else if (code === "auth/invalid-email") setError(applicationErrorMessage(submitError, "Please enter a valid email address.", "ParentPortal"));
            else setError(applicationErrorMessage(submitError, "Unable to sign in. Check the email and password and try again.", "ParentPortal"));
        } finally { setWorking(false); }
    };

    const resetPassword = async () => {
        const trimmedEmail = email.trim();
        if (!trimmedEmail) { setError("Enter your email address first, then select Forgot Password."); setMessage(""); return; }
        setResettingPassword(true); setError(""); setMessage("");
        const result = await requestPasswordReset(auth, trimmedEmail, "ParentPortal");
        setMessage(result.message);
        setError(result.error);
        setResettingPassword(false);
    };

    const enableExistingAccount = async () => {
        const validation = validateRegistration();
        if (validation) { setError(validation); return; }
        setWorking(true); setError("");
        try {
            await createParentAccessForCurrentUser(displayName, mobileNumber, joinConsentToken ? [] : children);
            const current = auth.currentUser;
            if (current) { setAccountLoadError(null); setAccount(await loadParentAccount(current.uid)); }
        } catch (setupError) { setError(applicationErrorMessage(setupError, "Unable to submit parent registration for this account.", "ParentPortal")); }
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

    if (user && !account) return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 4 }}><Container maxWidth={leaderAccount ? "xl" : "sm"}>{leaderHeader}<Paper sx={{ p: 4 }}>{!leaderAccount && <Typography component="h1" variant="h3" color="secondary">Parent Portal</Typography>}{leaderAccessDenied && <Alert severity="warning" sx={{ mt: 2 }}>This account does not have leader access.</Alert>}<Alert severity="info" sx={{ my: 2 }}>Submit parent registration by identifying your child or children. The details are reviewed separately from any Leader access and never grant child access automatically.</Alert><Stack spacing={2}><TextField label="Parent / Guardian name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /><TextField label="Mobile number" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} />{!joinConsentToken && <ParentChildRequestFields children={children} setChildren={setChildren} />}{joinConsentToken && <Alert severity="info">This registration came from an accepted Join Us email. Sign in or submit your parent details; the accepted child will be linked securely from that application.</Alert>}{error && <Alert severity="error">{error}</Alert>}<Button variant="contained" color="success" disabled={working} onClick={() => void enableExistingAccount()}>{working ? "Please wait…" : "Submit Parent Registration"}</Button><Button onClick={() => void logoutParent()}>Sign Out</Button></Stack></Paper></Container></Box>;

    if (account) {
        return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: 4 }}><Container maxWidth={leaderAccount ? "xl" : "lg"}>{leaderHeader}<Paper ref={portalContentRef} sx={{ p: { xs: 3, md: 4 } }}>{leaderAccessDenied && <Alert severity="warning" sx={{ mb: 3 }}>This account does not have leader access.</Alert>}{!leaderAccount && <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", gap: 2 }}><Box><Typography component="h1" variant="h3" color="secondary">Parent Portal</Typography><Typography color="text.secondary">Signed in as {account.displayName || account.email}</Typography></Box><Button variant="outlined" onClick={() => void logoutParent()}>Sign Out</Button></Box>}{account.status === "pending" && <Alert severity="info" sx={{ mt: leaderAccount ? 0 : 3 }}>Your child's details have been submitted for verification. A leader must verify and approve each relationship before any protected child information becomes available.</Alert>}{account.status === "rejected" && <Alert severity="warning" sx={{ mt: 3 }}>This access request has not been approved. Please contact the Scout Group if you believe this is incorrect.</Alert>}{account.status === "revoked" && <Alert severity="warning" sx={{ mt: 3 }}>Parent access has been revoked. No linked child information is available.</Alert>}{account.status === "approved" && <><Alert severity="success" sx={{ mb: 3 }}>Your account is approved and linked to {account.memberIds.length} member record{account.memberIds.length === 1 ? "" : "s"}.</Alert>{joinConsentNotice && <Alert severity="info" sx={{ mb: 3 }}>{joinConsentNotice}</Alert>}
            <ParentPortalSections
                linkedChildren={linkedChildren}
                selectedChild={selectedChild}
                pendingChildId={pendingChildId}
                childrenLoadError={childrenLoadError}
                taskSummaryVersion={taskSummaryVersion}
                onRememberChildSelection={rememberChildSelection}
                onCommitChildSelectionAfterClose={commitChildSelectionAfterClose}
                onConsentSaved={() => setTaskSummaryVersion((version) => version + 1)}
            />
            </>}</Paper></Container></Box>;
    }

    return <Box sx={{ minHeight: "100vh", backgroundColor: "background.default", py: { xs: 4, md: 7 } }}><Container maxWidth="sm"><Paper elevation={3} sx={{ p: { xs: 3, md: 4 } }}><Typography component="h1" variant="h3" color="secondary">Parent Portal</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Sign in to view your children’s Adventure Skills progress, upcoming events and event consent, and manage linked consent and medical information.</Typography><Alert severity="info" sx={{ mt: 2, mb: 3 }}>Parent and Leader registrations are reviewed separately. If you are both, register on each side with the same email and password; the approving administrator will confirm the shared login before granting access.</Alert>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}<Stack spacing={2}>{mode === "register" && <><TextField label="Parent / Guardian name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required /><TextField label="Mobile number" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} required />{!joinConsentToken && <ParentChildRequestFields children={children} setChildren={setChildren} />}{joinConsentToken && <Alert severity="info">Use the parent email that received the acceptance message. The accepted child will be linked after authentication.</Alert>}</>}<TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /><PasswordField label="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "register" ? "new-password" : "current-password"} /><Button variant="contained" color="success" disabled={working} onClick={() => void submit()}>{working ? "Please wait…" : mode === "register" ? "Create Parent Account" : "Sign In"}</Button>{mode === "login" && <Button disabled={resettingPassword} onClick={() => void resetPassword()}>Forgot Password?</Button>}<Button color="secondary" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setMessage(""); }}>{mode === "login" ? "Need an account? Register" : "Already registered? Sign In"}</Button></Stack></Paper></Container></Box>;
}
