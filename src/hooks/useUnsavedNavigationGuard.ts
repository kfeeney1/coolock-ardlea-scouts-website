import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export type UnsavedDestination = { kind: "path"; path: string } | { kind: "back" };

export function useUnsavedNavigationGuard(dirty: boolean) {
  const location = useLocation();
  const navigate = useNavigate();
  const dirtyRef = useRef(dirty);
  const [destination, setDestination] = useState<UnsavedDestination | null>(null);
  const destinationRef = useRef<UnsavedDestination | null>(null);
  dirtyRef.current = dirty;

  const ask = useCallback((next: UnsavedDestination) => {
    if (!dirtyRef.current) {
      if (next.kind === "path") navigate(next.path);
      else navigate(-1);
      return;
    }
    destinationRef.current = next;
    setDestination(next);
  }, [navigate]);

  const stay = useCallback(() => {
    destinationRef.current = null;
    setDestination(null);
  }, []);

  const navigateTo = useCallback((path: string) => navigate(path), [navigate]);

  const continueNavigation = useCallback(() => {
    const next = destinationRef.current;
    destinationRef.current = null;
    setDestination(null);
    if (!next) return;
    if (next.kind === "path") navigate(next.path);
    else navigate(-1);
  }, [navigate]);

  useEffect(() => {
    if (!dirty) return;
    const currentUrl = `${location.pathname}${location.search}${location.hash}`;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const popState = () => {
      if (!dirtyRef.current) return;
      // The browser Back action has already moved history. Restore the editor
      // route, then ask whether the user wants to discard/save the dirty draft.
      window.history.forward();
      destinationRef.current = { kind: "back" };
      setDestination({ kind: "back" });
    };
    const captureLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const path = `${url.pathname}${url.search}${url.hash}`;
      if (path === currentUrl) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      destinationRef.current = { kind: "path", path };
      setDestination({ kind: "path", path });
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", popState);
    document.addEventListener("click", captureLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", popState);
      document.removeEventListener("click", captureLink, true);
    };
  }, [dirty, location.hash, location.pathname, location.search]);

  return { destination, ask, stay, continueNavigation, navigateTo };
}
