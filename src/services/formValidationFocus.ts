export const INVALID_FIELD_SELECTOR = '[aria-invalid="true"], [data-validation-invalid="true"]';

function focusableTarget(element: Element): HTMLElement | null {
  if (element instanceof HTMLElement && element.matches('input, textarea, select, button, [tabindex]:not([tabindex="-1"])')) return element;
  return element.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])');
}

export function focusFirstInvalidField(root: ParentNode = document, headerOffset = 88): HTMLElement | null {
  const invalid = Array.from(root.querySelectorAll(INVALID_FIELD_SELECTOR))
    .filter((element): element is HTMLElement => element instanceof HTMLElement && !element.hidden && element.getAttribute("aria-hidden") !== "true")
    .sort((a, b) => {
      if (a === b) return 0;
      const position = a.compareDocumentPosition(b);
      return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    })[0];

  if (!invalid) return null;
  const target = focusableTarget(invalid) ?? invalid;
  const top = invalid.getBoundingClientRect().top + window.scrollY - headerOffset;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  target.focus({ preventScroll: true });
  return target;
}

export function focusFirstInvalidFieldAfterRender(root: ParentNode = document): void {
  requestAnimationFrame(() => requestAnimationFrame(() => focusFirstInvalidField(root)));
}
