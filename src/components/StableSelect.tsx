import Select, { type SelectProps } from "@mui/material/Select";
import { useLayoutEffect, useRef, useState } from "react";

type Placement = {
  top: number;
  left: number;
  transformVertical: "top" | "bottom";
  maxHeight: number;
};

type OpenSnapshot = {
  placement: Placement;
  scrollX: number;
  scrollY: number;
};

const DEFAULT_PLACEMENT: Placement = {
  top: 0,
  left: 0,
  transformVertical: "top",
  maxHeight: 320
};

/**
 * Site-wide MUI Select wrapper that keeps the native Select API while making
 * the menu lifecycle explicit. Capturing the viewport before opening and
 * restoring it through the menu exit prevents MUI focus/transition work from
 * moving the underlying page.
 */
export default function StableSelect<Value = unknown>(props: SelectProps<Value>) {
  const {
    MenuProps,
    onOpen,
    onClose,
    onMouseDownCapture,
    onKeyDownCapture,
    open: controlledOpen,
    ...selectProps
  } = props;
  const rootRef = useRef<HTMLElement | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);
  const openSnapshot = useRef<OpenSnapshot | null>(null);
  const restoreAfterClose = useRef(false);
  const isControlled = controlledOpen !== undefined;
  const menuOpen = isControlled ? controlledOpen : internalOpen;

  const getTrigger = () => {
    const root = rootRef.current;
    if (!root) return null;
    if (root.getAttribute("role") === "combobox") return root;
    return root.querySelector<HTMLElement>('[role="combobox"]');
  };

  const snapshotOpenState = () => {
    const trigger = getTrigger();
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportMargin = 16;
    const spaceBelow = Math.max(window.innerHeight - rect.bottom - viewportMargin, 0);
    const spaceAbove = Math.max(rect.top - viewportMargin, 0);
    const openAbove = spaceAbove > spaceBelow;
    const availableSpace = openAbove ? spaceAbove : spaceBelow;

    const snapshot: OpenSnapshot = {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      placement: {
        top: openAbove ? rect.top : rect.bottom,
        left: rect.left,
        transformVertical: openAbove ? "bottom" : "top",
        maxHeight: Math.max(Math.min(320, availableSpace), 48)
      }
    };
    openSnapshot.current = snapshot;
    setPlacement(snapshot.placement);
  };

  const restoreViewport = () => {
    const snapshot = openSnapshot.current;
    if (!snapshot) return;
    window.scrollTo(snapshot.scrollX, snapshot.scrollY);
  };

  const restoreViewportAndFocus = () => {
    restoreViewport();
    getTrigger()?.focus({ preventScroll: true });
    restoreViewport();
  };

  useLayoutEffect(() => {
    if (menuOpen || !restoreAfterClose.current) return;
    restoreViewportAndFocus();
    const frame = requestAnimationFrame(restoreViewportAndFocus);
    return () => cancelAnimationFrame(frame);
  }, [menuOpen]);

  const handleMouseDownCapture: NonNullable<SelectProps<Value>["onMouseDownCapture"]> = (event) => {
    snapshotOpenState();
    onMouseDownCapture?.(event);
  };

  const handleKeyDownCapture: NonNullable<SelectProps<Value>["onKeyDownCapture"]> = (event) => {
    snapshotOpenState();
    onKeyDownCapture?.(event);
  };

  const handleOpen: NonNullable<SelectProps<Value>["onOpen"]> = (event) => {
    if (!openSnapshot.current) snapshotOpenState();
    restoreAfterClose.current = false;
    if (!isControlled) setInternalOpen(true);
    restoreViewport();
    requestAnimationFrame(restoreViewport);
    onOpen?.(event);
  };

  const handleClose: NonNullable<SelectProps<Value>["onClose"]> = (event) => {
    onClose?.(event);
    if (event.defaultPrevented) return;

    restoreAfterClose.current = true;
    if (!isControlled) setInternalOpen(false);
  };

  const handleMenuExited = () => {
    if (!restoreAfterClose.current) return;
    restoreViewportAndFocus();
    restoreAfterClose.current = false;
    openSnapshot.current = null;
  };

  const externalPaperSlot = typeof MenuProps?.slotProps?.paper === "function" ? undefined : MenuProps?.slotProps?.paper;
  const externalTransitionSlot = typeof MenuProps?.slotProps?.transition === "function" ? undefined : MenuProps?.slotProps?.transition;

  return (
    <Select
      {...selectProps}
      ref={(node) => { rootRef.current = node as HTMLElement | null; }}
      open={menuOpen}
      onMouseDownCapture={handleMouseDownCapture}
      onKeyDownCapture={handleKeyDownCapture}
      onOpen={handleOpen}
      onClose={handleClose}
      MenuProps={{
        ...MenuProps,
        anchorReference: "anchorPosition",
        anchorPosition: { top: placement.top, left: placement.left },
        transformOrigin: { vertical: placement.transformVertical, horizontal: "left" },
        marginThreshold: 0,
        disableScrollLock: true,
        disableRestoreFocus: true,
        disableAutoFocusItem: true,
        slotProps: {
          ...MenuProps?.slotProps,
          paper: {
            ...externalPaperSlot,
            sx: [
              { maxHeight: `${placement.maxHeight}px` },
              ...(
                Array.isArray(externalPaperSlot?.sx)
                  ? externalPaperSlot.sx
                  : externalPaperSlot?.sx
                    ? [externalPaperSlot.sx]
                    : []
              )
            ]
          },
          transition: {
            ...externalTransitionSlot,
            onExited: (...args) => {
              externalTransitionSlot?.onExited?.(...args);
              handleMenuExited();
            }
          }
        }
      }}
    />
  );
}
