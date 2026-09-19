import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

import { MAIN_CONTENT_ID } from './MainContentAccessibility';

/**
 * Restores a predictable document starting point after client-side route
 * changes. It lives above every layout so transitions between the public and
 * authenticated shells are handled as well as changes within either shell.
 */
export function RouteFocusManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousPathnameRef = useRef(location.pathname);

  useLayoutEffect(() => {
    if (previousPathnameRef.current === location.pathname) return undefined;
    previousPathnameRef.current = location.pathname;

    // Do not override destination fragment navigation with the main target.
    if (location.hash) return undefined;

    if (navigationType !== 'POP') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(MAIN_CONTENT_ID)?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, location.pathname]);

  return null;
}
