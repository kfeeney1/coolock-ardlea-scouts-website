import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { moveToUiTargetAfterRender } from "../services/uiTargeting";

export default function RouteScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const targetId = decodeURIComponent(hash.slice(1));
      if (targetId) moveToUiTargetAfterRender(targetId);
      return;
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);

  return null;
}
