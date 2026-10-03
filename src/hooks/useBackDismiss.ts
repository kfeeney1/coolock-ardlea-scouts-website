import { useId, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  hasBackDismissMarker,
  isTopBackDismissMarker,
  shouldDismissForMissingBackMarker,
  withBackDismissMarker
} from "../services/backDismissHistory";

/**
 * Gives transient UI (menus, dialogs, drawers and similar overlays) one browser-history
 * entry on the current route. Browser/system Back therefore dismisses the most recently
 * opened UI before it can leave the screen. Closing through the UI consumes that same
 * history entry so the route history remains clean.
 *
 * This is intentionally a layout effect: the history marker must be armed before the
 * newly opened surface is painted so a fast hardware Back press cannot beat the marker.
 * Callers that expose immediately actionable controls can use the returned readiness flag
 * to avoid rendering those controls until the marker navigation has committed.
 */
export function useBackDismiss(open: boolean, onDismiss: () => void, name: string) {
  const location = useLocation();
  const navigate = useNavigate();
  const reactId = useId();
  const markerRef = useRef(`${name}:${reactId}`);
  const armedRef = useRef(false);
  const markerWasCommittedRef = useRef(false);
  const openingLocationRef = useRef("");
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const markerPresent = hasBackDismissMarker(location.state, markerRef.current);

  useLayoutEffect(() => {
    const marker = markerRef.current;
    const state = location.state;
    const currentMarkerPresent = hasBackDismissMarker(state, marker);
    const currentLocation = `${location.pathname}${location.search}${location.hash}`;

    if (open) {
      if (currentMarkerPresent) {
        armedRef.current = true;
        markerWasCommittedRef.current = true;
        openingLocationRef.current = "";
        return;
      }

      if (armedRef.current) {
        if (shouldDismissForMissingBackMarker(markerWasCommittedRef.current, openingLocationRef.current, currentLocation)) {
          armedRef.current = false;
          markerWasCommittedRef.current = false;
          openingLocationRef.current = "";
          dismissRef.current();
        }
        return;
      }

      if (!currentMarkerPresent) {
        armedRef.current = true;
        markerWasCommittedRef.current = false;
        openingLocationRef.current = currentLocation;
        navigate(`${location.pathname}${location.search}${location.hash}`, {
          state: withBackDismissMarker(state, marker)
        });
        return;
      }
      return;
    }

    if (!armedRef.current) return;
    armedRef.current = false;
    markerWasCommittedRef.current = false;
    openingLocationRef.current = "";

    if (isTopBackDismissMarker(state, marker)) {
      navigate(-1);
    }
  }, [location.hash, location.pathname, location.search, location.state, navigate, open]);

  return !open || markerPresent;
}
