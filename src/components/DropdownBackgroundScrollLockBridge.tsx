import { useEffect } from "react";

const OPEN_POPUP_SELECTOR = '[role="listbox"], [role="menu"]';
const POPUP_SURFACE_SELECTOR = '.MuiMenu-paper, .MuiAutocomplete-paper, [role="listbox"], [role="menu"]';

function isVisible(element: Element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.getAttribute("aria-hidden") === "true") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden";
}

function openPopup() {
  return [...document.querySelectorAll(OPEN_POPUP_SELECTOR)].find(isVisible) ?? null;
}

/**
 * MUI Select/TextField-select/Autocomplete popups are rendered in a portal.
 * Keep touch/wheel input from scrolling the page behind any open dropdown,
 * while still allowing the popup itself to scroll normally.
 */
export default function DropdownBackgroundScrollLockBridge() {
  useEffect(() => {
    const preventBackgroundScroll = (event: Event) => {
      const popup = openPopup();
      if (!popup) return;
      if (event.target instanceof Element && event.target.closest(POPUP_SURFACE_SELECTOR)) return;
      event.preventDefault();
    };

    document.addEventListener("wheel", preventBackgroundScroll, { capture: true, passive: false });
    document.addEventListener("touchmove", preventBackgroundScroll, { capture: true, passive: false });

    return () => {
      document.removeEventListener("wheel", preventBackgroundScroll, true);
      document.removeEventListener("touchmove", preventBackgroundScroll, true);
    };
  }, []);

  return null;
}
