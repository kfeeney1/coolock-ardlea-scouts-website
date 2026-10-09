import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type LeaveRequest =
  | { kind: "navigate"; destination: string }
  | { kind: "back" }
  | { kind: "sign-out"; button: HTMLButtonElement };

type SaveDraft = () => Promise<boolean>;
const HISTORY_GUARD_KEY = "__eventEditBackGuard";

/** Protects only the existing-event editor; create and meeting flows keep their own save rules. */
export function useConfirmEventLeave(dirty: boolean, saveDraft: SaveDraft) {
  const navigate = useNavigate();
  // A remounted editor must not mistake a previous visit's history marker for its own.
  const [guardId] = useState(() => `event-edit:${crypto.randomUUID()}`);
  const saveRef = useRef(saveDraft);
  const dirtyRef = useRef(dirty);
  const backGuardArmedRef = useRef(false);
  const dialogOpenRef = useRef(false);
  const bypassNextPopRef = useRef(false);
  const allowClickRef = useRef<HTMLButtonElement | null>(null);
  const focusReturnRef = useRef<HTMLElement | null>(null);
  const savingRef = useRef(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [request, setRequest] = useState<LeaveRequest | null>(null);

  useLayoutEffect(() => {
    saveRef.current = saveDraft;
    dirtyRef.current = dirty;
    if (dirty && !backGuardArmedRef.current) {
      const currentState = window.history.state && typeof window.history.state === "object" ? window.history.state : {};
      window.history.pushState({ ...currentState, [HISTORY_GUARD_KEY]: guardId }, "", window.location.href);
      backGuardArmedRef.current = true;
    } else if (!dirty) {
      backGuardArmedRef.current = false;
      const currentState = window.history.state && typeof window.history.state === "object" ? window.history.state as Record<string, unknown> : null;
      if (currentState && HISTORY_GUARD_KEY in currentState) {
        const cleanState = { ...currentState };
        delete cleanState[HISTORY_GUARD_KEY];
        window.history.replaceState(cleanState, "", window.location.href);
      }
    }
  }, [dirty, guardId, saveDraft]);

  const openFor = useCallback((nextRequest: LeaveRequest) => {
    focusReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setRequest(nextRequest);
    dialogOpenRef.current = true;
    setDialogOpen(true);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const handlePopState = (event: PopStateEvent) => {
      if (bypassNextPopRef.current) {
        bypassNextPopRef.current = false;
        return;
      }
      if (!dirtyRef.current) return;
      // Overlay dismissal returns to this guard entry; it is not an editor leave.
      if (event.state && typeof event.state === "object" && (event.state as Record<string, unknown>)[HISTORY_GUARD_KEY] === guardId) return;
      const currentState = window.history.state && typeof window.history.state === "object" ? window.history.state : {};
      window.history.pushState({ ...currentState, [HISTORY_GUARD_KEY]: guardId }, "", window.location.href);
      backGuardArmedRef.current = true;
      if (dialogOpenRef.current) {
        dialogOpenRef.current = false;
        setDialogOpen(false);
        setRequest(null);
        window.requestAnimationFrame(() => focusReturnRef.current?.focus());
      } else {
        openFor({ kind: "back" });
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [dirty, guardId, openFor]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const handleNavigationClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest('[role="dialog"]')) return;

      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (link && !link.hasAttribute("download") && (!link.target || link.target === "_self")) {
        const destination = new URL(link.href, window.location.href);
        if (destination.origin !== window.location.origin) return;
        const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const next = `${destination.pathname}${destination.search}${destination.hash}`;
        if (current === next) return;
        event.preventDefault();
        event.stopPropagation();
        openFor({ kind: "navigate", destination: next });
        return;
      }

      const button = target.closest<HTMLButtonElement>("button");
      if (button && allowClickRef.current === button) {
        allowClickRef.current = null;
        return;
      }
      if (button?.textContent?.trim() === "Sign Out") {
        event.preventDefault();
        event.stopPropagation();
        openFor({ kind: "sign-out", button });
      }
    };
    document.addEventListener("click", handleNavigationClick, true);
    return () => document.removeEventListener("click", handleNavigationClick, true);
  }, [dirty, openFor]);

  const closeAndRestoreFocus = useCallback(() => {
    dialogOpenRef.current = false;
    setDialogOpen(false);
    setRequest(null);
    window.requestAnimationFrame(() => focusReturnRef.current?.focus());
  }, []);

  const stay = useCallback(() => closeAndRestoreFocus(), [closeAndRestoreFocus]);

  const continueWithoutSaving = useCallback(() => {
    const pending = request;
    dialogOpenRef.current = false;
    setDialogOpen(false);
    setRequest(null);
    if (!pending) return;
    if (pending.kind === "navigate") navigate(pending.destination);
    else if (pending.kind === "back") {
      bypassNextPopRef.current = true;
      navigate(-2);
    }
    else {
      allowClickRef.current = pending.button;
      pending.button.click();
    }
  }, [navigate, request]);

  const saveAndContinue = useCallback(async () => {
    if (savingRef.current || !request) return;
    savingRef.current = true;
    try {
      if (!(await saveRef.current())) {
        closeAndRestoreFocus();
        return;
      }
      const pending = request;
      dialogOpenRef.current = false;
      setDialogOpen(false);
      setRequest(null);
      if (pending.kind === "navigate") navigate(pending.destination);
      else if (pending.kind === "back") {
        bypassNextPopRef.current = true;
        navigate(-2);
      }
      else {
        allowClickRef.current = pending.button;
        pending.button.click();
      }
    } finally {
      savingRef.current = false;
    }
  }, [closeAndRestoreFocus, navigate, request]);

  return { dialogOpen, stay, continueWithoutSaving, saveAndContinue };
}
