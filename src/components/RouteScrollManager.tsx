import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

import { moveToUiTargetAfterRender } from "../services/uiTargeting";

type ScrollPosition = { left: number; top: number };

const routeScrollPositions = new Map<string, ScrollPosition>();
const RECORD_ROUTE_PARENTS = [
  "/leader/members",
  "/leader/events",
  "/leader/join",
  "/leader/consents"
] as const;

function routeKey(pathname: string, search: string) {
  return `${pathname}${search}`;
}

function recordParent(pathname: string): string | null {
  return RECORD_ROUTE_PARENTS.find((parent) => pathname.startsWith(`${parent}/`)) ?? null;
}

export default function RouteScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousPathname = useRef(location.pathname);

  useLayoutEffect(() => {
    const { pathname, search, hash } = location;
    const key = routeKey(pathname, search);
    const previous = previousPathname.current;
    const returningToRecordList = recordParent(previous) === pathname;

    if (hash) {
      const targetId = decodeURIComponent(hash.slice(1));
      if (targetId) moveToUiTargetAfterRender(targetId);
    } else {
      const saved = routeScrollPositions.get(key);
      if (saved && (navigationType === "POP" || returningToRecordList)) {
        window.scrollTo({ top: saved.top, left: saved.left, behavior: "auto" });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    }

    previousPathname.current = pathname;

    return () => {
      routeScrollPositions.set(key, { top: window.scrollY, left: window.scrollX });
    };
  }, [location, navigationType]);

  useLayoutEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  return null;
}
