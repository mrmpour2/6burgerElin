import { useEffect, type RefObject } from "react";

/** Keep keyboard focus in the active modal and restore its trigger on close. */
export function useModalFocus<T extends HTMLElement>(
  panel: RefObject<T | null>,
  open: boolean,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => panel.current?.focus());
    function focusable() {
      return Array.from(panel.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => element.tabIndex >= 0 && !element.closest('[inert],[hidden]') && element.getClientRects().length > 0);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!first) { event.preventDefault(); panel.current?.focus(); return; }
      if (event.shiftKey && (active === first || active === panel.current || !panel.current?.contains(active))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (active === last || !panel.current?.contains(active))) {
        event.preventDefault(); first.focus();
      }
    }
    function onFocus(event: FocusEvent) {
      if (event.target instanceof Node && !panel.current?.contains(event.target)) panel.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocus);
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [panel, open, close]);
}
