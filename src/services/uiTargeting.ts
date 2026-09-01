export type UiTargetOptions = {
  focus?: boolean;
  block?: ScrollLogicalPosition;
};

const TARGET_GAP_PX = 16;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function stickyHeaderOffset(): number {
  if (typeof document === "undefined") return 0;
  const header = document.querySelector<HTMLElement>("[data-site-sticky-header]");
  return header ? Math.ceil(header.getBoundingClientRect().height) + TARGET_GAP_PX : 0;
}

export function moveToUiTarget(targetId: string, options: UiTargetOptions = {}): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  const target = document.getElementById(targetId);
  if (!target) return false;

  const block = options.block ?? "start";
  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";

  if (block === "start") {
    const absoluteTop = target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: Math.max(0, absoluteTop - stickyHeaderOffset()),
      behavior
    });
  } else {
    target.scrollIntoView({ behavior, block });
  }

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
