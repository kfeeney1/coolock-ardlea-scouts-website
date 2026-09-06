import { useEffect, useId, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  hasBackDismissMarker,
  isTopBackDismissMarker,
  withBackDismissMarker
} from "../services/backDismissHistory";

/**
 * Gives transient UI (menus, dialogs, drawers and similar overlays) one browser-history
 * entry on the current route. Browser/system Back therefore dismisses the most recently
 * opened UI before it can leave the screen. Closing through the UI consumes that same
 * history entry so the route history remains clean.
 */
export function useBackDismiss(open: boolean, onDismiss: () => void, name: string) {
  const location = useLocation();
  const navigate = useNavigate();
  const reactId = useId();
  const markerRef = useRef(`${name}:${reactId}`);
  const armedRef = useRef(false);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    const marker = markerRef.current;
    const state = location.state;
    const markerPresent = hasBackDismissMarker(state, marker);

    if (open) {
      if (armedRef.current && !markerPresent) {
        armedRef.current = false;
        dismissRef.current();
        return;
      }

      if (!armedRef.current && !markerPresent) {
        armedRef.current = true;
        navigate(`${location.pathname}${location.search}${location.hash}`, {
          state: withBackDismissMarker(state, marker)
        });
        return;
      }

      armedRef.current = true;
      return;
    }

    if (!armedRef.current) return;
    armedRef.current = false;

    if (isTopBackDismissMarker(state, marker)) {
      navigate(-1);
    }
  }, [location.hash, location.pathname, location.search, location.state, navigate, open]);
}
