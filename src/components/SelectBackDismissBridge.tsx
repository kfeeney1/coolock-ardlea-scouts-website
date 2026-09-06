import { useEffect, useState } from "react";

import { useBackDismiss } from "../hooks/useBackDismiss";

function visibleListboxes(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="listbox"]'))
    .filter((element) => element.getClientRects().length > 0 && element.getAttribute("aria-hidden") !== "true");
}

export default function SelectBackDismissBridge() {
  const [listbox, setListbox] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const refresh = () => {
      const visible = visibleListboxes();
      setListbox(visible.at(-1) ?? null);
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "class", "style"]
    });
    return () => observer.disconnect();
  }, []);

  useBackDismiss(Boolean(listbox), () => {
    if (!listbox) return;
    listbox.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      bubbles: true,
      cancelable: true
    }));
  }, "mui-select-listbox");

  return null;
}
