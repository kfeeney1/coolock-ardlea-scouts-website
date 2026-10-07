import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

type SaveDraft = () => Promise<boolean>;

/** Saves a valid dirty editor before explicit navigation or browser Back leaves it. */
export function useSaveOnNavigation(dirty: boolean, saveDraft: SaveDraft) {
  const navigate = useNavigate();
  const dirtyRef = useRef(dirty);
  const saveRef = useRef(saveDraft);
  const navigationInFlightRef = useRef(false);
  const previousUrlRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    dirtyRef.current = dirty;
    saveRef.current = saveDraft;
  }, [dirty, saveDraft]);

  const navigateWithoutSave = useCallback((path: string, replace = false) => {
    dirtyRef.current = false;
    navigate(path, { replace });
  }, [navigate]);

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
  }, [navigateWithoutSave]);

  useEffect(() => {
    if (!dirty) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.replaceState({ ...window.history.state, sw170ReturnUrl: currentUrl }, "");
    previousUrlRef.current = currentUrl;

    const popState = (event: PopStateEvent) => {
      if (!dirtyRef.current || navigationInFlightRef.current) return;

      const destination = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      event.stopImmediatePropagation();
      navigationInFlightRef.current = true;

      void (async () => {
        try {
          if (!(await saveRef.current())) {
            const returnUrl = previousUrlRef.current;
            if (returnUrl) navigate(returnUrl, { replace: true });
            return;
          }
          dirtyRef.current = false;
          navigate(destination, { replace: true });
        } finally {
          navigationInFlightRef.current = false;
        }
      })();
    };

    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", popState, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", popState, true);
    };
  }, [dirty, navigate]);

  return { navigateAfterSave, navigateWithoutSave };
}
