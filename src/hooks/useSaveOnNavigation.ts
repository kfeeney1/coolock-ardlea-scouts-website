import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";


type SaveDraft = () => Promise<boolean>;

/** Saves a valid dirty editor before explicit navigation or browser Back leaves it. */
export function useSaveOnNavigation(dirty: boolean, saveDraft: SaveDraft) {
  const navigate = useNavigate();
  const dirtyRef = useRef(dirty);
  const saveRef = useRef(saveDraft);
  const navigationInFlightRef = useRef(false);

  dirtyRef.current = dirty;
  saveRef.current = saveDraft;

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
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(!dirtyRef.current)return;event.preventDefault();event.returnValue="";};
    const pageHide=()=>{if(dirtyRef.current&&!navigationInFlightRef.current)void saveRef.current();};
    window.addEventListener("beforeunload",beforeUnload);
    window.addEventListener("pagehide",pageHide);
    return()=>{window.removeEventListener("beforeunload",beforeUnload);window.removeEventListener("pagehide",pageHide);};
  },[dirty,saveDraft]);

  return { navigateAfterSave, navigateWithoutSave };
}
