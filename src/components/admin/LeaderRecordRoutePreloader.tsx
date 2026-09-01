import { useEffect } from "react";
import { useLocation } from "react-router-dom";

type RouteFamily = {
  prefix: string;
  preload: () => Promise<unknown>[];
};

const routeFamilies: RouteFamily[] = [
  {
    prefix: "/leader/members",
    preload: () => [import("../../pages/MemberManagement"), import("../../pages/MemberRecordPage")]
  },
  {
    prefix: "/leader/events",
    preload: () => [import("../../pages/EventsManagement"), import("../../pages/EventRecordPage")]
  },
  {
    prefix: "/leader/join",
    preload: () => [import("../../pages/JoinManagement"), import("../../pages/JoinRecordPage")]
  },
  {
    prefix: "/leader/consents",
    preload: () => [import("../../pages/ConsentManagement"), import("../../pages/ConsentRecordPage")]
  }
];

export default function LeaderRecordRoutePreloader() {
  const { pathname } = useLocation();

  useEffect(() => {
    const family = routeFamilies.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`));
    if (!family) return;

    let cancelled = false;
    const preload = () => {
      if (cancelled) return;
      for (const request of family.preload()) void request.catch(() => undefined);
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(preload, { timeout: 500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = globalThis.setTimeout(preload, 0);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timeoutId);
    };
  }, [pathname]);

  return null;
}
