export type UiTargetOptions = {
  focus?: boolean;
  block?: ScrollLogicalPosition;
};

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function moveToUiTarget(targetId: string, options: UiTargetOptions = {}): boolean {
  if (typeof document === "undefined") return false;
  const target = document.getElementById(targetId);
  if (!target) return false;

  target.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: options.block ?? "start"
  });

  if (options.focus) {
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }

  return true;
}

export function moveToUiTargetAfterRender(targetId: string, options: UiTargetOptions = {}): void {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      moveToUiTarget(targetId, options);
    });
  });
}
