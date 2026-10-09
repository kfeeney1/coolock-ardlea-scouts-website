import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { backDismissStack, withBackDismissMarker } from "../services/backDismissHistory";

const MARKER_PREFIX = "transient-overlay:";

function visibleSurfaces(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="listbox"]'))
    .filter((element) => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");
}

function dismissSurface(surface: HTMLElement | undefined) {
  if (!surface) return;
  const init: KeyboardEventInit = {
    key: "Escape",
    code: "Escape",
    keyCode: 27,
    which: 27,
    bubbles: true,
    cancelable: true
  };
  surface.dispatchEvent(new KeyboardEvent("keydown", init));
}

function locationStateFromHistoryState(historyState: unknown): unknown {
  if (!historyState || typeof historyState !== "object" || Array.isArray(historyState)) return historyState;
  return (historyState as { usr?: unknown }).usr ?? historyState;
}

/**
 * Mirrors the visible MUI dialog/select stack into same-route browser history.
 * A hardware/browser Back POP therefore closes only the most recently opened
 * transient surface. Normal UI closes consume their matching history entry.
 *
 * POP dismissal is handled directly from the browser popstate event so the user does
 * not have to wait for a React Router render/effect round-trip before the overlay closes.
 */
export default function TransientOverlayBackDismissBridge() {
  const location = useLocation();
  const navigate = useNavigate();
  const [surfaces, setSurfaces] = useState<HTMLElement[]>([]);
  const previousMarkerCount = useRef(0);
  const latestMarkerCount = useRef(0);
  const consumingClose = useRef(false);
  // Serialise UI-driven overlay closes so nested surfaces cannot consume the same history entry.
  const pendingCloseFromMarkerCount = useRef<number | null>(null);
  const pendingCloseTimer = useRef<number | null>(null);
  const routeDeparturePending = useRef(false);
  const currentPath = useRef(location.pathname);
  const previousPath = useRef(location.pathname);
  currentPath.current = location.pathname;
  const managedMarkers = useMemo(
    () => backDismissStack(location.state).filter((marker) => marker.startsWith(MARKER_PREFIX)),
    [location.state]
  );

  useLayoutEffect(() => {
    const refresh = () => setSurfaces(visibleSurfaces());
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "class", "style"]
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const cancelPendingClose = () => {
      if (pendingCloseTimer.current !== null) window.clearTimeout(pendingCloseTimer.current);
      pendingCloseTimer.current = null;
      pendingCloseFromMarkerCount.current = null;
      consumingClose.current = false;
    };
    const handleNavigation = (event: Event) => {
      const destinationUrl = (event as Event & { destination?: { url?: string } }).destination?.url;
      const navigationType = (event as Event & { navigationType?: string }).navigationType;
      if (!destinationUrl && navigationType !== "reload") return;
      try {
        if (navigationType === "reload" || pendingCloseTimer.current !== null || (destinationUrl && new URL(destinationUrl).pathname !== currentPath.current)) {
          routeDeparturePending.current = true;
          cancelPendingClose();
        }
      } catch {
        routeDeparturePending.current = true;
        cancelPendingClose();
      }
    };
    const navigationApi = (window as Window & { navigation?: EventTarget }).navigation;
    navigationApi?.addEventListener("navigate", handleNavigation);
    return () => {
      navigationApi?.removeEventListener("navigate", handleNavigation);
      cancelPendingClose();
    };
  }, []);

  useEffect(() => {
    if (previousPath.current === location.pathname) return;
    previousPath.current = location.pathname;
    routeDeparturePending.current = true;
    if (pendingCloseTimer.current !== null) window.clearTimeout(pendingCloseTimer.current);
    pendingCloseTimer.current = null;
    pendingCloseFromMarkerCount.current = null;
    consumingClose.current = false;
  }, [location.pathname]);

  useLayoutEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const markerCount = backDismissStack(locationStateFromHistoryState(event.state))
        .filter((marker) => marker.startsWith(MARKER_PREFIX)).length;
      const visible = visibleSurfaces();
      const priorMarkerCount = Math.max(previousMarkerCount.current, latestMarkerCount.current);

      // A real browser/hardware Back is also the authoritative signal to dismiss
      // the top transient surface. Do not require React Router's marker state to
      // have committed first: MUI portals can become interactive before that
      // navigation is observable, which is exactly the Stage 20.6 race.
      if (visible.length > 0 && !consumingClose.current) {
        previousMarkerCount.current = markerCount;
        latestMarkerCount.current = markerCount;
        dismissSurface(visibleSurfaces().at(-1));
        return;
      }

      if (markerCount >= priorMarkerCount) return;
      previousMarkerCount.current = markerCount;
      if (consumingClose.current) consumingClose.current = false;
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useLayoutEffect(() => {
    const markerCount = managedMarkers.length;
    const priorMarkerCount = previousMarkerCount.current;

    if (routeDeparturePending.current && surfaces.length <= markerCount) {
      previousMarkerCount.current = markerCount;
      latestMarkerCount.current = markerCount;
      return;
    }
    if (routeDeparturePending.current && surfaces.length > markerCount) routeDeparturePending.current = false;

    if (pendingCloseFromMarkerCount.current !== null) {
      if (markerCount >= pendingCloseFromMarkerCount.current) {
        // If another surface opens before the close marker is consumed, let the
        // existing marker cover it instead of dismissing the newly opened surface.
        if (surfaces.length > markerCount && pendingCloseTimer.current !== null) {
          window.clearTimeout(pendingCloseTimer.current);
          pendingCloseTimer.current = null;
          pendingCloseFromMarkerCount.current = null;
          consumingClose.current = false;
        } else {
          return;
        }
      }
      pendingCloseFromMarkerCount.current = null;
    }

    if (markerCount < priorMarkerCount) {
      previousMarkerCount.current = markerCount;
      if (consumingClose.current) {
        consumingClose.current = false;
      }
      return;
    }

    previousMarkerCount.current = markerCount;
    latestMarkerCount.current = markerCount;

    if (surfaces.length > markerCount) {
      latestMarkerCount.current = surfaces.length;
      const marker = `${MARKER_PREFIX}${markerCount + 1}`;
      navigate(`${location.pathname}${location.search}${location.hash}`, {
        state: withBackDismissMarker(location.state, marker)
      });
      return;
    }

    if (surfaces.length < markerCount) {
      pendingCloseFromMarkerCount.current = markerCount;
      consumingClose.current = true;
      if (pendingCloseTimer.current !== null) window.clearTimeout(pendingCloseTimer.current);
      pendingCloseTimer.current = window.setTimeout(() => {
        pendingCloseTimer.current = null;
        if (routeDeparturePending.current) {
          pendingCloseFromMarkerCount.current = null;
          consumingClose.current = false;
          return;
        }
        navigate(-1);
      }, 500);
    }
  }, [location.hash, location.pathname, location.search, location.state, managedMarkers, navigate, surfaces]);

  return null;
}
