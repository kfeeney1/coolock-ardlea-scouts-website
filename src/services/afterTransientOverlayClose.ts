import { backDismissStack } from "./backDismissHistory.ts";

/** Run once after the visible select/dialog has released its browser Back entry. */
export function afterTransientOverlayClose(ready: (routeState: unknown) => void, target: Window = window): () => void {
  let active = true;
  const cancel = () => {
    active = false;
    target.clearTimeout(timer);
    target.removeEventListener("popstate", check);
  };
  const check = () => {
    const routeState: unknown = target.history.state?.usr;
    if (!active || backDismissStack(routeState).some((marker) => marker.startsWith("transient-overlay:"))) return;
    cancel();
    // A null state after POP is authoritative; an older React location can
    // still contain the just-consumed marker and must never restore it.
    ready(routeState);
  };
  // Let the closing surface and its history owner finish this event first.
  const timer = target.setTimeout(check, 0);
  target.addEventListener("popstate", check);
  return cancel;
}
