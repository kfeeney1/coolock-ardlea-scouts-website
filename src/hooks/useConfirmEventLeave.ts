import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type LeaveRequest =
  | { kind: "navigate"; destination: string }
  | { kind: "back" }
  | { kind: "sign-out"; button: HTMLButtonElement };

type SaveDraft = () => Promise<boolean>;
const HISTORY_GUARD_KEY = "__eventEditBackGuard";
const DIALOG_HISTORY_GUARD_KEY = "__eventEditDialogBackGuard";

function locationStateWithGuard(state: unknown, guard: string): Record<string, unknown> {
  return { ...(state && typeof state === "object" && !Array.isArray(state) ? state : {}), [HISTORY_GUARD_KEY]: guard };
}

function hasGuard(state: unknown, guard: string): boolean {
  return Boolean(state && typeof state === "object" && (state as Record<string, unknown>)[HISTORY_GUARD_KEY] === guard);
}

/** Protects only the existing-event editor; create and meeting flows keep their own save rules. */
export function useConfirmEventLeave(dirty: boolean, saveDraft: SaveDraft) {
  const location = useLocation();
  const navigate = useNavigate();
  const guardId = useId();
  const dialogGuardId = `dialog:${guardId}`;
  const saveRef = useRef(saveDraft);
  const dirtyRef = useRef(dirty);
  const armedRef = useRef(false);
  const dialogArmedRef = useRef(false);
  const allowClickRef = useRef<HTMLButtonElement | null>(null);
  const focusReturnRef = useRef<HTMLElement | null>(null);
  const savingRef = useRef(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [request, setRequest] = useState<LeaveRequest | null>(null);

  useLayoutEffect(() => {
    saveRef.current = saveDraft;
    dirtyRef.current = dirty;
  }, [dirty, saveDraft]);

  const openFor = useCallback((nextRequest: LeaveRequest) => {
    focusReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setRequest(nextRequest);
    setDialogOpen(true);
  }, []);

  useLayoutEffect(() => {
    const marked = hasGuard(location.state, guardId);
    const dialogMarked = hasGuard(location.state, dialogGuardId);
    if (!dirty) {
      armedRef.current = false;
      if (!marked) return;
      const timer = window.setTimeout(() => {
        // A successful explicit save may navigate as soon as its promise resolves.
        // Consume the guard only when the editor is still the active route.
        if (!dirtyRef.current && window.location.pathname === location.pathname) navigate(-1);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (dialogOpen) {
      if (dialogMarked) {
        dialogArmedRef.current = true;
        return;
      }
      if (dialogArmedRef.current) {
        // Browser/Android Back popped the dialog's own same-route history entry.
        dialogArmedRef.current = false;
        setDialogOpen(false);
        setRequest(null);
        window.requestAnimationFrame(() => focusReturnRef.current?.focus());
        return;
      }
      navigate(`${location.pathname}${location.search}${location.hash}`, {
        state: { ...(location.state && typeof location.state === "object" ? location.state as Record<string, unknown> : {}), [DIALOG_HISTORY_GUARD_KEY]: dialogGuardId }
      });
      return;
    }
    if (marked) {
      armedRef.current = true;
      return;
    }
    if (armedRef.current) {
      // A same-route history marker was popped. Keep the editor mounted and ask what to do.
      armedRef.current = false;
      openFor({ kind: "back" });
      return;
    }
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      state: locationStateWithGuard(location.state, guardId)
    });
  }, [dialogGuardId, dialogOpen, dirty, guardId, location.hash, location.pathname, location.search, location.state, navigate, openFor]);

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
    setDialogOpen(false);
    setRequest(null);
    if (hasGuard(location.state, dialogGuardId) && dialogArmedRef.current) {
      dialogArmedRef.current = false;
      navigate(-1);
    }
    window.requestAnimationFrame(() => focusReturnRef.current?.focus());
  }, [dialogGuardId, location.state, navigate]);

  const stay = useCallback(() => closeAndRestoreFocus(), [closeAndRestoreFocus]);

  const continueWithoutSaving = useCallback(() => {
    const pending = request;
    setDialogOpen(false);
    setRequest(null);
    if (!pending) return;
    if (pending.kind === "navigate") navigate(pending.destination);
    else if (pending.kind === "back") navigate(-2);
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
      setDialogOpen(false);
      setRequest(null);
      if (pending.kind === "navigate") navigate(pending.destination);
      else if (pending.kind === "back") navigate(-2);
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
