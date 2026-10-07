import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

type SaveDraft = () => Promise<boolean>;

/** Saves a valid dirty editor before explicit navigation or browser Back leaves it. */
export function useSaveOnNavigation(dirty: boolean, saveDraft: SaveDraft) {
  const navigate = useNavigate();
  const dirtyRef = useRef(dirty);
  const saveRef = useRef(saveDraft);
  const navigationInFlightRef = useRef(false);
  const backGuardArmedRef = useRef(false);
  const completingBackRef = useRef(false);

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
    if (!dirty) {
      backGuardArmedRef.current = false;
      return;
    }

    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    if (!backGuardArmedRef.current) {
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.history.pushState({ ...window.history.state, sw170BackGuard: true }, "", currentUrl);
      backGuardArmedRef.current = true;
    }

    const popState = (event: PopStateEvent) => {
      if (completingBackRef.current) {
        completingBackRef.current = false;
        return;
      }
      if (!dirtyRef.current || navigationInFlightRef.current || !backGuardArmedRef.current) return;

      event.stopImmediatePropagation();
      navigationInFlightRef.current = true;
      backGuardArmedRef.current = false;

      void (async () => {
        try {
          if (!(await saveRef.current())) {
            const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            window.history.pushState({ ...window.history.state, sw170BackGuard: true }, "", currentUrl);
            backGuardArmedRef.current = true;
            return;
          }
          dirtyRef.current = false;
          completingBackRef.current = true;
          window.history.back();
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
  }, [dirty]);

  return { navigateAfterSave, navigateWithoutSave };
}
