import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";

import { backDismissStack, withBackDismissMarker } from "../services/backDismissHistory";

const MARKER_PREFIX = "transient-overlay:";

function visibleSurfaces(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="listbox"]'))
    .filter((element) => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");
}

function dismissSurface(surface: HTMLElement | undefined) {
  if (!surface) return;
  // Native Escape is the normal MUI close path. Dispatch it from the focused
  // popup first (matching a real keyboard event), then fall back to document.
  const init: KeyboardEventInit = {
    key: "Escape",
    code: "Escape",
    keyCode: 27,
    which: 27,
    bubbles: true,
    cancelable: true
  };
  surface.dispatchEvent(new KeyboardEvent("keydown", init));
  if (surface.getClientRects().length > 0) document.dispatchEvent(new KeyboardEvent("keydown", init));
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
  const managedMarkers = useMemo(
    () => backDismissStack(location.state).filter((marker) => marker.startsWith(MARKER_PREFIX)),
    [location.state]
  );

  useLayoutEffect(() => {
    const refresh = () => {
      const next = visibleSurfaces();
      // Arm the same-route history entry synchronously with the portal mutation.
      // This prevents Playwright/hardware Back from racing a deferred React state
      // update between MUI painting the listbox and this bridge pushing its marker.
      flushSync(() => setSurfaces(next));
    };
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

  useLayoutEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const markerCount = backDismissStack(locationStateFromHistoryState(event.state))
        .filter((marker) => marker.startsWith(MARKER_PREFIX)).length;
      const priorMarkerCount = Math.max(previousMarkerCount.current, latestMarkerCount.current);
      if (markerCount >= priorMarkerCount) return;

      previousMarkerCount.current = markerCount;
      if (consumingClose.current) {
        consumingClose.current = false;
        return;
      }

      dismissSurface(visibleSurfaces().at(-1));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useLayoutEffect(() => {
    const markerCount = managedMarkers.length;
    const priorMarkerCount = previousMarkerCount.current;

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
      consumingClose.current = true;
      navigate(-1);
    }
  }, [location.hash, location.pathname, location.search, location.state, managedMarkers, navigate, surfaces]);

  return null;
}
