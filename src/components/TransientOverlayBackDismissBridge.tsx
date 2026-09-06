import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { backDismissStack, withBackDismissMarker } from "../services/backDismissHistory";

const MARKER_PREFIX = "transient-overlay:";

function visibleSurfaces(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [role="listbox"]'))
    .filter((element) => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");
}

function dismissSurface(surface: HTMLElement | undefined) {
  if (!surface) return;
  surface.dispatchEvent(new KeyboardEvent("keydown", {
    key: "Escape",
    code: "Escape",
    bubbles: true,
    cancelable: true
  }));
}

/**
 * Mirrors the visible MUI dialog/select stack into same-route browser history.
 * A hardware/browser Back POP therefore closes only the most recently opened
 * transient surface. Normal UI closes consume their matching history entry.
 */
export default function TransientOverlayBackDismissBridge() {
  const location = useLocation();
  const navigate = useNavigate();
  const [surfaces, setSurfaces] = useState<HTMLElement[]>([]);
  const previousMarkerCount = useRef(0);
  const consumingClose = useRef(false);
  const managedMarkers = useMemo(
    () => backDismissStack(location.state).filter((marker) => marker.startsWith(MARKER_PREFIX)),
    [location.state]
  );

  useEffect(() => {
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
    const markerCount = managedMarkers.length;
    const priorMarkerCount = previousMarkerCount.current;

    if (markerCount < priorMarkerCount) {
      previousMarkerCount.current = markerCount;
      if (consumingClose.current) {
        consumingClose.current = false;
        return;
      }
      dismissSurface(surfaces.at(-1));
      return;
    }

    previousMarkerCount.current = markerCount;

    if (surfaces.length > markerCount) {
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
