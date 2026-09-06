import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  hasInAppPreviousScreen,
  isRecordBackControl,
  recordParentRoute
} from "../services/previousScreenNavigation";

/**
 * Existing record pages retain their explicit parent links as safe deep-link fallbacks.
 * When a record was reached through in-app navigation, intercept only those semantic
 * Back/Return controls and POP the real browser history so the user returns to the
 * screen they actually saw, including its stored scroll position.
 */
export default function RecordBackNavigationBridge() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const parentRoute = recordParentRoute(location.pathname);
    if (!parentRoute) return;

    const handleClick = (event: MouseEvent) => {
      if (!hasInAppPreviousScreen(window.history.state)) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!isRecordBackControl(target, parentRoute)) return;
      event.preventDefault();
      event.stopPropagation();
      navigate(-1);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [location.pathname, navigate]);

  return null;
}
