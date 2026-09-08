import Select, { type SelectProps } from "@mui/material/Select";
import { useRef, useState } from "react";

type Placement = {
  top: number;
  left: number;
  transformVertical: "top" | "bottom";
  maxHeight: number;
};

const DEFAULT_PLACEMENT: Placement = {
  top: 0,
  left: 0,
  transformVertical: "top",
  maxHeight: 320
};

/**
 * Site-wide MUI Select wrapper that leaves MUI's native open/close lifecycle
 * intact while keeping transient menus anchored to the visible trigger and
 * preventing focus restoration from moving the underlying page.
 */
export default function StableSelect<Value = unknown>(props: SelectProps<Value>) {
  const { MenuProps, onOpen, onClose, ...selectProps } = props;
  const rootRef = useRef<HTMLElement | null>(null);
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);
  const openScrollPosition = useRef({ x: 0, y: 0 });

  const getTrigger = () => {
    const root = rootRef.current;
    if (!root) return null;
    if (root.getAttribute("role") === "combobox") return root;
    return root.querySelector<HTMLElement>('[role="combobox"]');
  };

  const restoreViewport = () => {
    const { x, y } = openScrollPosition.current;
    window.scrollTo(x, y);
  };

  const handleOpen: NonNullable<SelectProps<Value>["onOpen"]> = (event) => {
    const trigger = getTrigger() ?? (event.currentTarget as HTMLElement | null);
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const viewportMargin = 16;
      const spaceBelow = Math.max(window.innerHeight - rect.bottom - viewportMargin, 0);
      const spaceAbove = Math.max(rect.top - viewportMargin, 0);
      const openAbove = spaceAbove > spaceBelow;
      const availableSpace = openAbove ? spaceAbove : spaceBelow;

      openScrollPosition.current = { x: window.scrollX, y: window.scrollY };
      setPlacement({
        top: openAbove ? rect.top : rect.bottom,
        left: rect.left,
        transformVertical: openAbove ? "bottom" : "top",
        maxHeight: Math.max(Math.min(320, availableSpace), 48)
      });

      requestAnimationFrame(restoreViewport);
    }

    onOpen?.(event);
  };

  const handleClose: NonNullable<SelectProps<Value>["onClose"]> = (event) => {
    onClose?.(event);
    if (event.defaultPrevented) return;

    const trigger = getTrigger();
    const restore = () => {
      restoreViewport();
      trigger?.focus({ preventScroll: true });
      restoreViewport();
    };
    requestAnimationFrame(() => {
      restore();
      requestAnimationFrame(restore);
    });
  };

  const externalPaperSlot = typeof MenuProps?.slotProps?.paper === "function" ? undefined : MenuProps?.slotProps?.paper;

  return (
    <Select
      {...selectProps}
      ref={(node) => { rootRef.current = node as HTMLElement | null; }}
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
          }
        }
      }}
    />
  );
}
