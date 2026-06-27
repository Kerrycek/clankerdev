import { useEffect, useId, useRef } from 'react';

import { focusActiveTrap, registerFocusTrap } from '../focusTrapStack';

/**
 * Enables focus trap for the given container element when `open`.
 *
 * This uses a shared stack so nested dialogs work (Modal inside Drawer, etc.).
 */
export function useFocusTrap(open: boolean, container: HTMLElement | null) {
  const trapId = useId();
  const prevFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!container) return;

    // Remember the element that had focus before the dialog mounted.
    const prev = document.activeElement;
    prevFocusedRef.current = prev instanceof HTMLElement ? prev : null;

    const unregister = registerFocusTrap({ id: trapId, container });

    // Focus the first focusable element in the active trap.
    // We defer to the next frame so the portal content settles.
    const raf = window.requestAnimationFrame(() => {
      focusActiveTrap();
    });

    return () => {
      window.cancelAnimationFrame(raf);
      unregister();

      const el = prevFocusedRef.current;
      if (el && document.contains(el)) {
        try {
          (el as LegacyAny).focus?.({ preventScroll: true });
        } catch {
          try {
            el.focus();
          } catch {
            // ignore
          }
        }
      }
    };
  }, [open, container, trapId]);
}
