import React, { useEffect, useMemo, useRef } from 'react';

import { getRuntimeConfig } from '../../app/config';
import { fetchCurrentUser } from '../../lib/api/users';
import { useNetworkStatus } from '../../lib/useNetworkStatus';

function parseSessionLengthMs(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return undefined;

  // Heuristic:
  // - smaller numbers are likely minutes (e.g. 30 for 30 minutes)
  // - larger numbers are likely seconds (e.g. 3600 for 1 hour)
  const asNumber = Math.round(raw);

  if (asNumber <= 180) {
    // up to 3 hours in minutes
    return asNumber * 60_000;
  }

  // Otherwise treat as seconds.
  return asNumber * 1000;
}

export function computeTokenKeepaliveIntervalMs(sessionLengthRaw: unknown): number {
  const sessionMs = parseSessionLengthMs(sessionLengthRaw);

  // Default: 5 minutes.
  if (!sessionMs) return 5 * 60_000;

  // Renew conservatively and also cap the interval so idle tabs do not expire.
  //
  // Example:
  // - 30 minute session => renew ~every 12 minutes
  // - 1 hour session => renew every 10 minutes (cap)
  const candidate = Math.round(sessionMs * 0.4);

  return Math.max(60_000, Math.min(10 * 60_000, candidate));
}

/**
 * Background keepalive for HaveAPI `token` auth sessions.
 *
 * HaveAPI token sessions are time-limited, but their lifetime is extended by
 * regular authenticated API traffic. When a tab sits idle, the session may
 * expire even though the UI is still open.
 *
 * This component periodically calls a cheap endpoint (`GET /users/current`) to
 * keep the session alive for as long as the UI is open, matching the legacy
 * webui behavior.
 */
export function SessionTokenKeepalive() {
  const online = useNetworkStatus();
  const inFlightRef = useRef(false);

  const enabled = useMemo(() => {
    const cfg = getRuntimeConfig();

    // Only the HaveAPI `token` auth needs this keepalive. OAuth2 flows are handled
    // by the OAuth server and usually require interactive renewal.
    return cfg.auth.kind === 'token';
  }, []);

  const intervalMs = useMemo(() => {
    const raw = typeof window !== 'undefined' ? (window as LegacyAny).vpsAdmin?.sessionLength : undefined;
    return computeTokenKeepaliveIntervalMs(raw);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (!online) return;
    if (typeof window === 'undefined') return;

    let cancelled = false;
    let intervalId: number | undefined;
    let startupTimeoutId: number | undefined;

    const tick = async () => {
      if (cancelled) return;
      if (!online) return;
      if (inFlightRef.current) return;

      inFlightRef.current = true;
      try {
        await fetchCurrentUser();
      } catch {
        // Ignore keepalive errors. AuthProvider handles expired sessions and routes
        // the user to the login screen.
      } finally {
        inFlightRef.current = false;
      }
    };

    // Prevent idle expiry soon after opening the UI.
    startupTimeoutId = window.setTimeout(tick, 5_000);

    // Main renewal loop.
    intervalId = window.setInterval(tick, intervalMs);

    // Opportunistic renewals for user-friendly behavior.
    const onFocus = () => void tick();
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') void tick();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (startupTimeoutId !== undefined) window.clearTimeout(startupTimeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, intervalMs, online]);

  return null;
}
