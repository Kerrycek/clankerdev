import { useEffect, useState } from 'react';

type IdleCapableWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function useDeferredOverviewQueries(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (enabled) return undefined;
    if (typeof window === 'undefined') {
      setEnabled(true);
      return undefined;
    }

    const win = window as IdleCapableWindow;
    let idleHandle: number | undefined;
    let timerHandle: number | undefined;

    const enable = () => setEnabled(true);
    if (win.requestIdleCallback) idleHandle = win.requestIdleCallback(enable, { timeout: 1000 });
    else timerHandle = window.setTimeout(enable, 120);

    return () => {
      if (idleHandle !== undefined) win.cancelIdleCallback?.(idleHandle);
      if (timerHandle !== undefined) window.clearTimeout(timerHandle);
    };
  }, [enabled]);

  return enabled;
}
