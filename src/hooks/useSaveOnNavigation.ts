import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { backDismissStack } from "../services/backDismissHistory";

type SaveDraft = () => Promise<boolean>;

/** Saves a valid dirty editor before explicit navigation or browser Back leaves it. */
export function useSaveOnNavigation(dirty: boolean, saveDraft: SaveDraft) {
  const navigate = useNavigate();
  const location = useLocation();
  const dirtyRef = useRef(dirty);
  const saveRef = useRef(saveDraft);
  const navigationInFlightRef = useRef(false);
  const backCompletedRef = useRef(false);

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
    if (!dirty) { backCompletedRef.current=false; return; }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const marker="sw170SaveGuard";
    const state=location.state&&typeof location.state==="object"?location.state:{};
    if (!backCompletedRef.current&&!(state as Record<string,unknown>)[marker]) navigate(location.pathname+location.search+location.hash,{state:{...state,[marker]:true}});
    const popState=()=>{
      if(!dirtyRef.current||navigationInFlightRef.current||backDismissStack(history.state?.usr).length)return;
      navigationInFlightRef.current=true;
      void saveRef.current().then(saved=>{if(saved){dirtyRef.current=false;backCompletedRef.current=true;window.setTimeout(()=>navigate(-1),0);}}).finally(()=>{navigationInFlightRef.current=false;});
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate",popState);
    return () => {window.removeEventListener("beforeunload", beforeUnload);window.removeEventListener("popstate",popState);};
  }, [dirty,location,navigate]);

  return { navigateAfterSave, navigateWithoutSave };
}
