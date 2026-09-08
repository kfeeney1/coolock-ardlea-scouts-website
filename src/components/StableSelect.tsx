import Select, { type SelectProps } from "@mui/material/Select";
import { useLayoutEffect, useRef, useState } from "react";

type Placement = {
  anchorVertical: "top" | "bottom";
  transformVertical: "top" | "bottom";
  maxHeight: number;
};

const DEFAULT_PLACEMENT: Placement = {
  anchorVertical: "bottom",
  transformVertical: "top",
  maxHeight: 320
};

/**
 * Site-wide MUI Select wrapper that keeps the popup attached to the visible
 * combobox at viewport edges without letting menu teardown move the page.
 */
export default function StableSelect<Value = unknown>(props: SelectProps<Value>) {
  const { MenuProps, onOpen, onClose, open: controlledOpen, ...selectProps } = props;
  const rootRef = useRef<HTMLElement | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);
  const openScrollPosition = useRef({ x: 0, y: 0 });
  const restoreViewport = useRef(false);
  const isControlled = controlledOpen !== undefined;
  const menuOpen = isControlled ? controlledOpen : internalOpen;

  const getTrigger = () => {
    const root = rootRef.current;
    if (!root) return null;
    if (root.getAttribute("role") === "combobox") return root;
    return root.querySelector<HTMLElement>('[role="combobox"]');
  };

  const restoreViewportPosition = () => {
    if (!restoreViewport.current) return;
    const scrollPosition = openScrollPosition.current;
    window.scrollTo(scrollPosition.x, scrollPosition.y);
    getTrigger()?.focus({ preventScroll: true });
    window.scrollTo(scrollPosition.x, scrollPosition.y);
  };

  useLayoutEffect(() => {
    if (menuOpen || !restoreViewport.current) return;
    restoreViewportPosition();
    const frame = requestAnimationFrame(restoreViewportPosition);
    return () => cancelAnimationFrame(frame);
  }, [menuOpen, selectProps.value]);

  const handleOpen: NonNullable<SelectProps<Value>["onOpen"]> = (event) => {
    onOpen?.(event);
    if (event.defaultPrevented) return;

    const trigger = getTrigger();
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportMargin = 16;
    const spaceBelow = Math.max(window.innerHeight - rect.bottom - viewportMargin, 0);
    const spaceAbove = Math.max(rect.top - viewportMargin, 0);
    const openAbove = spaceAbove > spaceBelow;
    const availableSpace = openAbove ? spaceAbove : spaceBelow;

    openScrollPosition.current = { x: window.scrollX, y: window.scrollY };
    restoreViewport.current = false;
    setPlacement({
      anchorVertical: openAbove ? "top" : "bottom",
      transformVertical: openAbove ? "bottom" : "top",
      maxHeight: Math.max(Math.min(320, availableSpace), 48)
    });
    if (!isControlled) setInternalOpen(true);
  };

  const handleClose: NonNullable<SelectProps<Value>["onClose"]> = (event) => {
    onClose?.(event);
    if (event.defaultPrevented) return;
    restoreViewport.current = true;
    if (!isControlled) setInternalOpen(false);
  };

  const handleMenuExited = () => {
    restoreViewportPosition();
    restoreViewport.current = false;
  };

  const externalPaperSlot = typeof MenuProps?.slotProps?.paper === "function" ? undefined : MenuProps?.slotProps?.paper;
  const externalTransitionSlot = typeof MenuProps?.slotProps?.transition === "function" ? undefined : MenuProps?.slotProps?.transition;

  return (
    <Select
      {...selectProps}
      ref={(node) => { rootRef.current = node as HTMLElement | null; }}
      open={menuOpen}
      onOpen={handleOpen}
      onClose={handleClose}
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
