export const RECORD_PARENT_ROUTES = [
  { prefix: "/leader/members/", parent: "/leader/members" },
  { prefix: "/leader/events/", parent: "/leader/events" },
  { prefix: "/leader/join/", parent: "/leader/join" },
  { prefix: "/leader/consents/", parent: "/leader/consents" }
] as const;

export function recordParentRoute(pathname: string): string | null {
  return RECORD_PARENT_ROUTES.find(({ prefix }) => pathname.startsWith(prefix))?.parent ?? null;
}

export function hasInAppPreviousScreen(historyState: unknown): boolean {
  if (!historyState || typeof historyState !== "object" || Array.isArray(historyState)) return false;
  const index = (historyState as { idx?: unknown }).idx;
  return typeof index === "number" && Number.isFinite(index) && index > 0;
}

export function isRecordBackControl(target: Element | null, parentRoute: string): boolean {
  const control = target?.closest("a,button");
  if (!control) return false;
  const label = control.textContent?.trim().toLowerCase() ?? "";
  if (!label.startsWith("back to") && !label.startsWith("return to")) return false;

  if (control instanceof HTMLAnchorElement) {
    try {
      return new URL(control.href, window.location.href).pathname === parentRoute;
    } catch {
      return false;
    }
  }

  return true;
}
