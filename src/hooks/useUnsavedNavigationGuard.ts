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
    else {
      // While dirty, one same-route history entry is installed as a Back guard.
      // Skip both that guard and the editor entry to honour the user's Back action.
      window.history.go(-2);
    }
  }, [navigate]);

  useEffect(() => {
    if (!dirty) return;
    const currentUrl = `${location.pathname}${location.search}${location.hash}`;
    const marker = { ...(window.history.state ?? {}), unsavedEditorGuard: true };
    window.history.pushState(marker, "", currentUrl);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const popState = () => {
      if (!dirtyRef.current) return;
      // Restore the same editor URL before React Router can leave it.
      window.history.pushState(marker, "", currentUrl);
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
