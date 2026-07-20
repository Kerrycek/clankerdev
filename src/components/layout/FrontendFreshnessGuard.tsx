import { useEffect } from 'react';

import { currentModuleScriptUrl, frontendBundleChanged } from '../../lib/frontendFreshness';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function FrontendFreshnessGuard() {
  useEffect(() => {
    if (import.meta.env.DEV) return;

    let disposed = false;
    let checking = false;

    const check = async () => {
      if (checking || disposed) return;
      checking = true;

      try {
        const changed = await frontendBundleChanged({
          currentScriptUrl: currentModuleScriptUrl(document),
          indexUrl: new URL(import.meta.env.BASE_URL || '/', window.location.origin).href,
        });

        if (changed && !disposed) window.location.reload();
      } catch {
        // A failed version check must not interrupt the application.
      } finally {
        checking = false;
      }
    };

    const onFocus = () => void check();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void check();
    };

    void check();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const interval = window.setInterval(() => void check(), CHECK_INTERVAL_MS);

    return () => {
      disposed = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
