import { backDismissStack } from "./backDismissHistory.ts";

/** Run once after the visible select/dialog has released its browser Back entry. */
export function afterTransientOverlayClose(ready: () => void, target: Window = window): () => void {
  let active = true;
  const cancel = () => {
    active = false;
    target.clearTimeout(timer);
    target.removeEventListener("popstate", check);
  };
  const check = () => {
    if (!active || backDismissStack(target.history.state?.usr).some((marker) => marker.startsWith("transient-overlay:"))) return;
    cancel();
    ready();
  };
  // Let the closing surface and its history owner finish this event first.
  const timer = target.setTimeout(check, 0);
  target.addEventListener("popstate", check);
  return cancel;
}
