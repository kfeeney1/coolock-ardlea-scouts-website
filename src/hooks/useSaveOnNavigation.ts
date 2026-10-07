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

    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", popState, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", popState, true);
    };
  }, [dirty, location.hash, location.pathname, location.search, navigateAfterSave]);

  return { navigateAfterSave, navigateWithoutSave };
}
