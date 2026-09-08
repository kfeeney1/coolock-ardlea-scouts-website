import Select, { type SelectProps } from "@mui/material/Select";
import { forwardRef, useEffect, useRef, useState, type ForwardedRef } from "react";

type Placement = { anchorVertical: "top" | "bottom"; transformVertical: "top" | "bottom"; maxHeight: number };
const DEFAULT_PLACEMENT: Placement = { anchorVertical: "bottom", transformVertical: "top", maxHeight: 320 };

/** Keep MUI's native popup lifecycle, changing only its attached placement. */
const StableSelect = forwardRef(function StableSelect<Value = unknown>(
  props: SelectProps<Value>, forwardedRef: ForwardedRef<unknown>
) {
  const { MenuProps, onOpen, onMouseDownCapture, onKeyDownCapture, ...selectProps } = props;
  const rootRef = useRef<HTMLElement | null>(null);
  const openScroll = useRef({ x: 0, y: 0 });
  const closeFromScroll = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);
  const getTrigger = () => {
    const root = rootRef.current;
    if (!root) return null;
    return root.getAttribute("role") === "combobox" ? root : root.querySelector<HTMLElement>('[role="combobox"]');
  };
  const measurePlacement = () => {
    const trigger = getTrigger();
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 16;
    const below = Math.max(window.innerHeight - rect.bottom - margin, 0);
    const above = Math.max(rect.top - margin, 0);
    const openAbove = above > below;
    setPlacement({
      anchorVertical: openAbove ? "top" : "bottom",
      transformVertical: openAbove ? "bottom" : "top",
      maxHeight: Math.max(Math.min(320, openAbove ? above : below), 48)
    });
  };
  const captureOpen = () => {
    openScroll.current = { x: window.scrollX, y: window.scrollY };
    measurePlacement();
  };
  const preserveViewport = () => window.scrollTo(openScroll.current.x, openScroll.current.y);
  const paper = typeof MenuProps?.slotProps?.paper === "function" ? undefined : MenuProps?.slotProps?.paper;

  useEffect(() => {
    if (!menuOpen) return;
    const dismissDetachedMenu = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[role="listbox"]')) return;
      if ((event.target === document || event.target === document.documentElement)
        && window.scrollX === openScroll.current.x && window.scrollY === openScroll.current.y) return;
      closeFromScroll.current = true;
      setMenuOpen(false);
    };
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => window.addEventListener("scroll", dismissDetachedMenu, true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      window.removeEventListener("scroll", dismissDetachedMenu, true);
    };
  }, [menuOpen]);

  return <Select
    {...selectProps}
    open={menuOpen}
    ref={(node) => {
      rootRef.current = node as HTMLElement | null;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    }}
    onMouseDownCapture={(event) => { captureOpen(); onMouseDownCapture?.(event); }}
    onKeyDownCapture={(event) => { captureOpen(); onKeyDownCapture?.(event); }}
    onOpen={(event) => {
      closeFromScroll.current = false;
      preserveViewport();
      setMenuOpen(true);
      onOpen?.(event);
    }}
    onClose={(event) => {
      props.onClose?.(event);
      if (!event.defaultPrevented) {
        setMenuOpen(false);
        if (!closeFromScroll.current) {
          getTrigger()?.focus({ preventScroll: true });
          preserveViewport();
        }
      }
    }}
    MenuProps={{
      ...MenuProps,
      anchorEl: getTrigger,
      anchorOrigin: { vertical: placement.anchorVertical, horizontal: "left" },
      transformOrigin: { vertical: placement.transformVertical, horizontal: "left" },
      marginThreshold: 0,
      disableScrollLock: true,
      disableRestoreFocus: true,
      slotProps: {
        ...MenuProps?.slotProps,
        paper: {
          ...paper,
          sx: [{ maxHeight: `${placement.maxHeight}px` }, ...(Array.isArray(paper?.sx) ? paper.sx : paper?.sx ? [paper.sx] : [])]
        }
      }
    }}
  />;
});

export default StableSelect;
