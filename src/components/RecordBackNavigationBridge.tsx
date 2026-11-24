import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { backDismissStack } from "../services/backDismissHistory";
import {
  hasInAppPreviousScreen,
  isRecordBackControl,
  isPlainRecordBackClick,
  recordParentRoute
} from "../services/previousScreenNavigation";

/**
 * Existing record pages retain their explicit parent links as safe deep-link fallbacks.
 * When a record was reached through in-app navigation, intercept only those semantic
 * Back/Return controls and POP the real browser history so the user returns to the
 * screen they actually saw, including its stored scroll position.
 *
 * The history index alone is not enough to prove that the current app instance observed
 * the previous route (for example after a reload or direct entry). Track route transitions
 * in this mounted bridge and only intercept when both signals agree; otherwise let the
 * record control use its explicit parent destination.
 */
export default function RecordBackNavigationBridge() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPathRef = useRef(location.pathname);
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (currentPathRef.current === location.pathname) return;
    previousPathRef.current = currentPathRef.current;
    currentPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    const parentRoute = recordParentRoute(location.pathname);
    if (!parentRoute) return;

    const handleClick = (event: MouseEvent) => {
      if (!isPlainRecordBackClick(event)) return;
      if (!hasInAppPreviousScreen(window.history.state) || !previousPathRef.current) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!isRecordBackControl(target, parentRoute)) return;
      event.preventDefault();
      event.stopPropagation();
      // The dialog can disappear before its deferred history cleanup runs.
      // Skip its same-route entries as part of this explicit record Back.
      const historyState = window.history.state;
      const markers = backDismissStack(historyState?.usr);
      const overlayEntries = markers.every(marker => marker.startsWith("transient-overlay:"))
        ? Math.min(markers.length, Math.max(0, historyState.idx - 1))
        : 0;
      navigate(-1 - overlayEntries);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [location.pathname, navigate]);

  return null;
}
