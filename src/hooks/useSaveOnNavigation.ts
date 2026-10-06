import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type SaveDraft = () => Promise<boolean>;

/** Saves a valid dirty editor before in-app links or browser Back leave it. */
export function useSaveOnNavigation(dirty: boolean, saveDraft: SaveDraft) {
  const location = useLocation();
  const navigate = useNavigate();
  const dirtyRef = useRef(dirty);
  const saveRef = useRef(saveDraft);
  const navigationInFlightRef = useRef(false);
  const restoringBackRef = useRef(false);
  const allowBackRef = useRef(false);

  useLayoutEffect(() => {
    dirtyRef.current = dirty;
    saveRef.current = saveDraft;
  }, [dirty, saveDraft]);

  const navigateWithoutSave = useCallback((path: string, replace = false) => {
    dirtyRef.current = false;
    navigate(path, { replace });
  }, [navigateWithoutSave]);

  const navigateAfterSave = useCallback(async (path: string, replace = false) => {
    if (navigationInFlightRef.current) return false;
    if (!dirtyRef.current) {
      navigate(path, { replace });
      return true;
    }

    navigationInFlightRef.current = true;
    try {
      if (!(await saveRef.current())) return false;
      navigateWithoutSave(path, replace);
      return true;
    } finally {
      navigationInFlightRef.current = false;
    }
  }, [navigate]);

  useEffect(() => {
    if (!dirty) return;

    const currentUrl = `${location.pathname}${location.search}${location.hash}`;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const popState = (event: PopStateEvent) => {
      if (allowBackRef.current) {
        allowBackRef.current = false;
        return;
      }
      if (restoringBackRef.current) {
        restoringBackRef.current = false;
        window.setTimeout(() => {
          void (async () => {
            if (navigationInFlightRef.current) return;
            navigationInFlightRef.current = true;
            try {
              if (!(await saveRef.current())) return;
              dirtyRef.current = false;
              allowBackRef.current = true;
              window.history.back();
            } finally {
              navigationInFlightRef.current = false;
            }
          })();
        }, 0);
        return;
      }
      if (!dirtyRef.current) return;

      // Restore the editor entry before React Router processes the Back event.
      // The next popstate is the forward restoration; after saving, Back is
      // allowed through exactly once to finish the user's original action.
      event.stopImmediatePropagation();
      restoringBackRef.current = true;
      window.history.forward();
    };

    const captureLink = (event: MouseEvent) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const path = `${url.pathname}${url.search}${url.hash}`;
      if (path === currentUrl) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      void navigateAfterSave(path);
    };

    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", popState, true);
    document.addEventListener("click", captureLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", popState, true);
      document.removeEventListener("click", captureLink, true);
    };
  }, [dirty, location.hash, location.pathname, location.search, navigateAfterSave]);

  return { navigateAfterSave, navigateWithoutSave };
}
