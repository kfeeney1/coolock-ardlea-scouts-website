import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";


type SaveDraft = () => Promise<boolean>;

/** Saves a valid dirty editor before explicit navigation or browser Back leaves it. */
export function useSaveOnNavigation(dirty: boolean, saveDraft: SaveDraft, backgroundSave?: SaveDraft) {
  const navigate = useNavigate();
  const hasBackgroundSave = Boolean(backgroundSave);
  const dirtyRef = useRef(dirty);
  const saveRef = useRef(saveDraft);
  const backgroundSaveRef = useRef(backgroundSave);
  const navigationInFlightRef = useRef(false);

  dirtyRef.current = dirty;
  saveRef.current = saveDraft;
  backgroundSaveRef.current = backgroundSave;

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
    // Call the latest callback without restarting this effect on every render.
    // Callers commonly pass an inline function; depending on it here causes each
    // keystroke to queue another full background save while the editor is dirty.
    const timer=backgroundSave?window.setTimeout(()=>{if(dirtyRef.current&&!navigationInFlightRef.current)void backgroundSaveRef.current?.();},0):undefined;
    window.addEventListener("beforeunload",beforeUnload);
    return()=>{if(timer!==undefined)window.clearTimeout(timer);window.removeEventListener("beforeunload",beforeUnload);};
  },[hasBackgroundSave,dirty]);

  return { navigateAfterSave, navigateWithoutSave };
}
