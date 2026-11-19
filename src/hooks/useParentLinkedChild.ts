import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { reportApplicationError } from "../services/applicationErrors.ts";
import { afterTransientOverlayClose } from "../services/afterTransientOverlayClose";
import { loadLinkedMembers, type ParentLinkedMember } from "../services/parentConsent";
import type { ParentAccount } from "../services/parentPortal";

export function useParentLinkedChild(account: ParentAccount | null) {
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [linkedChildren, setLinkedChildren] = useState<ParentLinkedMember[]>([]);
    const [childrenLoadError, setChildrenLoadError] = useState(false);
    const [pendingChildId, setPendingChildId] = useState<string | null>(null);
    const pendingChildIdRef = useRef<string | null>(null);
    const cancelChildCommitRef = useRef<(() => void) | null>(null);
    const portalContentRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const cancelPendingChildCommit = () => {
            cancelChildCommitRef.current?.();
            cancelChildCommitRef.current = null;
            pendingChildIdRef.current = null;
        };
        const handleNavigation = (event: Event) => {
            const destinationUrl = (event as Event & { destination?: { url?: string } }).destination?.url;
            if (!destinationUrl) return;
            try {
                if (new URL(destinationUrl).pathname !== "/parent") cancelPendingChildCommit();
            } catch {
                cancelPendingChildCommit();
            }
        };
        const navigationApi = (window as Window & { navigation?: EventTarget }).navigation;
        navigationApi?.addEventListener("navigate", handleNavigation);
        window.addEventListener("beforeunload", cancelPendingChildCommit);
        return () => {
            navigationApi?.removeEventListener("navigate", handleNavigation);
            window.removeEventListener("beforeunload", cancelPendingChildCommit);
            cancelPendingChildCommit();
        };
    }, []);

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
    const selectedChild = linkedChildren.find((child) => child.id === pendingChildId)
        || linkedChildren.find((child) => child.id === requestedChildId)
        || linkedChildren[0]
        || null;
    useEffect(() => {
        // Linked-child loading may finish after a visible header navigation.
        // Do not replace the destination with a late Parent Portal URL cleanup.
        if (window.location.pathname !== "/parent") return;
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

    const rememberChildSelection = (childId: string) => {
        cancelChildCommitRef.current?.();
        cancelChildCommitRef.current = null;
        pendingChildIdRef.current = childId;
        setPendingChildId(childId);
    };
    const commitChildSelectionAfterClose = () => {
        const childId = pendingChildIdRef.current;
        if (!childId || cancelChildCommitRef.current !== null) return;
        // Commit only after the select's browser Back entry is consumed. A
        // query replacement during its exit transition can otherwise leave a
        // stale marker which restores the previous child after a reload.
        cancelChildCommitRef.current = afterTransientOverlayClose((routerState) => {
            cancelChildCommitRef.current = null;
            if (pendingChildIdRef.current !== childId || window.location.pathname !== "/parent") return;
            const next = new URLSearchParams(window.location.search);
            next.set("child", childId);
            navigate({ pathname: "/parent", search: `?${next.toString()}`, hash: window.location.hash }, { replace: true, state: routerState });
        });
    };

    useEffect(() => {
        if (!location.hash || !account || account.status !== "approved" || linkedChildren.length === 0) return;
        const targetId = decodeURIComponent(location.hash.slice(1));
        let stoppedByUser = false;
        let settleTimer = 0;
        let timeout = 0;
        let frame = 0;
        const stopFollowingUserInteraction = () => {
            stoppedByUser = true;
            observer.disconnect();
            window.clearTimeout(settleTimer);
            window.clearTimeout(timeout);
            window.cancelAnimationFrame(frame);
        };
        const scrollToTarget = () => {
            if (stoppedByUser) return;
            document.getElementById(targetId)?.scrollIntoView({ behavior: "auto", block: "start" });
            window.clearTimeout(settleTimer);
            settleTimer = window.setTimeout(() => observer.disconnect(), 750);
        };
        const observer = new ResizeObserver(scrollToTarget);
        const interactionEvents = ["pointerdown", "touchstart", "wheel", "keydown"] as const;
        interactionEvents.forEach((eventName) => window.addEventListener(eventName, stopFollowingUserInteraction, true));
        if (portalContentRef.current) observer.observe(portalContentRef.current);
        frame = window.requestAnimationFrame(() => window.requestAnimationFrame(scrollToTarget));
        timeout = window.setTimeout(() => observer.disconnect(), 4_000);
        return () => {
            interactionEvents.forEach((eventName) => window.removeEventListener(eventName, stopFollowingUserInteraction, true));
            window.cancelAnimationFrame(frame);
            window.clearTimeout(settleTimer);
            window.clearTimeout(timeout);
            observer.disconnect();
        };
    }, [location.hash, account, linkedChildren, selectedChild?.id]);

    return {
        linkedChildren,
        selectedChild,
        pendingChildId,
        childrenLoadError,
        rememberChildSelection,
        commitChildSelectionAfterClose,
        portalContentRef,
    };
}
