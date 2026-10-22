import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type LeaveRequest =
  | { kind: "navigate"; destination: string }
  | { kind: "back" }
  | { kind: "sign-out"; button: HTMLButtonElement };

type SaveDraft = () => Promise<boolean>;
const HISTORY_GUARD_KEY = "__eventEditBackGuard";

/** Shared Save / Discard / Stay guard; existing event behaviour remains the default. */
export function useConfirmEventLeave(dirty: boolean, saveDraft: SaveDraft, afterSavedLeave?: (request: LeaveRequest) => boolean) {
  const navigate = useNavigate();
  // A remounted editor must not mistake a previous visit's history marker for its own.
  const [guardId] = useState(() => `event-edit:${crypto.randomUUID()}`);
  const saveRef = useRef(saveDraft);
  const afterSavedLeaveRef = useRef(afterSavedLeave);
  const dirtyRef = useRef(dirty);
  const backGuardArmedRef = useRef(false);
  const dialogOpenRef = useRef(false);
  const bypassNextPopRef = useRef(false);
  const allowClickRef = useRef<HTMLButtonElement | null>(null);
  const focusReturnRef = useRef<HTMLElement | null>(null);
  const savingRef = useRef(false);
  // A successful save must release the capture-phase guard synchronously,
  // before React commits the new persisted baseline or navigation unmounts us.
  const leavingRef = useRef(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [request, setRequest] = useState<LeaveRequest | null>(null);

  useLayoutEffect(() => {
    saveRef.current = saveDraft;
    afterSavedLeaveRef.current = afterSavedLeave;
    dirtyRef.current = dirty && !leavingRef.current;
    if (dirtyRef.current && !backGuardArmedRef.current) {
      const currentState = window.history.state && typeof window.history.state === "object" ? window.history.state : {};
      window.history.pushState({ ...currentState, [HISTORY_GUARD_KEY]: guardId }, "", window.location.href);
      backGuardArmedRef.current = true;
    } else if (!dirtyRef.current) {
      backGuardArmedRef.current = false;
      const currentState = window.history.state && typeof window.history.state === "object" ? window.history.state as Record<string, unknown> : null;
      if (currentState && HISTORY_GUARD_KEY in currentState) {
        const cleanState = { ...currentState };
        delete cleanState[HISTORY_GUARD_KEY];
        window.history.replaceState(cleanState, "", window.location.href);
      }
    }
  }, [dirty, guardId, saveDraft, afterSavedLeave]);

  // Keep the navigation guards installed for the editor lifetime. Re-attaching
  // them when `dirty` changes leaves a passive-effect gap after an edit, during
  // which a fast navigation could bypass the Save / Discard / Stay dialog.
  const openFor = useCallback((nextRequest: LeaveRequest) => {
    focusReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setRequest(nextRequest);
    dialogOpenRef.current = true;
    setDialogOpen(true);
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (bypassNextPopRef.current) {
        bypassNextPopRef.current = false;
        return;
      }
      if (!dirtyRef.current || leavingRef.current) return;
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
  }, [guardId, openFor]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  useEffect(() => {
    const handleNavigationClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!dirtyRef.current || leavingRef.current) return;
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
  }, [openFor]);

  const closeAndRestoreFocus = useCallback(() => {
    dialogOpenRef.current = false;
    setDialogOpen(false);
    setRequest(null);
    window.requestAnimationFrame(() => focusReturnRef.current?.focus());
  }, []);

  const stay = useCallback(() => closeAndRestoreFocus(), [closeAndRestoreFocus]);

  const releaseGuard = useCallback(() => {
    leavingRef.current = true;
    dirtyRef.current = false;
    dialogOpenRef.current = false;
    backGuardArmedRef.current = false;
    const state = window.history.state;
    if (state && typeof state === "object" && HISTORY_GUARD_KEY in state) {
      const nextState = { ...state };
      delete nextState[HISTORY_GUARD_KEY];
      window.history.replaceState(nextState, "", window.location.href);
    }
  }, []);

  const continueWithoutSaving = useCallback(() => {
    const pending = request;
    releaseGuard();
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
  }, [navigate, releaseGuard, request]);

  const saveAndContinue = useCallback(async () => {
    if (savingRef.current || !request) return;
    savingRef.current = true;
    try {
      if (!(await saveRef.current())) {
        closeAndRestoreFocus();
        return;
      }
      const pending = request;
      releaseGuard();
      setDialogOpen(false);
      setRequest(null);
      // A source editor may return to the newly saved date while keeping the shared guard.
      if (afterSavedLeaveRef.current?.(pending)) return;
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
  }, [closeAndRestoreFocus, navigate, releaseGuard, request]);

  // Explicit Save Event also needs to release the guard before route navigation.
  // Otherwise the committed baseline may not render before this editor unmounts.
  const releaseAfterSuccessfulSave = useCallback(() => {
    releaseGuard();
    setDialogOpen(false);
    setRequest(null);
  }, [releaseGuard]);

  return { dialogOpen, stay, continueWithoutSaving, saveAndContinue, releaseAfterSuccessfulSave };
}
