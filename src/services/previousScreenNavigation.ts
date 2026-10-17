import { RECORD_PARENT_ROUTES } from "../navigation/leaderNavigation.ts";
export { RECORD_PARENT_ROUTES } from "../navigation/leaderNavigation.ts";

export function recordParentRoute(pathname: string): string | null {
  return RECORD_PARENT_ROUTES.find(({ prefix }) => pathname.startsWith(prefix))?.parent ?? null;
}

export function hasInAppPreviousScreen(historyState: unknown): boolean {
  if (!historyState || typeof historyState !== "object" || Array.isArray(historyState)) return false;
  const index = (historyState as { idx?: unknown }).idx;
  return typeof index === "number" && Number.isFinite(index) && index > 0;
}

export function isRecordBackControl(target: Element | null, parentRoute: string): boolean {
  // Buttons own workflow behaviour (for example an unsaved-change dialog).
  // Only explicit parent links can safely be replaced with a history POP.
  const control = target?.closest("a");
  if (!control) return false;
  const label = control.textContent?.trim().toLowerCase() ?? "";
  if (!label.startsWith("back to") && !label.startsWith("return to")) return false;

  if (control instanceof HTMLAnchorElement) {
    try {
      const destination = new URL(control.href, window.location.href);
      return destination.origin === window.location.origin && destination.pathname === parentRoute
        && !control.hasAttribute("download") && (!control.target || control.target === "_self");
    } catch {
      return false;
    }
  }

  return false;
}

export function isPlainRecordBackClick(event: Pick<MouseEvent, "defaultPrevented" | "button" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">): boolean {
  return !event.defaultPrevented && event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}
